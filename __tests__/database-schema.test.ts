import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 1,
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { migrateDatabaseSchema } from '@/src/database/schema';

function databaseStub(options: { quickCheck?: string[]; userVersion?: number } = {}) {
  const statements: string[] = [];
  const raw = {
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql === 'PRAGMA quick_check') {
        return (options.quickCheck ?? ['ok']).map((quick_check) => ({ quick_check }));
      }
      return [];
    }),
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql === 'PRAGMA user_version') return { user_version: options.userVersion ?? 0 };
      if (sql.includes('sqlite_master')) return { table_count: 0 };
      return null;
    }),
    execAsync: jest.fn(async (sql: string) => { statements.push(sql); }),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
  return { db: raw as unknown as SQLiteDatabase, raw, statements };
}

describe('SQLite-only database startup', () => {
  it('validates a new empty SQLite database before creating its schema', async () => {
    const { db, raw, statements } = databaseStub({ userVersion: 0 });

    await expect(migrateDatabaseSchema(db)).resolves.toBe(db);

    expect(raw.getAllAsync).toHaveBeenCalledWith('PRAGMA quick_check');
    expect(statements[0]).toBe('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    expect(statements.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS care_profile'))).toBe(true);
  });

  it('rejects a database that fails SQLite integrity checks before writing anything', async () => {
    const { db, raw } = databaseStub({ quickCheck: ['database disk image is malformed'] });

    await expect(migrateDatabaseSchema(db)).rejects.toThrow('Seus registros não foram alterados');
    expect(raw.execAsync).not.toHaveBeenCalled();
  });

  it('fails closed if the file cannot be read as SQLite instead of creating an empty schema', async () => {
    const { db, raw } = databaseStub();
    raw.getAllAsync.mockRejectedValueOnce(new Error('file is not a database'));

    await expect(migrateDatabaseSchema(db)).rejects.toThrow('Seus registros não foram alterados');
    expect(raw.execAsync).not.toHaveBeenCalled();
  });

  it('does not downgrade a database created by a newer app version', async () => {
    const { db, raw } = databaseStub({ userVersion: 99 });

    await expect(migrateDatabaseSchema(db)).rejects.toThrow('versão mais recente');
    expect(raw.execAsync).not.toHaveBeenCalled();
  });

  it('does not treat an unknown non-empty database as a new install', async () => {
    const { db, raw } = databaseStub({ userVersion: 0 });
    raw.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql === 'PRAGMA user_version') return { user_version: 0 };
      if (sql.includes('sqlite_master')) return { table_count: 4 };
      return null;
    });

    await expect(migrateDatabaseSchema(db)).rejects.toThrow('formato desconhecido');
    expect(raw.execAsync).not.toHaveBeenCalled();
  });

  it('opens an already migrated database without rerunning schema migrations', async () => {
    const { db, raw, statements } = databaseStub({ userVersion: 2 });

    await expect(migrateDatabaseSchema(db)).resolves.toBe(db);

    expect(raw.getAllAsync).toHaveBeenCalledWith('PRAGMA quick_check');
    expect(statements).toEqual(['PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;']);
    expect(raw.withTransactionAsync).not.toHaveBeenCalled();
  });
});
