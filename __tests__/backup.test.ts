import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockSecureItems = new Map<string, string>();
const mockCancelScheduledNotification = jest.fn(async (_id: string) => undefined);

// Expo's native AES API is unavailable in Jest; emulate its sealed-data contract with
// Node's real AES-256-GCM. The PBKDF2 implementation, validation and wire format are real.
jest.mock('expo-crypto', () => {
  const crypto = require('crypto') as typeof import('crypto');
  return {
    getRandomBytesAsync: async (count: number) => new Uint8Array(crypto.randomBytes(count)),
    AESEncryptionKey: {
      import: async (bytes: Uint8Array) => ({ bytes: Buffer.from(bytes) }),
    },
    AESSealedData: {
      fromCombined: (combined: Uint8Array) => ({ combined }),
    },
    aesEncryptAsync: async (plaintext: Uint8Array, key: { bytes: Buffer }, options: { additionalData: Uint8Array }) => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key.bytes, iv);
      cipher.setAAD(Buffer.from(options.additionalData));
      const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const combined = new Uint8Array(Buffer.concat([iv, data, cipher.getAuthTag()]));
      return { combined: async () => combined };
    },
    aesDecryptAsync: async (
      sealed: { combined: Uint8Array }, key: { bytes: Buffer }, options: { additionalData: Uint8Array },
    ) => {
      const bytes = Buffer.from(sealed.combined);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key.bytes, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(options.additionalData));
      decipher.setAuthTag(bytes.subarray(-16));
      return new Uint8Array(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]));
    },
  };
});
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 1,
  getItemAsync: async (key: string) => mockSecureItems.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { mockSecureItems.set(key, value); },
  deleteItemAsync: async (key: string) => { mockSecureItems.delete(key); },
}));
jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: (id: string) => mockCancelScheduledNotification(id),
}));
const mockWithEncryptedExclusiveTransaction = jest.fn<
  (databasePath: string, task: (transaction: SQLiteDatabase) => Promise<unknown>) => Promise<unknown>
>();
jest.mock('@/src/database/encryption', () => ({
  withEncryptedExclusiveTransaction: (
    databasePath: string,
    task: (transaction: SQLiteDatabase) => Promise<unknown>,
  ) => mockWithEncryptedExclusiveTransaction(databasePath, task),
}));

import { encryptSnapshot, decryptSnapshot } from '@/src/backup/crypto';
import { captureSnapshot, restoreSnapshot } from '@/src/backup/database';
import { BackupError, MAX_RECORDS_PER_TABLE, validateSnapshot, type BackupSnapshot } from '@/src/backup/format';

afterEach(() => {
  mockSecureItems.clear();
  mockCancelScheduledNotification.mockClear();
});

const stamp = '2026-09-25 12:34:56';
const sample = (): BackupSnapshot => ({
  schemaVersion: 2,
  exportedAt: '2026-09-25T12:34:56.000Z',
  activeRecipientId: 9,
  recipients: [
    { id: 2, person_name: 'Lia', relationship: 'mãe', created_at: stamp, updated_at: stamp },
    { id: 9, person_name: 'José', relationship: 'pai', created_at: stamp, updated_at: stamp },
  ],
  events: [{ id: 11, recipient_id: 9, title: 'Consulta', kind: 'consulta', event_date: '2026-10-12', event_time: '09:30', location: null, notes: null, reminder_minutes: 30, created_at: stamp, updated_at: stamp }],
  tasks: [{ id: 12, recipient_id: 2, title: 'Buscar exame', due_date: null, assignee: null, notes: null, completed: 1, created_at: stamp, updated_at: stamp }],
  expenses: [{ id: 13, recipient_id: 9, title: 'Transporte', amount_cents: 4300, category: 'Transporte', spent_on: '2026-09-25', notes: null, created_at: stamp }],
  documents: [{ id: 14, recipient_id: 2, title: 'Carteira', location: 'Gaveta', expires_on: null, completed: 1, created_at: stamp }],
  medications: [{ id: 15, recipient_id: 9, name: 'Lista antiga', schedule: null, notes: null, active: 0, created_at: stamp }],
});

function copy(): BackupSnapshot {
  return JSON.parse(JSON.stringify(sample())) as BackupSnapshot;
}

