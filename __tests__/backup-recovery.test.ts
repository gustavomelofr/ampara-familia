import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

import type { BackupSnapshot } from '@/src/backup/format';

const mockEvents: string[] = [];
const mockBeginRecovery = jest.fn(async (_databasePath: string, _key: string) => { mockEvents.push('begin'); return 'stage-test'; });
const mockMarkReady = jest.fn(async () => { mockEvents.push('ready'); });
const mockInitializeDatabase = jest.fn(async (database: SQLiteDatabase) => {
  mockEvents.push('finalize');
  return database;
});
const mockMigrateSchema = jest.fn(async (database: SQLiteDatabase) => {
  mockEvents.push(`schema:${database.databasePath}`);
  return database;
});
const mockRestoreSnapshot = jest.fn(async (_database?: SQLiteDatabase, _candidate?: unknown, _key?: string) => {
  mockEvents.push('restore');
  return [];
});
const mockCaptureSnapshot = jest.fn(async (_database?: SQLiteDatabase, _key?: string) => {
  mockEvents.push('capture');
  return snapshot;
});
const mockOpenDatabaseAsync = jest.fn<
  (name: string, options?: unknown, directory?: string) => Promise<SQLiteDatabase>
>();
const mockRandomBytes = jest.fn(async (length: number) => new Uint8Array(length).fill(0x22));
const mockFilePaths = new Set<string>();

jest.mock('expo-crypto', () => ({ getRandomBytesAsync: (length: number) => mockRandomBytes(length) }));
jest.mock('expo-file-system', () => ({
  File: class FakeFile {
    path: string;
    constructor(path: string) { this.path = path; }
    get exists() { return mockFilePaths.has(this.path); }
    get name() { return this.path.slice(this.path.lastIndexOf('/') + 1); }
    delete() { mockFilePaths.delete(this.path); }
  },
}));
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (name: string, options?: unknown, directory?: string) => mockOpenDatabaseAsync(name, options, directory),
}));
jest.mock('@/src/database/schema', () => ({ migrateDatabaseSchema: (db: SQLiteDatabase) => mockMigrateSchema(db) }));
jest.mock('@/src/backup/database', () => ({
  captureSnapshot: (db: SQLiteDatabase, key?: string) => mockCaptureSnapshot(db, key),
  restoreSnapshot: (db: SQLiteDatabase, candidate: unknown, key?: string) => mockRestoreSnapshot(db, candidate, key),
}));
jest.mock('@/src/database/encryption', () => ({
  beginBackupDatabaseRecovery: (path: string, key: string) => mockBeginRecovery(path, key),
  getBackupRecoveryTemporaryPath: (_path: string, id: string) => `/app/SQLite/ampara.db.${id}.backup-restore.tmp`,
  hasPendingBackupRecoveryNotifications: async () => false,
  initializeEncryptedDatabase: (db: SQLiteDatabase) => mockInitializeDatabase(db),
  markBackupDatabaseRecoveryReady: (_id: string) => mockMarkReady(),
}));

import { restoreDatabaseFromBackup } from '@/src/database/backupRecovery';

const snapshot: BackupSnapshot = {
  schemaVersion: 2,
  exportedAt: '2026-09-25T12:34:56.000Z',
  activeRecipientId: null,
  recipients: [],
  events: [],
  tasks: [],
  expenses: [],
  documents: [],
  medications: [],
};

const originalPlatform = Platform.OS;
afterEach(() => {
  Platform.OS = originalPlatform;
  mockEvents.length = 0;
  mockBeginRecovery.mockClear();
  mockMarkReady.mockClear();
  mockInitializeDatabase.mockClear();
  mockMigrateSchema.mockClear();
  mockRestoreSnapshot.mockClear();
  mockCaptureSnapshot.mockClear();
  mockOpenDatabaseAsync.mockReset();
  mockRandomBytes.mockClear();
  mockFilePaths.clear();
});

describe('staged recovery from an encrypted backup', () => {
  it('builds and verifies a separate database before asking initialization to swap it in', async () => {
    Platform.OS = 'ios';
    const temporaryPath = '/app/SQLite/ampara.db.stage-test.backup-restore.tmp';
    const temporaryDb = {
      databasePath: temporaryPath,
      getFirstAsync: jest.fn(async () => ({ cipher_version: '4.8.0' })),
      execAsync: jest.fn(async () => undefined),
      closeAsync: jest.fn(async () => { mockEvents.push('close-temp'); }),
    } as unknown as SQLiteDatabase;
    const mainDb = {
      databasePath: '/app/SQLite/ampara.db',
      getFirstAsync: jest.fn(),
      execAsync: jest.fn(),
      closeAsync: jest.fn(async () => undefined),
    } as unknown as SQLiteDatabase;
    mockOpenDatabaseAsync.mockImplementation(async (name: string) => {
      mockEvents.push(`open:${name}`);
      return name === 'ampara.db.stage-test.backup-restore.tmp' ? temporaryDb : mainDb;
    });

    await restoreDatabaseFromBackup('/app/SQLite/ampara.db', snapshot);

    expect(mockBeginRecovery).toHaveBeenCalledWith('/app/SQLite/ampara.db', '22'.repeat(32));
    expect(mockRestoreSnapshot).toHaveBeenCalledWith(temporaryDb, snapshot, '22'.repeat(32));
    expect(mockCaptureSnapshot).toHaveBeenCalledWith(temporaryDb, '22'.repeat(32));
    expect(mockEvents.indexOf('begin')).toBeLessThan(mockEvents.indexOf('open:ampara.db.stage-test.backup-restore.tmp'));
    expect(mockEvents.indexOf('restore')).toBeLessThan(mockEvents.indexOf('capture'));
    expect(mockEvents.indexOf('capture')).toBeLessThan(mockEvents.indexOf('ready'));
    expect(mockEvents.indexOf('ready')).toBeLessThan(mockEvents.indexOf('finalize'));
    expect(mockInitializeDatabase).toHaveBeenCalledWith(mainDb);
    expect(temporaryDb.execAsync).toHaveBeenCalledWith(`PRAGMA key = "x'${'22'.repeat(32)}'"`);
    expect(temporaryDb.closeAsync).toHaveBeenCalled();
  });

  it('does not mark recovery ready or touch the main database if post-restore verification fails', async () => {
    Platform.OS = 'android';
    const temporaryDb = {
      databasePath: '/app/SQLite/ampara.db.backup-restore.tmp',
      getFirstAsync: jest.fn(async () => ({ cipher_version: '4.8.0' })),
      execAsync: jest.fn(async () => undefined),
      closeAsync: jest.fn(async () => undefined),
    } as unknown as SQLiteDatabase;
    mockOpenDatabaseAsync.mockResolvedValue(temporaryDb);
    mockCaptureSnapshot.mockResolvedValueOnce({ ...snapshot, activeRecipientId: 1 });

    await expect(restoreDatabaseFromBackup('/app/SQLite/ampara.db', snapshot)).rejects.toThrow(/conferência/);
    expect(mockBeginRecovery).toHaveBeenCalled();
    expect(mockMarkReady).not.toHaveBeenCalled();
    expect(mockInitializeDatabase).not.toHaveBeenCalled();
    expect(temporaryDb.closeAsync).toHaveBeenCalled();
  });
});
