import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 1,
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecureStore.delete(key); }),
}));

import * as SecureStore from 'expo-secure-store';
import { removeLegacySqlCipherSecrets } from '@/src/database/legacyEncryptionCleanup';

describe('legacy SQLCipher secret cleanup', () => {
  afterEach(() => {
    mockSecureStore.clear();
    jest.clearAllMocks();
  });

  it('removes SQLCipher keys and recovery keys after the local database is verified', async () => {
    mockSecureStore.set('ampara.sqlcipher.key.v1', 'legacy-key');
    mockSecureStore.set('ampara.sqlcipher.state.v1', 'ready');
    mockSecureStore.set('ampara.sqlcipher.plaintext-bridge.v1', 'pending');
    mockSecureStore.set('ampara.sqlcipher.backup-recovery-state.v1', 'ready|active-id|previous-id');
    mockSecureStore.set('ampara.sqlcipher.backup-recovery-building.v1', 'building-id');
    mockSecureStore.set('ampara.sqlcipher.backup-recovery-key.v1.active-id', 'active-key');
    mockSecureStore.set('ampara.sqlcipher.backup-recovery-key.v1.previous-id', 'previous-key');
    mockSecureStore.set('ampara.sqlcipher.backup-recovery-key.v1.building-id', 'building-key');

    await removeLegacySqlCipherSecrets();

    expect(mockSecureStore.size).toBe(0);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(8);
  });

  it('does not block app opening if the keychain cannot remove an obsolete key', async () => {
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(removeLegacySqlCipherSecrets()).resolves.toBeUndefined();
  });
});
