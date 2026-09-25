import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockSecrets = new Map<string, string>();
const mockFiles = new Set<string>();
const mockFileSizes = new Map<string, number>();
const mockRandomBytesAsync = jest.fn(async (length: number) => new Uint8Array(length).fill(0xab));
const mockEvents: string[] = [];
let mockLegacyTableCount = 0;
let mockBackupTableCount = 0;
let mockExportedState: FakeState | null = null;
let mockOpenedState: FakeState | null = null;
let mockMigrationTempState: FakeState | null = null;
let mockBackupRecoveryTempState: FakeState | null = null;
const mockGetScheduledNotifications = jest.fn(async () => [{ identifier: 'old-notification' }]);
const mockCancelScheduledNotification = jest.fn(async (_id: string) => undefined);

type FakeState = { encrypted: boolean; expectedKey: string | null; appliedKey: string; tables: number; userVersion: number };

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 1,
  getItemAsync: async (key: string) => mockSecrets.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { mockSecrets.set(key, value); },
  deleteItemAsync: async (key: string) => { mockSecrets.delete(key); },
}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: (length: number) => mockRandomBytesAsync(length),
  randomUUID: () => 'new-cipher-database',
}));
jest.mock('expo-file-system', () => ({
  File: class FakeFile {
    path: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.path = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/').replace(/\/{2,}/g, '/');
    }
    get uri() { return this.path; }
    get name() { return this.path.slice(this.path.lastIndexOf('/') + 1); }
    get exists() { return mockFiles.has(this.path); }
    get size() { return mockFileSizes.get(this.path) ?? (mockFiles.has(this.path) ? 4096 : 0); }
    async move(destination: FakeFile) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!mockFiles.has(this.path)) throw new Error('Source file missing');
      mockFiles.delete(this.path);
      const sourceSize = mockFileSizes.get(this.path);
      mockFileSizes.delete(this.path);
      mockFiles.add(destination.path);
      if (sourceSize !== undefined) mockFileSizes.set(destination.path, sourceSize);
      this.path = destination.path;
      mockEvents.push(`move:${destination.path}`);
    }
    async copy(destination: FakeFile) {
      if (!mockFiles.has(this.path)) throw new Error('Source file missing');
      mockFiles.add(destination.path);
      mockFileSizes.set(destination.path, this.size);
      mockEvents.push(`copy:${destination.path}`);
    }
    delete() { mockFiles.delete(this.path); mockFileSizes.delete(this.path); }
  },
  Paths: { cache: { uri: '/app/cache' } },
}));
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async (name: string, _options: unknown, directory: string) => {
    const path = `${directory}/${name}`;
    const wasPresent = mockFiles.has(path);
    mockEvents.push(`open:${name}`);
    mockFiles.add(path);
    if (!mockFileSizes.has(path)) mockFileSizes.set(path, 4096);
    if (name === 'ampara.db') {
      const openedState = mockExportedState ?? mockOpenedState;
      if (!openedState) throw new Error('Unexpected main database reopen');
      return mockFakeConnection(path, openedState).db;
    }
    if (name === 'ampara.db.plaintext-backup') {
      return mockFakeConnection(
        path,
        { encrypted: false, expectedKey: null, appliedKey: '', tables: mockBackupTableCount, userVersion: 2 },
        { sourceTablesOnExport: mockBackupTableCount },
      ).db;
    }
    if (wasPresent && name.endsWith('.cipher-migration.tmp') && mockMigrationTempState) {
      mockExportedState = mockMigrationTempState;
      return mockFakeConnection(path, mockMigrationTempState).db;
    }
    if (wasPresent && name.endsWith('.backup-restore.tmp') && mockBackupRecoveryTempState) {
      mockExportedState = mockBackupRecoveryTempState;
      return mockFakeConnection(path, mockBackupRecoveryTempState).db;
    }
    return mockFakeConnection(
      path,
      { encrypted: false, expectedKey: null, appliedKey: '', tables: 0, userVersion: 0 },
      { sourceTablesOnExport: mockLegacyTableCount },
    ).db;
  },
}));
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: () => mockGetScheduledNotifications(),
  cancelScheduledNotificationAsync: (id: string) => mockCancelScheduledNotification(id),
}));

import {
  initializeEncryptedDatabase, withEncryptedExclusiveTransaction,
} from '@/src/database/encryption';

const originalPlatform = Platform.OS;

