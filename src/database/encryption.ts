import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_KEY_NAME = 'ampara.sqlcipher.key.v1';
const DATABASE_STATE_NAME = 'ampara.sqlcipher.state.v1';
const BACKUP_RECOVERY_STATE_NAME = 'ampara.sqlcipher.backup-recovery-state.v1';
const BACKUP_RECOVERY_KEY_PREFIX = 'ampara.sqlcipher.backup-recovery-key.v1.';
const BACKUP_RECOVERY_BUILDING_NAME = 'ampara.sqlcipher.backup-recovery-building.v1';
const BACKUP_RECOVERY_NOTIFICATION_STATE_NAME = 'ampara.sqlcipher.backup-notifications.v1';
const BACKUP_RECOVERY_NOTIFICATION_DONE_NAME = 'ampara.sqlcipher.backup-notifications-done.v1';
const BACKUP_RECOVERY_TEMP_SUFFIX = '.backup-restore.tmp';
const BACKUP_RECOVERY_OLD_SUFFIX = '.before-backup-restore';
const KEY_HEX_LENGTH = 64;

function validateKey(key: string): void {
  if (!new RegExp(`^[0-9a-f]{${KEY_HEX_LENGTH}}$`, 'i').test(key)) {
    throw new Error('A chave segura do banco está inválida. Não remova o app; use o backup criptografado para recuperação.');
  }
}

async function verifySqlCipher(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!row?.cipher_version) {
    throw new Error('A criptografia do banco não está disponível nesta build. Seus registros não foram modificados.');
  }
}

async function countExistingTables(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );
  return row?.count ?? 0;
}

async function validateDatabase(db: SQLiteDatabase): Promise<number> {
  // Force one encrypted page read before trusting that this key opens the database.
  await db.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
  const row = await db.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
  if (row?.quick_check !== 'ok') throw new Error('A verificação de integridade do banco falhou.');
  return await countExistingTables(db);
}

async function probePlaintextDatabase(db: SQLiteDatabase): Promise<number | null> {
  try {
    return await countExistingTables(db);
  } catch {
    return null;
  }
}

function getMigrationBackupPath(databasePath: string): string {
  const separator = databasePath.lastIndexOf('/');
  if (separator < 1) throw new Error('O banco antigo não pode ser migrado com segurança.');
  return `${databasePath.slice(0, separator + 1)}${databasePath.slice(separator + 1)}.plaintext-backup`;
}

function getMigrationTemporaryPath(databasePath: string): string {
  const separator = databasePath.lastIndexOf('/');
  if (separator < 1) throw new Error('O banco antigo não pode ser migrado com segurança.');
  const databaseName = databasePath.slice(separator + 1);
  return `${databasePath.slice(0, separator + 1)}${databaseName}.cipher-migration.tmp`;
}

async function openPlaintextBackup(databasePath: string): Promise<{ db: SQLiteDatabase; tableCount: number } | null> {
  const separator = databasePath.lastIndexOf('/');
  const directory = databasePath.slice(0, separator);
  const backupName = `${databasePath.slice(separator + 1)}.plaintext-backup`;
  const backupFile = new File(directory, backupName);
  if (!backupFile.exists) return null;
  const mainFile = new File(databasePath);
  if (!mainFile.exists || mainFile.size === 0) {
    await archiveDatabaseSidecars(databasePath, backupFile.uri);
  }

  let db: SQLiteDatabase;
  try {
    db = await SQLite.openDatabaseAsync(backupName, { useNewConnection: true }, directory);
  } catch {
    return null;
  }
  const tableCount = await probePlaintextDatabase(db);
  let backupIsIntact = false;
  if (tableCount !== null && tableCount > 0) {
    try {
      const result = await db.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
      backupIsIntact = result?.quick_check === 'ok';
    } catch {
      backupIsIntact = false;
    }
  }
  if (tableCount === null || tableCount < 1 || !backupIsIntact) {
    await db.closeAsync();
    return null;
  }
  return { db, tableCount };
}