describe('encrypted backup format', () => {
  it('round-trips an authenticated AES-256-GCM snapshot with a fresh salt and fixed work factor', async () => {
    const snapshot = sample();
    const a = await encryptSnapshot(snapshot, 'a long and unique password', 'a long and unique password');
    const b = await encryptSnapshot(snapshot, 'a long and unique password', 'a long and unique password');
    expect(a.length).toBeGreaterThan(60);
    expect(Array.from(a.slice(0, 8))).toEqual(Array.from(new TextEncoder().encode('AMPARABK')));
    expect(new DataView(a.buffer).getUint32(9, false)).toBe(600_000);
    expect(Array.from(a.slice(13, 29))).not.toEqual(Array.from(b.slice(13, 29)));
    expect(await decryptSnapshot(a, 'a long and unique password')).toEqual(snapshot);
    expect(Buffer.from(a).includes(Buffer.from('Consulta'))).toBe(false);
  });

  it('rejects wrong passwords, changed authenticated headers, bad rounds, corruption and short passwords', async () => {
    const pass = 'a long and unique password';
    const encrypted = await encryptSnapshot(sample(), pass, pass);
    await expect(decryptSnapshot(encrypted, 'a different password')).rejects.toThrow('Senha incorreta');
    const saltTampered = encrypted.slice();
    saltTampered[14] ^= 1;
    await expect(decryptSnapshot(saltTampered, pass)).rejects.toThrow('Senha incorreta');
    const ciphertextTampered = encrypted.slice();
    ciphertextTampered[40] ^= 1;
    await expect(decryptSnapshot(ciphertextTampered, pass)).rejects.toThrow('Senha incorreta');
    const version = encrypted.slice();
    version[8] = 2;
    await expect(decryptSnapshot(version, pass)).rejects.toThrow('versão');
    const rounds = encrypted.slice();
    rounds[12] ^= 1;
    await expect(decryptSnapshot(rounds, pass)).rejects.toThrow('parâmetros');
    await expect(decryptSnapshot(encrypted.subarray(0, 30), pass)).rejects.toBeInstanceOf(BackupError);
    await expect(encryptSnapshot(sample(), 'short', 'short')).rejects.toThrow('12 caracteres');
    await expect(encryptSnapshot(sample(), '🔐'.repeat(6), '🔐'.repeat(6))).rejects.toThrow('12 caracteres');
    await expect(encryptSnapshot(sample(), pass, 'something else')).rejects.toThrow('não coincidem');
  });
});

describe('snapshot validation', () => {
  it.each([
    ['third profile', (s: BackupSnapshot) => s.recipients.push({ ...s.recipients[0], id: 3 })],
    ['duplicate id', (s: BackupSnapshot) => s.tasks.push({ ...s.tasks[0] })],
    ['orphaned row', (s: BackupSnapshot) => { s.events[0].recipient_id = 44; }],
    ['unknown relationship', (s: BackupSnapshot) => { s.recipients[0].relationship = 'amigo' as never; }],
    ['invalid event type', (s: BackupSnapshot) => { s.events[0].kind = 'injeção' as never; }],
    ['impossible date', (s: BackupSnapshot) => { s.events[0].event_date = '2026-02-30'; }],
    ['invalid clock', (s: BackupSnapshot) => { s.events[0].event_time = '28:90'; }],
    ['invalid timestamp', (s: BackupSnapshot) => { s.tasks[0].updated_at = 'yesterday'; }],
    ['invalid flag', (s: BackupSnapshot) => { s.medications[0].active = 2 as never; }],
    ['invalid amount', (s: BackupSnapshot) => { s.expenses[0].amount_cents = -1; }],
    ['unknown active person', (s: BackupSnapshot) => { s.activeRecipientId = 7; }],
    ['notification id field', (s: BackupSnapshot) => { (s.events[0] as unknown as Record<string, unknown>).notification_id = 'device-token'; }],
    ['unsupported schema', (s: BackupSnapshot) => { s.schemaVersion = 3 as never; }],
  ])('rejects %s before any database work', (_label, mutate) => {
    const snapshot = copy();
    mutate(snapshot);
    expect(() => validateSnapshot(snapshot)).toThrow(BackupError);
  });

  it('caps each table and accepts an empty account only with a null active ID', () => {
    const tooMany = copy();
    tooMany.medications = Array.from({ length: MAX_RECORDS_PER_TABLE + 1 }, (_, index) => ({
      ...tooMany.medications[0], id: index + 1,
    }));
    expect(() => validateSnapshot(tooMany)).toThrow(BackupError);
    const empty = { ...sample(), recipients: [], events: [], tasks: [], expenses: [], documents: [], medications: [], activeRecipientId: null };
    expect(validateSnapshot(empty)).toEqual(empty);
    expect(() => validateSnapshot({ ...empty, activeRecipientId: 1 })).toThrow(BackupError);
  });
});

