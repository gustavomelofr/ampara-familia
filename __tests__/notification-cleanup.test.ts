import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockSecureStore = new Map<string, string>();
const mockCancelScheduledNotification = jest.fn(async (_id: string) => undefined);

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 1,
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockSecureStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecureStore.delete(key); }),
}));
jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: (id: string) => mockCancelScheduledNotification(id),
}));

import type { SQLiteDatabase } from 'expo-sqlite';
import { retryPendingNotificationCleanup } from '@/src/database/notificationCleanup';

describe('legacy local reminder cleanup', () => {
  afterEach(() => {
    mockSecureStore.clear();
    jest.clearAllMocks();
  });

  it('cancels orphaned reminders but keeps reminders still linked to a local event', async () => {
    mockSecureStore.set('ampara.restore.pending-notification-ids.v1', JSON.stringify(['linked', 'orphaned']));
    const database = {
      getFirstAsync: jest.fn(async (_sql: string, id: string) => id === 'linked' ? { id: 1 } : null),
    } as unknown as SQLiteDatabase;

    await expect(retryPendingNotificationCleanup(database)).resolves.toBe(true);

    expect(mockCancelScheduledNotification).toHaveBeenCalledTimes(1);
    expect(mockCancelScheduledNotification).toHaveBeenCalledWith('orphaned');
    expect(mockSecureStore.has('ampara.restore.pending-notification-ids.v1')).toBe(false);
  });

  it('keeps a reminder queued for a safe retry if the operating system cannot cancel it', async () => {
    mockSecureStore.set('ampara.restore.pending-notification-ids.v1', JSON.stringify(['orphaned']));
    mockCancelScheduledNotification.mockRejectedValueOnce(new Error('notifications unavailable'));
    const database = {
      getFirstAsync: jest.fn(async () => null),
    } as unknown as SQLiteDatabase;

    await expect(retryPendingNotificationCleanup(database)).resolves.toBe(false);
    expect(mockSecureStore.get('ampara.restore.pending-notification-ids.v1')).toBe(JSON.stringify(['orphaned']));
  });
});