async function recoverEncryptedTemporaryDatabase(
  databasePath: string,
  key: string,
  currentDatabase: SQLiteDatabase,
): Promise<SQLiteDatabase | null> {
  const separator = databasePath.lastIndexOf('/');
  const directory = databasePath.slice(0, separator);
  const databaseName = databasePath.slice(separator + 1);
  const temporaryName = `${databaseName}.cipher-migration.tmp`;
  const temporaryFile = new File(directory, temporaryName);
  if (!temporaryFile.exists) return null;

  // A verified plaintext recovery copy is the most current source of truth. If it exists, use it
  // to rebuild the temp instead of promoting a potentially stale encrypted temp.
  const plaintextBackup = await openPlaintextBackup(databasePath);
  if (plaintextBackup) {
    await currentDatabase.closeAsync();
    return convertPlaintextDatabase(plaintextBackup.db, key, plaintextBackup.tableCount, databasePath);
  }

  let temporaryDb: SQLiteDatabase | null = null;
  try {
    temporaryDb = await SQLite.openDatabaseAsync(temporaryName, { useNewConnection: true }, directory);
    await temporaryDb.execAsync(`PRAGMA key = "x'${key}'"`);
    await verifySqlCipher(temporaryDb);
    const temporaryTables = await validateDatabase(temporaryDb);
    if (temporaryTables < 1) {
      await temporaryDb.closeAsync();
      return null;
    }
    await temporaryDb.execAsync('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE');
  } catch {
    if (temporaryDb) await temporaryDb.closeAsync().catch(() => undefined);
    return null;
  }

  await temporaryDb.closeAsync();
  deleteDatabaseSidecars(temporaryFile.uri);
  await currentDatabase.closeAsync();
  await temporaryFile.move(new File(databasePath), { overwrite: true });

  let recoveredDb: SQLiteDatabase | null = null;
  try {
    recoveredDb = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true }, directory);
    await recoveredDb.execAsync(`PRAGMA key = "x'${key}'"`);
    await validateDatabase(recoveredDb);
    deleteDatabaseArtifacts(getMigrationBackupPath(databasePath));
    return recoveredDb;
  } catch (error) {
    if (recoveredDb) await recoveredDb.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function convertPlaintextDatabase(
  db: SQLiteDatabase,
  key: string,
  tableCount: number,
  targetPath = db.databasePath,
  migrationBackupPath = getMigrationBackupPath(targetPath),
): Promise<SQLiteDatabase> {
  const sourcePath = db.databasePath;
  const separator = sourcePath.lastIndexOf('/');
  if (separator < 1 || tableCount < 1) throw new Error('O banco antigo não pode ser migrado com segurança.');
  const targetSeparator = targetPath.lastIndexOf('/');
  if (targetSeparator < 1) {
    throw new Error('O banco antigo não pode ser migrado com segurança.');
  }
  const targetDirectory = targetPath.slice(0, targetSeparator);
  const targetDatabaseName = targetPath.slice(targetSeparator + 1);
  const backupFile = new File(migrationBackupPath);
  const sourceFile = new File(sourcePath);
  const temporaryName = `${targetDatabaseName}.cipher-migration.tmp`;
  const temporaryFile = new File(targetDirectory, temporaryName);
  let encryptedDb: SQLiteDatabase | null = null;
  let replacementDb: SQLiteDatabase | null = null;
  let sourceClosed = false;

  try {
    const previousVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    // Consolidate the legacy WAL before exporting its logical database into a new encrypted file.
    await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
    await db.execAsync('PRAGMA journal_mode = DELETE');

    // The source is present and readable here, so discard any stale temp and export from it again.
    if (temporaryFile.exists) temporaryFile.delete();
    deleteDatabaseSidecars(temporaryFile.uri);
    encryptedDb = await SQLite.openDatabaseAsync(temporaryName, { useNewConnection: true }, targetDirectory);
    await encryptedDb.execAsync(`PRAGMA key = "x'${key}'"`);
    await verifySqlCipher(encryptedDb);
    const quotedSourcePath = sourcePath.replace(/'/g, "''");
    await encryptedDb.execAsync(`ATTACH DATABASE '${quotedSourcePath}' AS plaintext KEY ''`);
    try {
      const exportResult = await encryptedDb.getFirstAsync<{ result: number }>(
        `SELECT sqlcipher_export('main', 'plaintext') AS result`,
      );
      if (exportResult?.result !== 0) throw new Error('A exportação SQLCipher não concluiu corretamente.');
    } finally {
      await encryptedDb.execAsync('DETACH DATABASE plaintext');
    }
    await encryptedDb.execAsync(`PRAGMA user_version = ${previousVersion?.user_version ?? 0}`);
    await encryptedDb.execAsync('PRAGMA journal_mode = DELETE');
    const exportedTables = await validateDatabase(encryptedDb);
    if (exportedTables !== tableCount) throw new Error('A verificação da migração não encontrou as mesmas tabelas.');

    if (!encryptedDb) throw new Error('Não foi possível preparar o banco criptografado.');
    await encryptedDb.closeAsync();
    encryptedDb = null;
    await db.closeAsync();
    sourceClosed = true;

    // Refresh an old/partial recovery sibling while the current source remains untouched, then
    // move the source into that durable slot before replacing the main database.
    if (sourcePath !== migrationBackupPath) {
      deleteDatabaseArtifacts(migrationBackupPath);
      await sourceFile.move(backupFile);
      await archiveDatabaseSidecars(sourcePath, migrationBackupPath);
    }
    await temporaryFile.move(new File(targetPath), { overwrite: true });
    replacementDb = await SQLite.openDatabaseAsync(targetDatabaseName, { useNewConnection: true }, targetDirectory);
    await replacementDb.execAsync(`PRAGMA key = "x'${key}'"`);
    await validateDatabase(replacementDb);
    deleteDatabaseArtifacts(migrationBackupPath);
    const readyDatabase = replacementDb;
    replacementDb = null;
    return readyDatabase;
  } catch (error) {
    if (replacementDb) {
      try { await replacementDb.closeAsync(); } catch { /* Preserve the recovery copy and surface the migration error. */ }
    }
    if (encryptedDb) {
      try { await encryptedDb.closeAsync(); } catch { /* Preserve the source and surface the migration error. */ }
    }
    if (!sourceClosed) {
      try { await db.execAsync('PRAGMA journal_mode = WAL'); } catch { /* Opening failed; do not mask the original error. */ }
    }
    // Keep the temporary export: if the move was interrupted, the next launch can verify and reuse it.
    throw error;
  }
}

/**
 * Adds file-level SQLCipher protection while preserving databases from prior plain-SQLite builds.
 * For first-run databases the key is applied before any query. Existing plaintext databases are
 * exported to a verified encrypted replacement while a temporary recovery copy is retained. A
 * missing key for an already encrypted database fails closed instead of creating an empty database.
 */
export async function initializeEncryptedDatabase(db: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (Platform.OS === 'web') return db;
  let replacementDatabase: SQLiteDatabase | null = null;

  try {
  const recoveredDatabase = await finalizePendingBackupRecovery(db);
  if (recoveredDatabase) {
    replacementDatabase = recoveredDatabase;
    await recoveredDatabase.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await retryPendingBackupRecoveryNotifications();
    replacementDatabase = null;
    return recoveredDatabase;
  }
  await verifySqlCipher(db);
  const storedKey = await SecureStore.getItemAsync(DATABASE_KEY_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  const migrationState = await SecureStore.getItemAsync(DATABASE_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  const mainFile = new File(db.databasePath);
  const mainFileIsEmpty = !mainFile.exists || mainFile.size === 0;

  if (storedKey) {
    validateKey(storedKey);
    const recoveredTemp = mainFileIsEmpty
      ? await recoverEncryptedTemporaryDatabase(db.databasePath, storedKey, db)
      : null;
    if (recoveredTemp) {
      db = recoveredTemp;
      replacementDatabase = db;
      await SecureStore.setItemAsync(DATABASE_STATE_NAME, 'ready', {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } else {
      // Recover if the process was interrupted between saving a new key and finishing export.
      // Only retry the export when the existing file can still be read as plaintext.
      const canRecoverMigration = migrationState === 'migration-pending' || migrationState === null || mainFileIsEmpty;
      let plaintextTables = canRecoverMigration
        ? (mainFileIsEmpty ? 0 : await probePlaintextDatabase(db))
        : null;
      let migrationSource = db;
      if (canRecoverMigration && (plaintextTables === null || plaintextTables === 0)) {
        const backupExists = new File(getMigrationBackupPath(db.databasePath)).exists;
        const backup = await openPlaintextBackup(db.databasePath);
        if (backup) {
          await db.closeAsync();
          migrationSource = backup.db;
          plaintextTables = backup.tableCount;
        } else if (mainFileIsEmpty && backupExists) {
          throw new Error('A cópia de recuperação do banco antigo não pôde ser verificada. Mantenha o aparelho e não apague os dados do app.');
        }
      }
      if (mainFileIsEmpty && (plaintextTables ?? 0) === 0 && new File(getMigrationTemporaryPath(db.databasePath)).exists) {
        throw new Error('A cópia cifrada temporária não pôde ser verificada. Mantenha o aparelho e não apague os dados do app.');
      }
      if (plaintextTables !== null && canRecoverMigration) {
        await SecureStore.setItemAsync(DATABASE_STATE_NAME, 'migration-pending', {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        if (plaintextTables > 0) {
          db = await convertPlaintextDatabase(migrationSource, storedKey, plaintextTables, db.databasePath);
          replacementDatabase = db;
        } else {
          await db.execAsync(`PRAGMA key = "x'${storedKey}'"`);
          await validateDatabase(db);
        }
        await SecureStore.setItemAsync(DATABASE_STATE_NAME, 'ready', {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
      } else {
        await db.execAsync(`PRAGMA key = "x'${storedKey}'"`);
        await validateDatabase(db);
        const backupFile = new File(getMigrationBackupPath(db.databasePath));
        if (backupFile.exists) backupFile.delete();
        if (migrationState !== 'ready') {
          await SecureStore.setItemAsync(DATABASE_STATE_NAME, 'ready', {
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
          });
        }
      }
    }
  } else {
    // SQLCipher with no key can read a legacy plaintext database; an already encrypted file cannot.
    // A missing or zero-byte database is a new file, so key it before running any data query.
    let existingTables = mainFileIsEmpty ? 0 : await probePlaintextDatabase(db);
    let migrationSource = db;
    if (existingTables === null || existingTables === 0) {
      const backupExists = new File(getMigrationBackupPath(db.databasePath)).exists;
      const backup = await openPlaintextBackup(db.databasePath);
      if (backup) {
        await db.closeAsync();
        migrationSource = backup.db;
        existingTables = backup.tableCount;
      } else if (mainFileIsEmpty && backupExists) {
        throw new Error('A cópia de recuperação do banco antigo não pôde ser verificada. Mantenha o aparelho e não apague os dados do app.');
      }
    }
    if (existingTables === null) {
      throw new Error('Não foi possível localizar a chave deste banco criptografado. O arquivo atual não foi alterado. Use a recuperação por backup somente se ele contiver os registros que deseja manter.');
    }
    if (mainFileIsEmpty && existingTables === 0 && new File(getMigrationTemporaryPath(db.databasePath)).exists) {
      throw new Error('A cópia cifrada temporária precisa da chave original. Mantenha o aparelho e não apague os dados do app.');
    }

    const key = Array.from(await Crypto.getRandomBytesAsync(KEY_HEX_LENGTH / 2), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');

    // Persist a journal state first, so interrupted export can be recovered on next launch.
    await SecureStore.setItemAsync(DATABASE_STATE_NAME, 'migration-pending', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await SecureStore.setItemAsync(DATABASE_KEY_NAME, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    if (existingTables > 0) {
      db = await convertPlaintextDatabase(migrationSource, key, existingTables, db.databasePath);
      replacementDatabase = db;
    } else {
      await db.execAsync(`PRAGMA key = "x'${key}'"`);
      await validateDatabase(db);
    }
    await SecureStore.setItemAsync(DATABASE_STATE_NAME, 'ready', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  }

  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await retryPendingBackupRecoveryNotifications();
  return db;
  } catch (error) {
    if (replacementDatabase) await replacementDatabase.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function openEncryptedDatabaseConnection(databasePath: string): Promise<SQLiteDatabase> {
  const key = await SecureStore.getItemAsync(DATABASE_KEY_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  return openDatabaseConnectionWithKey(databasePath, key);
}

async function openDatabaseConnectionWithKey(databasePath: string, key: string | null): Promise<SQLiteDatabase> {
  const separator = databasePath.lastIndexOf('/');
  if (separator < 1) throw new Error('Não foi possível abrir uma conexão segura com o banco.');
  const directory = databasePath.slice(0, separator);
  const databaseName = databasePath.slice(separator + 1);
  if (!key) throw new Error('A chave do banco não está disponível. Nenhum registro foi alterado.');
  validateKey(key);

  const connection = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true }, directory);
  try {
    await verifySqlCipher(connection);
    await connection.execAsync(`PRAGMA key = "x'${key}'"`);
    await validateDatabase(connection);
    await connection.execAsync('PRAGMA foreign_keys = ON');
    return connection;
  } catch (error) {
    await connection.closeAsync().catch(() => undefined);
    throw error;
  }
}

type ActiveBackupRecovery = { id: string; previousIds: string[] };

function parseActiveBackupRecovery(value: string | null): ActiveBackupRecovery | null {
  if (!value) return null;
  const [status, id, previousIds] = value.split('|');
  if (status !== 'ready' || !id) return null;
  return { id, previousIds: previousIds ? previousIds.split(',').filter(Boolean) : [] };
}

function recoveryKeyName(id: string): string {
  return `${BACKUP_RECOVERY_KEY_PREFIX}${id}`;
}

async function discardBackupRecoveryStage(databasePath: string, id: string): Promise<void> {
  deleteDatabaseArtifacts(getBackupRecoveryTemporaryPath(databasePath, id));
  await SecureStore.deleteItemAsync(recoveryKeyName(id));
}

export async function beginBackupDatabaseRecovery(databasePath: string, key: string): Promise<string> {
  validateKey(key);
  const activeRecovery = parseActiveBackupRecovery(await SecureStore.getItemAsync(BACKUP_RECOVERY_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  }));
  const unfinishedId = await SecureStore.getItemAsync(BACKUP_RECOVERY_BUILDING_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (unfinishedId && unfinishedId !== activeRecovery?.id) {
    await discardBackupRecoveryStage(databasePath, unfinishedId);
  }
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(recoveryKeyName(id), key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  await SecureStore.setItemAsync(BACKUP_RECOVERY_BUILDING_NAME, id, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  getBackupRecoveryTemporaryPath(databasePath, id);
  return id;
}

export async function markBackupDatabaseRecoveryReady(id: string): Promise<void> {
  const activeRecovery = parseActiveBackupRecovery(await SecureStore.getItemAsync(BACKUP_RECOVERY_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  }));
  const previousIds = activeRecovery ? [activeRecovery.id, ...activeRecovery.previousIds] : [];
  await SecureStore.setItemAsync(BACKUP_RECOVERY_STATE_NAME, `ready|${id}|${previousIds.join(',')}`, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  const unfinishedId = await SecureStore.getItemAsync(BACKUP_RECOVERY_BUILDING_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (unfinishedId === id) await SecureStore.deleteItemAsync(BACKUP_RECOVERY_BUILDING_NAME).catch(() => undefined);
}

export async function hasPendingBackupRecoveryNotifications(): Promise<boolean> {
  return (await getBackupRecoveryNotificationStatus()) !== 'none';
}

export async function getBackupRecoveryNotificationStatus(): Promise<'none' | 'pending' | 'manual'> {
  const value = await SecureStore.getItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (!value) return 'none';
  try {
    const record = JSON.parse(value) as { status?: string };
    return record.status === 'manual' ? 'manual' : record.status === 'pending' ? 'pending' : 'none';
  } catch {
    return 'none';
  }
}

export async function retryPendingBackupRecoveryNotifications(): Promise<boolean> {
  const notificationState = await SecureStore.getItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (!notificationState) return true;
  let record: { status: 'pending' | 'manual'; recoveryId: string; ids: string[] };
  try {
    record = JSON.parse(notificationState) as typeof record;
  } catch {
    return false;
  }
  if (record.status === 'manual') return false;
  const completedFor = await SecureStore.getItemAsync(BACKUP_RECOVERY_NOTIFICATION_DONE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (completedFor === record.recoveryId) {
    await SecureStore.deleteItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME);
    return true;
  }
  try {
    const remainingIds = [...record.ids];
    while (remainingIds.length > 0) {
      await Notifications.cancelScheduledNotificationAsync(remainingIds[0]);
      remainingIds.shift();
      record = { ...record, ids: [...remainingIds] };
      await SecureStore.setItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME, JSON.stringify(record), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    }
    await SecureStore.setItemAsync(BACKUP_RECOVERY_NOTIFICATION_DONE_NAME, record.recoveryId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await SecureStore.deleteItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME);
    return true;
  } catch {
    return false;
  }
}

export function getBackupRecoveryTemporaryPath(databasePath: string, id: string): string {
  const separator = databasePath.lastIndexOf('/');
  if (separator < 1) throw new Error('Não foi possível preparar a recuperação do banco.');
  return `${databasePath.slice(0, separator + 1)}${databasePath.slice(separator + 1)}.${id}${BACKUP_RECOVERY_TEMP_SUFFIX}`;
}

function deleteDatabaseSidecars(databasePath: string): void {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = new File(`${databasePath}${suffix}`);
    if (sidecar.exists) sidecar.delete();
  }
}

function deleteDatabaseArtifacts(databasePath: string): void {
  const databaseFile = new File(databasePath);
  if (databaseFile.exists) databaseFile.delete();
  deleteDatabaseSidecars(databasePath);
}

async function archiveDatabaseSidecars(databasePath: string, archivePath: string): Promise<void> {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = new File(`${databasePath}${suffix}`);
    if (!sidecar.exists) continue;
    const archivedSidecar = new File(`${archivePath}${suffix}`);
    if (archivedSidecar.exists) archivedSidecar.delete();
    await sidecar.move(archivedSidecar);
  }
}

async function finalizePendingBackupRecovery(database: SQLiteDatabase): Promise<SQLiteDatabase | null> {
  const state = await SecureStore.getItemAsync(BACKUP_RECOVERY_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  const activeRecovery = parseActiveBackupRecovery(state);
  if (!activeRecovery) return null;
  const stagedKey = await SecureStore.getItemAsync(recoveryKeyName(activeRecovery.id), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  const key = stagedKey ?? await SecureStore.getItemAsync(DATABASE_KEY_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (!key) throw new Error('A recuperação do backup foi interrompida. Mantenha o aparelho e tente restaurar novamente.');
  validateKey(key);

  const databasePath = database.databasePath;
  if (databasePath.lastIndexOf('/') < 1) throw new Error('Não foi possível finalizar a recuperação do banco.');
  const temporaryPath = getBackupRecoveryTemporaryPath(databasePath, activeRecovery.id);
  const temporaryFile = new File(temporaryPath);
  const originalFile = new File(`${databasePath}${BACKUP_RECOVERY_OLD_SUFFIX}`);
  let databaseIsRecovered = false;

  try {
    await database.execAsync(`PRAGMA key = "x'${key}'"`);
    const tables = await validateDatabase(database);
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    databaseIsRecovered = tables > 0 && (version?.user_version ?? 0) >= 2;
  } catch {
    databaseIsRecovered = false;
  }

  if (databaseIsRecovered) {
    return finalizeBackupRecoveryState(database, key, originalFile, databasePath, activeRecovery);
  }

  if (!temporaryFile.exists) {
    throw new Error('O arquivo de recuperação não foi encontrado. Mantenha o aparelho e tente selecionar o backup novamente.');
  }

  let temporaryDb: SQLiteDatabase | null = null;
  try {
    temporaryDb = await openDatabaseConnectionWithKey(temporaryPath, key);
    const tables = await validateDatabase(temporaryDb);
    const version = await temporaryDb.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (tables < 1 || (version?.user_version ?? 0) < 2) {
      throw new Error('O arquivo temporário de recuperação não está completo.');
    }
    await temporaryDb.execAsync('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE');
    await temporaryDb.closeAsync();
    temporaryDb = null;
    await database.closeAsync().catch(() => undefined);

    const currentFile = new File(databasePath);
    const hasWal = new File(`${databasePath}-wal`).exists;
    if (currentFile.exists && currentFile.size > 0) {
      if (originalFile.exists) originalFile.delete();
      await currentFile.move(originalFile);
    } else if (currentFile.exists && !originalFile.exists && hasWal) {
      await currentFile.move(originalFile);
    } else if (currentFile.exists) {
      currentFile.delete();
    }
    await archiveDatabaseSidecars(databasePath, originalFile.uri);
    deleteDatabaseSidecars(temporaryPath);
    await temporaryFile.move(new File(databasePath), { overwrite: true });
    const recoveredDatabase = await openDatabaseConnectionWithKey(databasePath, key);
    try {
      await validateDatabase(recoveredDatabase);
      return await finalizeBackupRecoveryState(recoveredDatabase, key, originalFile, databasePath, activeRecovery);
    } catch (error) {
      await recoveredDatabase.closeAsync().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (temporaryDb) await temporaryDb.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function finalizeBackupRecoveryState(
  database: SQLiteDatabase,
  key: string,
  originalFile: File,
  databasePath: string,
  activeRecovery: ActiveBackupRecovery,
): Promise<SQLiteDatabase> {
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  await SecureStore.setItemAsync(DATABASE_STATE_NAME, 'ready', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  await prepareRecoveryNotificationCleanup(activeRecovery.id);
  await retryPendingBackupRecoveryNotifications();
  deleteDatabaseArtifacts(originalFile.uri);
  for (const previousId of activeRecovery.previousIds) {
    await discardBackupRecoveryStage(databasePath, previousId);
  }
  deleteDatabaseArtifacts(getBackupRecoveryTemporaryPath(databasePath, activeRecovery.id));
  const unfinishedId = await SecureStore.getItemAsync(BACKUP_RECOVERY_BUILDING_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (unfinishedId && (unfinishedId === activeRecovery.id || activeRecovery.previousIds.includes(unfinishedId))) {
    await SecureStore.deleteItemAsync(BACKUP_RECOVERY_BUILDING_NAME);
  }
  // The normal database key is committed before the staged key is removed. If the following
  // state deletion is interrupted, finalization can verify the main DB with the normal key.
  await SecureStore.deleteItemAsync(recoveryKeyName(activeRecovery.id));
  await SecureStore.deleteItemAsync(BACKUP_RECOVERY_STATE_NAME);
  return database;
}

async function prepareRecoveryNotificationCleanup(recoveryId: string): Promise<void> {
  const completedFor = await SecureStore.getItemAsync(BACKUP_RECOVERY_NOTIFICATION_DONE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (completedFor === recoveryId) return;
  const current = await SecureStore.getItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (current) {
    try {
      const record = JSON.parse(current) as { status?: string; recoveryId?: string };
      if (record.recoveryId === recoveryId) return;
    } catch {
      // Replace an unreadable marker with a fresh snapshot of this recovery's old notifications.
    }
  }
  try {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    await SecureStore.setItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME, JSON.stringify({
      status: 'pending', recoveryId, ids: requests.map((request) => request.identifier),
    }), { keychainAccessible: SecureStore.WHEN_UNLOCKED });
  } catch {
    // Do not cancel notifications created after this restore when scheduled-ID discovery fails.
    await SecureStore.setItemAsync(BACKUP_RECOVERY_NOTIFICATION_STATE_NAME, JSON.stringify({
      status: 'manual', recoveryId, ids: [],
    }), { keychainAccessible: SecureStore.WHEN_UNLOCKED });
  }
}

/**
 * Runs work in a separately keyed SQLCipher connection. Expo's built-in
 * withExclusiveTransactionAsync creates an unkeyed connection before invoking its callback,
 * so setting the key on the provider's database is not sufficient for SQLCipher.
 */
export async function withEncryptedExclusiveTransaction<T>(
  databasePath: string,
  task: (transaction: SQLiteDatabase) => Promise<T>,
  keyOverride?: string,
): Promise<T> {
  const transaction = keyOverride
    ? await openDatabaseConnectionWithKey(databasePath, keyOverride)
    : await openEncryptedDatabaseConnection(databasePath);
  let transactionStarted = false;
  try {
    await transaction.execAsync('BEGIN EXCLUSIVE');
    transactionStarted = true;
    const result = await task(transaction);
    await transaction.execAsync('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try { await transaction.execAsync('ROLLBACK'); } catch { /* Preserve the original transaction error. */ }
    }
    throw error;
  } finally {
    await transaction.closeAsync().catch(() => undefined);
  }
}
