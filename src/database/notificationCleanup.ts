import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

const PENDING_IDS_NAME = 'ampara.restore.pending-notification-ids.v1';

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

export async function stagePendingNotificationCleanup(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  const existing = await readPendingIds();
  await SecureStore.setItemAsync(PENDING_IDS_NAME, JSON.stringify([...new Set([...existing, ...notificationIds])]), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
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
