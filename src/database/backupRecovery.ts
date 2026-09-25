import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { captureSnapshot, restoreSnapshot } from '@/src/backup/database';
import { BackupError, validateSnapshot, type BackupSnapshot } from '@/src/backup/format';
import {
  beginBackupDatabaseRecovery,
  getBackupRecoveryTemporaryPath,
  hasPendingBackupRecoveryNotifications,
  initializeEncryptedDatabase,
  markBackupDatabaseRecoveryReady,
} from '@/src/database/encryption';
import { migrateDatabaseSchema } from '@/src/database/schema';

const KEY_HEX_LENGTH = 64;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stable(entry)]),
  );
}

function snapshotForComparison(snapshot: BackupSnapshot): unknown {
  const { exportedAt: _exportedAt, ...records } = snapshot;
  return stable(records);
}

export async function restoreDatabaseFromBackup(
  databasePath: string,
  candidate: unknown,
): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new BackupError('A recuperação de banco está disponível apenas no app para iOS ou Android.');
  }
  const snapshot = validateSnapshot(candidate);
  const key = Array.from(await Crypto.getRandomBytesAsync(KEY_HEX_LENGTH / 2), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const separator = databasePath.lastIndexOf('/');
  if (separator < 1) throw new BackupError('Não foi possível preparar a recuperação deste aparelho.');
  const directory = databasePath.slice(0, separator);
  const databaseName = databasePath.slice(separator + 1);
  let temporaryDb: SQLiteDatabase | null = null;
  let replacementHandle: SQLiteDatabase | null = null;
  let finalizedDatabase: SQLiteDatabase | null = null;

  const recoveryId = await beginBackupDatabaseRecovery(databasePath, key);
  const temporaryPath = getBackupRecoveryTemporaryPath(databasePath, recoveryId);
  const temporaryFile = new File(temporaryPath);
  try {
    // An incomplete prior restore is safe to replace: the active database was never changed
    // before the recovery state is marked ready.
    if (temporaryFile.exists) temporaryFile.delete();
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = new File(`${temporaryPath}${suffix}`);
      if (sidecar.exists) sidecar.delete();
    }
    temporaryDb = await SQLite.openDatabaseAsync(temporaryFile.name, { useNewConnection: true }, directory);
    const cipher = await temporaryDb.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
    if (!cipher?.cipher_version) throw new BackupError('A criptografia não está disponível nesta build.');
    await temporaryDb.execAsync(`PRAGMA key = "x'${key}'"`);
    await migrateDatabaseSchema(temporaryDb);

    await restoreSnapshot(temporaryDb, snapshot, key);
    const restored = await captureSnapshot(temporaryDb, key);
    if (JSON.stringify(snapshotForComparison(restored)) !== JSON.stringify(snapshotForComparison(snapshot))) {
      throw new BackupError('A conferência do banco restaurado falhou. O banco atual não foi substituído.');
    }

    await temporaryDb.execAsync('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE');
    await temporaryDb.closeAsync();
    temporaryDb = null;
    await markBackupDatabaseRecoveryReady(recoveryId);

    replacementHandle = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true }, directory);
    finalizedDatabase = await initializeEncryptedDatabase(replacementHandle);
    replacementHandle = null;
    await migrateDatabaseSchema(finalizedDatabase);
    await finalizedDatabase.closeAsync();
    finalizedDatabase = null;
    return await hasPendingBackupRecoveryNotifications();
  } catch (error) {
    if (temporaryDb) await temporaryDb.closeAsync().catch(() => undefined);
    if (replacementHandle) await replacementHandle.closeAsync().catch(() => undefined);
    if (finalizedDatabase) await finalizedDatabase.closeAsync().catch(() => undefined);
    throw error;
  }
}