function mockFakeConnection(
  path: string,
  state: FakeState,
  { sourceTablesOnExport = 0 } = {},
) {
  const statements: string[] = [];
  const raw = {
    databasePath: path,
    execAsync: jest.fn(async (sql: string) => {
      statements.push(sql);
      mockEvents.push(`exec:${path}:${sql}`);
      const setKey = /^PRAGMA key = "x'([0-9a-f]+)'"$/i.exec(sql);
      if (setKey) state.appliedKey = setKey[1];
      const setUserVersion = /^PRAGMA user_version = (\d+)$/i.exec(sql);
      if (setUserVersion) state.userVersion = Number(setUserVersion[1]);
    }),
    closeAsync: jest.fn(async () => { mockEvents.push(`close:${path}`); }),
    getFirstAsync: jest.fn(async (sql: string) => {
      mockEvents.push(`query:${path}:${sql}`);
      if (sql === 'PRAGMA cipher_version') return { cipher_version: '4.8.0' };
      if (sql === 'PRAGMA user_version') return { user_version: state.userVersion };
      if (sql.includes('sqlcipher_export')) {
        state.encrypted = true;
        state.expectedKey = state.appliedKey;
        state.tables = sourceTablesOnExport;
        mockExportedState = state;
        return { result: 0 };
      }
      if (sql === 'PRAGMA quick_check') {
        if (state.encrypted && state.appliedKey !== state.expectedKey) throw new Error('file is not a database');
        return { quick_check: 'ok' };
      }
      if (sql.includes('sqlite_master')) {
        if (state.encrypted && state.appliedKey !== state.expectedKey) throw new Error('file is not a database');
        return { count: state.tables };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
  };
  return { db: raw as unknown as SQLiteDatabase, raw, statements, state };
}

describe('SQLCipher database initialization', () => {
  afterEach(() => {
    mockSecrets.clear();
    mockFiles.clear();
    mockFileSizes.clear();
    mockRandomBytesAsync.mockClear();
    mockEvents.length = 0;
    mockLegacyTableCount = 0;
    mockBackupTableCount = 0;
    mockExportedState = null;
    mockOpenedState = null;
    mockMigrationTempState = null;
    mockBackupRecoveryTempState = null;
    mockGetScheduledNotifications.mockClear();
    mockCancelScheduledNotification.mockClear();
    Platform.OS = originalPlatform;
  });

  it('exports a legacy database to a new encrypted file, verifies it, then replaces the original', async () => {
    Platform.OS = 'ios';
    mockLegacyTableCount = 8;
    const sourcePath = '/app/documents/SQLite/ampara.db';
    const backupPath = `${sourcePath}.plaintext-backup`;
    mockFiles.add(sourcePath);
    mockFiles.add(`${sourcePath}-wal`);
    mockFiles.add(`${sourcePath}-shm`);
    mockFiles.add(backupPath); // Simulate a stale partial sibling from a previous attempt.
    mockFileSizes.set(sourcePath, 4096);
    mockFileSizes.set(backupPath, 1024);
    const source = mockFakeConnection(sourcePath, { encrypted: false, expectedKey: null, appliedKey: '', tables: 8, userVersion: 2 });

    const protectedDb = await initializeEncryptedDatabase(source.db);

    expect(source.raw.closeAsync).toHaveBeenCalled();
    expect(source.statements).toContain('PRAGMA wal_checkpoint(TRUNCATE)');
    expect(source.statements).toContain('PRAGMA journal_mode = DELETE');
    expect(mockSecrets.get('ampara.sqlcipher.key.v1')).toMatch(/^[0-9a-f]{64}$/);
    expect(mockSecrets.get('ampara.sqlcipher.state.v1')).toBe('ready');
    expect(mockFiles.has(sourcePath)).toBe(true);
    expect(mockFiles.has(backupPath)).toBe(false);
    expect(mockFiles.has(`${sourcePath}-wal`)).toBe(false);
    expect(mockFiles.has(`${sourcePath}-shm`)).toBe(false);
    expect(mockEvents.indexOf(`move:${backupPath}`)).toBeLessThan(mockEvents.indexOf(`move:${sourcePath}`));
    expect(mockEvents.indexOf(`move:${sourcePath}`)).toBeLessThan(mockEvents.indexOf('open:ampara.db'));
    expect((protectedDb as unknown as { databasePath: string }).databasePath).toBe(sourcePath);
    expect(mockExportedState).toMatchObject({ encrypted: true, tables: 8, userVersion: 2 });
  });

  it('keys a new empty database before the initial schema is created', async () => {
    Platform.OS = 'android';
    const sourcePath = '/app/documents/SQLite/ampara.db';
    mockFiles.add(sourcePath);
    mockFileSizes.set(sourcePath, 0);
    const source = mockFakeConnection(sourcePath, { encrypted: false, expectedKey: null, appliedKey: '', tables: 0, userVersion: 0 });

    await initializeEncryptedDatabase(source.db);

    expect(source.statements.some((sql) => /^PRAGMA key = "x'[0-9a-f]{64}'"$/.test(sql))).toBe(true);
    expect(source.statements.some((sql) => sql.includes('sqlcipher_export'))).toBe(false);
    const keyCallOrder = source.raw.execAsync.mock.invocationCallOrder[0];
    const firstSchemaReadIndex = source.raw.getFirstAsync.mock.calls.findIndex(([sql]) => String(sql).includes('sqlite_master'));
    expect(keyCallOrder).toBeLessThan(source.raw.getFirstAsync.mock.invocationCallOrder[firstSchemaReadIndex]);
    expect(mockSecrets.get('ampara.sqlcipher.state.v1')).toBe('ready');
  });

  it('opens an already encrypted database with the device key and does not migrate it again', async () => {
    Platform.OS = 'ios';
    mockSecrets.set('ampara.sqlcipher.key.v1', 'cd'.repeat(32));
    mockSecrets.set('ampara.sqlcipher.state.v1', 'ready');
    const sourcePath = '/app/documents/SQLite/ampara.db';
    mockFiles.add(sourcePath);
    mockFileSizes.set(sourcePath, 4096);
    const source = mockFakeConnection(sourcePath, { encrypted: true, expectedKey: 'cd'.repeat(32), appliedKey: '', tables: 8, userVersion: 2 });

    await initializeEncryptedDatabase(source.db);

    expect(source.statements).toContain(`PRAGMA key = "x'${'cd'.repeat(32)}'"`);
    expect(source.statements.some((sql) => sql.includes('sqlcipher_export'))).toBe(false);
  });

  it('keys the separate exclusive-transaction connection before beginning its transaction', async () => {
    Platform.OS = 'ios';
    const sourcePath = '/app/documents/SQLite/ampara.db';
    mockFiles.add(sourcePath);
    mockFileSizes.set(sourcePath, 4096);
    const state = { encrypted: true, expectedKey: '56'.repeat(32), appliedKey: '', tables: 8, userVersion: 2 };
    mockSecrets.set('ampara.sqlcipher.key.v1', state.expectedKey);
    mockOpenedState = state;

    const count = await withEncryptedExclusiveTransaction(sourcePath, async (transaction) => {
      const row = await transaction.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM sqlite_master',
      );
      return row?.count;
    });

    expect(count).toBe(8);
    const keyOrder = mockEvents.indexOf(`exec:${sourcePath}:PRAGMA key = "x'${state.expectedKey}'"`);
    const firstDataReadOrder = mockEvents.indexOf(`query:${sourcePath}:SELECT count(*) AS count FROM sqlite_master`);
    const beginOrder = mockEvents.indexOf(`exec:${sourcePath}:BEGIN EXCLUSIVE`);
    const commitOrder = mockEvents.indexOf(`exec:${sourcePath}:COMMIT`);
    expect(keyOrder).toBeGreaterThan(-1);
    expect(keyOrder).toBeLessThan(firstDataReadOrder);
    expect(firstDataReadOrder).toBeLessThan(beginOrder);
    expect(beginOrder).toBeLessThan(commitOrder);
    expect(mockEvents).toContain(`close:${sourcePath}`);
  });

  it('finishes an interrupted backup restore from its staged encrypted file', async () => {
    Platform.OS = 'ios';
    const sourcePath = '/app/documents/SQLite/ampara.db';
    const oldKey = 'ab'.repeat(32);
    const newKey = 'cd'.repeat(32);
    const recoveryId = 'restore-1';
    const temporaryPath = `${sourcePath}.${recoveryId}.backup-restore.tmp`;
    const previousStageId = 'restore-previous';
    const previousTemporaryPath = `${sourcePath}.${previousStageId}.backup-restore.tmp`;
    const originalPath = `${sourcePath}.before-backup-restore`;
    mockFiles.add(sourcePath);
    mockFiles.add(`${sourcePath}-wal`);
    mockFiles.add(`${sourcePath}-shm`);
    mockFiles.add(temporaryPath);
    mockFiles.add(previousTemporaryPath);
    mockFiles.add(`${temporaryPath}-wal`);
    mockFiles.add(`${temporaryPath}-shm`);
    mockFileSizes.set(sourcePath, 4096);
    mockFileSizes.set(temporaryPath, 4096);
    mockSecrets.set('ampara.sqlcipher.key.v1', oldKey);
    mockSecrets.set(`ampara.sqlcipher.backup-recovery-key.v1.${recoveryId}`, newKey);
    mockSecrets.set(`ampara.sqlcipher.backup-recovery-key.v1.${previousStageId}`, 'de'.repeat(32));
    mockSecrets.set('ampara.sqlcipher.backup-recovery-state.v1', `ready|${recoveryId}|${previousStageId}`);
    mockOpenedState = { encrypted: true, expectedKey: oldKey, appliedKey: '', tables: 8, userVersion: 2 };
    mockBackupRecoveryTempState = { encrypted: true, expectedKey: newKey, appliedKey: '', tables: 8, userVersion: 2 };
    const oldDatabase = mockFakeConnection(sourcePath, mockOpenedState);

    const recovered = await initializeEncryptedDatabase(oldDatabase.db);

    expect(oldDatabase.raw.closeAsync).toHaveBeenCalled();
    expect((recovered as unknown as { databasePath: string }).databasePath).toBe(sourcePath);
    expect(mockSecrets.get('ampara.sqlcipher.key.v1')).toBe(newKey);
    expect(mockSecrets.has(`ampara.sqlcipher.backup-recovery-key.v1.${recoveryId}`)).toBe(false);
    expect(mockSecrets.has('ampara.sqlcipher.backup-recovery-state.v1')).toBe(false);
    expect(mockSecrets.has('ampara.sqlcipher.backup-notifications.v1')).toBe(false);
    expect(mockSecrets.get('ampara.sqlcipher.backup-notifications-done.v1')).toBe(recoveryId);
    expect(mockCancelScheduledNotification).toHaveBeenCalledWith('old-notification');
    expect(mockCancelScheduledNotification).toHaveBeenCalledTimes(1);
    expect(mockFiles.has(temporaryPath)).toBe(false);
    expect(mockFiles.has(previousTemporaryPath)).toBe(false);
    expect(mockSecrets.has(`ampara.sqlcipher.backup-recovery-key.v1.${previousStageId}`)).toBe(false);
    expect(mockFiles.has(`${temporaryPath}-wal`)).toBe(false);
    expect(mockFiles.has(`${temporaryPath}-shm`)).toBe(false);
    expect(mockFiles.has(originalPath)).toBe(false);
    expect(mockFiles.has(`${originalPath}-wal`)).toBe(false);
    expect(mockFiles.has(`${originalPath}-shm`)).toBe(false);
    expect(mockFiles.has(`${sourcePath}-wal`)).toBe(false);
    expect(mockFiles.has(`${sourcePath}-shm`)).toBe(false);
    expect(mockSecrets.get('ampara.sqlcipher.state.v1')).toBe('ready');
  });

  it('fails closed when an encrypted database has lost its key', async () => {
    Platform.OS = 'android';
    const sourcePath = '/app/documents/SQLite/ampara.db';
    mockFiles.add(sourcePath);
    mockFileSizes.set(sourcePath, 4096);
    const source = mockFakeConnection(sourcePath, { encrypted: true, expectedKey: 'ef'.repeat(32), appliedKey: '', tables: 8, userVersion: 2 });

    await expect(initializeEncryptedDatabase(source.db)).rejects.toThrow(/chave deste banco criptografado/);
    expect(source.raw.execAsync).not.toHaveBeenCalled();
    expect(mockSecrets.size).toBe(0);
    expect(source.statements).toEqual([]);
  });

  it('reinitializes an empty database with its surviving key after an iOS reinstall', async () => {
    Platform.OS = 'ios';
    mockSecrets.set('ampara.sqlcipher.key.v1', 'ef'.repeat(32));
    mockSecrets.set('ampara.sqlcipher.state.v1', 'ready');
    const sourcePath = '/app/documents/SQLite/ampara.db';
    mockFiles.add(sourcePath);
    mockFileSizes.set(sourcePath, 0);
    const source = mockFakeConnection(sourcePath, { encrypted: false, expectedKey: null, appliedKey: '', tables: 0, userVersion: 0 });

    await initializeEncryptedDatabase(source.db);
    expect(source.statements).toContain(`PRAGMA key = "x'${'ef'.repeat(32)}'"`);
    expect(mockSecrets.get('ampara.sqlcipher.key.v1')).toBe('ef'.repeat(32));
    expect(mockSecrets.get('ampara.sqlcipher.state.v1')).toBe('ready');
  });

  it('recovers an interrupted legacy export by creating a fresh encrypted replacement', async () => {
    Platform.OS = 'ios';
    mockSecrets.set('ampara.sqlcipher.key.v1', '12'.repeat(32));
    mockSecrets.set('ampara.sqlcipher.state.v1', 'migration-pending');
    mockLegacyTableCount = 8;
    const sourcePath = '/app/documents/SQLite/ampara.db';
    mockFiles.add(sourcePath);
    mockFileSizes.set(sourcePath, 4096);
    const source = mockFakeConnection(sourcePath, { encrypted: false, expectedKey: null, appliedKey: '', tables: 8, userVersion: 2 });

    await initializeEncryptedDatabase(source.db);

    expect(mockExportedState).toMatchObject({ encrypted: true, tables: 8 });
    expect(mockSecrets.get('ampara.sqlcipher.state.v1')).toBe('ready');
  });

  it('recovers the durable plaintext copy when an interrupted replacement left an empty main file', async () => {
    Platform.OS = 'ios';
    mockSecrets.set('ampara.sqlcipher.key.v1', '34'.repeat(32));
    mockSecrets.set('ampara.sqlcipher.state.v1', 'migration-pending');
    mockBackupTableCount = 8;
    mockLegacyTableCount = 8;
    const sourcePath = '/app/documents/SQLite/ampara.db';
    mockFiles.add(sourcePath);
    mockFileSizes.set(sourcePath, 0);
    const backupPath = `${sourcePath}.plaintext-backup`;
    const temporaryPath = `${sourcePath}.cipher-migration.tmp`;
    mockFiles.add(backupPath);
    mockFiles.add(temporaryPath);
    mockFileSizes.set(backupPath, 4096);
    mockFileSizes.set(temporaryPath, 4096);
    mockMigrationTempState = { encrypted: true, expectedKey: '34'.repeat(32), appliedKey: '', tables: 7, userVersion: 2 };
    mockExportedState = null;
    const emptyMain = mockFakeConnection(sourcePath, { encrypted: false, expectedKey: null, appliedKey: '', tables: 0, userVersion: 0 });

    const recoveredDb = await initializeEncryptedDatabase(emptyMain.db);

    expect(emptyMain.raw.closeAsync).toHaveBeenCalled();
    expect(mockExportedState).toMatchObject({ encrypted: true, tables: 8 });
    expect((recoveredDb as unknown as { databasePath: string }).databasePath).toBe(sourcePath);
    expect(mockFiles.has(backupPath)).toBe(false);
    expect(mockFiles.has(temporaryPath)).toBe(false);
    expect(mockEvents.some((event) => event.includes('sqlcipher_export'))).toBe(true);
    expect(mockSecrets.get('ampara.sqlcipher.state.v1')).toBe('ready');
  });

  it('uses the verified encrypted temporary only when the plaintext recovery copy is unusable', async () => {
    Platform.OS = 'ios';
    const key = '78'.repeat(32);
    mockSecrets.set('ampara.sqlcipher.key.v1', key);
    mockSecrets.set('ampara.sqlcipher.state.v1', 'migration-pending');
    mockBackupTableCount = 0;
    mockLegacyTableCount = 8;
    const sourcePath = '/app/documents/SQLite/ampara.db';
    const backupPath = `${sourcePath}.plaintext-backup`;
    const temporaryPath = `${sourcePath}.cipher-migration.tmp`;
    mockFiles.add(sourcePath);
    mockFiles.add(backupPath);
    mockFiles.add(temporaryPath);
    mockFileSizes.set(sourcePath, 0);
    mockFileSizes.set(backupPath, 4096);
    mockFileSizes.set(temporaryPath, 4096);
    mockMigrationTempState = { encrypted: true, expectedKey: key, appliedKey: '', tables: 8, userVersion: 2 };
    const emptyMain = mockFakeConnection(sourcePath, { encrypted: false, expectedKey: null, appliedKey: '', tables: 0, userVersion: 0 });

    const recoveredDb = await initializeEncryptedDatabase(emptyMain.db);

    expect((recoveredDb as unknown as { databasePath: string }).databasePath).toBe(sourcePath);
    expect(mockFiles.has(backupPath)).toBe(false);
    expect(mockFiles.has(temporaryPath)).toBe(false);
    expect(mockEvents.some((event) => event.includes('sqlcipher_export'))).toBe(false);
    expect(mockSecrets.get('ampara.sqlcipher.state.v1')).toBe('ready');
  });

  it('does not run SQLCipher or write secure-store keys on web', async () => {
    Platform.OS = 'web';
    const source = mockFakeConnection('', { encrypted: false, expectedKey: null, appliedKey: '', tables: 0, userVersion: 0 });

    await initializeEncryptedDatabase(source.db);

    expect(source.raw.execAsync).not.toHaveBeenCalled();
    expect(source.raw.getFirstAsync).not.toHaveBeenCalled();
    expect(mockSecrets.size).toBe(0);
  });
});
