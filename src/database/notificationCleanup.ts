import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

const PENDING_IDS_NAME = 'ampara.restore.pending-notification-ids.v1';
const LEGACY_RECOVERY_NOTIFICATION_STATE_NAME = 'ampara.sqlcipher.backup-notifications.v1';
const LEGACY_RECOVERY_NOTIFICATION_DONE_NAME = 'ampara.sqlcipher.backup-notifications-done.v1';

async function readPendingIds(): Promise<string[]> {
  const serialized = await SecureStore.getItemAsync(PENDING_IDS_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  if (!serialized) return [];
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
    throw new Error('A lista de lembretes pendentes está inválida.');
  }
  return [...new Set(parsed)];
}

/** Cancels only IDs no longer referenced by the database; retries are safe after app termination. */
export async function retryPendingNotificationCleanup(
  database: SQLiteDatabase,
): Promise<boolean> {
  let pending: string[];
  try {
    pending = await readPendingIds();
  } catch {
    return false;
  }
  if (pending.length === 0) return true;

  const remaining: string[] = [];
  for (const notificationId of pending) {
    try {
      const stillLinked = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM care_events WHERE notification_id = ? LIMIT 1',
        notificationId,
      );
      if (stillLinked) continue;
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      remaining.push(notificationId);
    }
  }

  try {
    if (remaining.length > 0) {
      await SecureStore.setItemAsync(PENDING_IDS_NAME, JSON.stringify(remaining), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
      return false;
    }
    await SecureStore.deleteItemAsync(PENDING_IDS_NAME);
    return true;
  } catch {
    return false;
  }
}

export async function getPendingLegacyNotificationCleanupStatus(): Promise<'none' | 'pending' | 'manual'> {
  const value = await SecureStore.getItemAsync(LEGACY_RECOVERY_NOTIFICATION_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  }).catch(() => null);
  if (!value) return 'none';
  try {
    const record = JSON.parse(value) as { status?: string };
    return record.status === 'manual' ? 'manual' : record.status === 'pending' ? 'pending' : 'none';
  } catch {
    return 'none';
  }
}

export async function retryPendingLegacyNotificationCleanup(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(LEGACY_RECOVERY_NOTIFICATION_STATE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  }).catch(() => null);
  if (!value) return true;

  let record: { status: 'pending' | 'manual'; recoveryId: string; ids: string[] };
  try {
    record = JSON.parse(value) as typeof record;
  } catch {
    return false;
  }
  if (record.status === 'manual') return false;

  const completedFor = await SecureStore.getItemAsync(LEGACY_RECOVERY_NOTIFICATION_DONE_NAME, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  }).catch(() => null);
  if (completedFor === record.recoveryId) {
    await SecureStore.deleteItemAsync(LEGACY_RECOVERY_NOTIFICATION_STATE_NAME).catch(() => undefined);
    return true;
  }

  try {
    const remainingIds = [...record.ids];
    while (remainingIds.length > 0) {
      await Notifications.cancelScheduledNotificationAsync(remainingIds[0]);
      remainingIds.shift();
      record = { ...record, ids: [...remainingIds] };
      await SecureStore.setItemAsync(LEGACY_RECOVERY_NOTIFICATION_STATE_NAME, JSON.stringify(record), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    }
    await SecureStore.setItemAsync(LEGACY_RECOVERY_NOTIFICATION_DONE_NAME, record.recoveryId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await SecureStore.deleteItemAsync(LEGACY_RECOVERY_NOTIFICATION_STATE_NAME);
    return true;
  } catch {
    return false;
  }
}
