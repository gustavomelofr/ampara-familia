import * as SecureStore from 'expo-secure-store';

const DATABASE_KEY_NAME = 'ampara.sqlcipher.key.v1';
const DATABASE_STATE_NAME = 'ampara.sqlcipher.state.v1';
const PLAINTEXT_BRIDGE_STATE_NAME = 'ampara.sqlcipher.plaintext-bridge.v1';
const BACKUP_RECOVERY_STATE_NAME = 'ampara.sqlcipher.backup-recovery-state.v1';
const BACKUP_RECOVERY_KEY_PREFIX = 'ampara.sqlcipher.backup-recovery-key.v1.';
const BACKUP_RECOVERY_BUILDING_NAME = 'ampara.sqlcipher.backup-recovery-building.v1';

function recoveryIds(value: string | null): string[] {
  if (!value) return [];
  const [, id, previousIds] = value.split('|');
  if (!id) return [];
  return [...new Set([id, ...(previousIds ? previousIds.split(',') : [])].filter(Boolean))];
}

/** Removes old SQLCipher keys only after the database has passed SQLite integrity checks. */
export async function removeLegacySqlCipherSecrets(): Promise<void> {
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED };
  const [recoveryState, buildingId] = await Promise.all([
    SecureStore.getItemAsync(BACKUP_RECOVERY_STATE_NAME, options).catch(() => null),
    SecureStore.getItemAsync(BACKUP_RECOVERY_BUILDING_NAME, options).catch(() => null),
  ]);

  const names = new Set([
    DATABASE_KEY_NAME,
    DATABASE_STATE_NAME,
    PLAINTEXT_BRIDGE_STATE_NAME,
    BACKUP_RECOVERY_STATE_NAME,
    BACKUP_RECOVERY_BUILDING_NAME,
  ]);
  for (const id of [...recoveryIds(recoveryState), ...(buildingId ? [buildingId] : [])]) {
    names.add(`${BACKUP_RECOVERY_KEY_PREFIX}${id}`);
  }

  await Promise.all([...names].map((name) => SecureStore.deleteItemAsync(name).catch(() => undefined)));
}
