import { afterEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => undefined),
}));

import * as SplashScreen from 'expo-splash-screen';
import { hideNativeSplashScreen } from '@/src/splashScreen';

describe('native splash screen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hides the native splash after the root layout has rendered', async () => {
    await hideNativeSplashScreen();

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('does not block startup if hiding the native splash fails', async () => {
    jest.mocked(SplashScreen.hideAsync).mockRejectedValueOnce(new Error('native failure'));

    await expect(hideNativeSplashScreen()).resolves.toBeUndefined();
  });
});