// Transaction fake has copy-on-write semantics: a rejected callback rolls back its writes.
function fakeDatabase(failOn?: string) {
  const initial = sample();
  let state = {
    care_recipients: [...initial.recipients], care_events: [{ ...initial.events[0], notification_id: 'old-local-id' }],
    care_tasks: [...initial.tasks], care_expenses: [...initial.expenses],
    care_documents: [...initial.documents], medication_notes: [...initial.medications],
    app_settings: [{ active_recipient_id: 9 }], legacy_unrelated: [{ secret: 'untouched' }],
  } as Record<string, Record<string, unknown>[]>;
  const statements: string[] = [];
  const databasePath = '/app/documents/SQLite/ampara.db';
  const db = {
    databasePath,
    getFirstAsync: async (sql: string, notificationId?: string) => {
      if (!sql.includes('notification_id = ?')) return null;
      return state.care_events.find((row) => row.notification_id === notificationId) ?? null;
    },
  } as unknown as SQLiteDatabase;
  mockWithEncryptedExclusiveTransaction.mockClear();
  mockWithEncryptedExclusiveTransaction.mockImplementation(async (requestedPath, task) => {
    if (requestedPath !== databasePath) throw new Error('Unexpected database path');
    const pending = structuredClone(state);
    const txn = {
      getFirstAsync: async (sql: string) => sql === 'PRAGMA user_version' ? { user_version: 2 } : pending.app_settings[0],
      getAllAsync: async (sql: string) => {
        const table = /FROM (\w+)/.exec(sql)?.[1];
        if (!table) throw new Error('No table');
        if (table === 'care_events' && sql.includes('notification_id IS NOT NULL')) {
          return pending.care_events.filter((row) => row.notification_id).map((row) => ({ notification_id: row.notification_id }));
        }
        return pending[table].map((row) => {
          if (table === 'care_events') {
            const { notification_id: _ignored, ...backupRow } = row;
            return backupRow;
          }
          return row;
        });
      },
      runAsync: async (sql: string, ...params: unknown[]) => {
        statements.push(sql);
        if (failOn && sql.includes(failOn)) throw new Error('Injected SQLite failure');
        const table = /(?:DELETE FROM|INSERT INTO) (\w+)/.exec(sql)?.[1];
        if (sql.startsWith('DELETE FROM') && table) pending[table] = [];
        if (sql.startsWith('INSERT INTO') && table && table !== 'app_settings') {
          const columns = /\(([^)]+)\)\s*VALUES/.exec(sql)?.[1].split(',').map((name) => name.trim()) ?? [];
          const row = Object.fromEntries(columns.map((name, index) => [name, name === 'notification_id' ? null : params[index - (columns.indexOf('notification_id') !== -1 && index > columns.indexOf('notification_id') ? 1 : 0)]]));
          pending[table].push(row);
        }
        if (sql.startsWith('UPDATE app_settings')) pending.app_settings[0].active_recipient_id = null;
        if (sql.startsWith('INSERT INTO app_settings')) pending.app_settings = [{ active_recipient_id: params[0] }];
        return { changes: 1, lastInsertRowId: 1 };
      },
    } as unknown as SQLiteDatabase;
    const result = await task(txn);
    state = pending;
    return result;
  });
  return { db, raw: mockWithEncryptedExclusiveTransaction, getState: () => state, statements };
}

describe('database snapshot and replacement', () => {
  it('captures both profiles and every row, including completed and inactive rows but not notification IDs', async () => {
    const { db } = fakeDatabase();
    const snapshot = await captureSnapshot(db);
    expect(snapshot.activeRecipientId).toBe(9);
    expect(snapshot.recipients).toHaveLength(2);
    expect(snapshot.tasks[0].completed).toBe(1);
    expect(snapshot.medications[0].active).toBe(0);
    expect(snapshot.events[0].created_at).toBe(stamp);
    expect(JSON.stringify(snapshot)).not.toContain('notification_id');
  });

  it('replaces only v2 tables atomically, retains IDs, dates and active profile, and inserts NULL notification IDs', async () => {
    const { db, getState, statements } = fakeDatabase();
    const oldIds = await restoreSnapshot(db, sample());
    expect(oldIds).toEqual(['old-local-id']);
    expect(JSON.parse(mockSecureItems.get('ampara.restore.pending-notification-ids.v1') ?? '[]')).toEqual(['old-local-id']);
    expect(getState().care_recipients.map((row) => row.id)).toEqual([2, 9]);
    expect(getState().care_events[0]).toMatchObject({ id: 11, recipient_id: 9, notification_id: null, created_at: stamp, updated_at: stamp });
    expect(getState().app_settings[0].active_recipient_id).toBe(9);
    expect(getState().medication_notes[0].active).toBe(0);
    expect(getState().legacy_unrelated).toEqual([{ secret: 'untouched' }]);
    expect(statements.join(' ')).not.toContain('legacy_unrelated');
  });

  it('does not start a transaction for invalid snapshots and rolls back all writes on insertion failure', async () => {
    const { db, raw, getState } = fakeDatabase('INSERT INTO care_expenses');
    const before = structuredClone(getState());
    const bad = copy();
    bad.documents[0].expires_on = '2026-02-30';
    await expect(restoreSnapshot(db, bad)).rejects.toBeInstanceOf(BackupError);
    expect(raw).not.toHaveBeenCalled();
    await expect(restoreSnapshot(db, sample())).rejects.toThrow('Injected SQLite failure');
    expect(getState()).toEqual(before);
    expect(mockSecureItems.has('ampara.restore.pending-notification-ids.v1')).toBe(false);
    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
  });

  it('refuses unsupported platforms instead of using a non-atomic fallback', async () => {
    const db = {} as SQLiteDatabase;
    await expect(restoreSnapshot(db, sample())).rejects.toThrow('iOS ou Android');
  });
});
