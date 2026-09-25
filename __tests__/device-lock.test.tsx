import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, Platform, Text } from 'react-native';

import { DeviceLock } from '@/src/components/DeviceLock';
import { WebTitle } from '@/src/components/WebTitle';

const mockAuthenticateAsync = jest.fn(async () => ({ success: true }));
const mockGetEnrolledLevelAsync = jest.fn(async () => 3);
const mockPreventScreenCaptureAsync = jest.fn(async (_key?: string) => undefined);
const mockEnableAppSwitcherProtectionAsync = jest.fn(async (_intensity?: number) => undefined);
let onAppStateChange: ((state: string) => void) | undefined;

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0 },
  authenticateAsync: () => mockAuthenticateAsync(),
  getEnrolledLevelAsync: () => mockGetEnrolledLevelAsync(),
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: (key: string) => mockPreventScreenCaptureAsync(key),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
  enableAppSwitcherProtectionAsync: (intensity: number) => mockEnableAppSwitcherProtectionAsync(intensity),
  disableAppSwitcherProtectionAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => undefined) }));
jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, listener: (state: string) => void) => {
  onAppStateChange = listener;
  return { remove: () => { onAppStateChange = undefined; } };
}) as typeof AppState.addEventListener);

const originalPlatform = Platform.OS;
afterEach(() => {
  Platform.OS = originalPlatform;
  mockAuthenticateAsync.mockClear();
  mockGetEnrolledLevelAsync.mockClear();
  mockPreventScreenCaptureAsync.mockClear();
  mockEnableAppSwitcherProtectionAsync.mockClear();
  onAppStateChange = undefined;
});

describe('native access gate', () => {
  it('never mounts private content until device authentication succeeds, then locks on background', async () => {
    Platform.OS = 'ios';
    const view = await render(<DeviceLock><Text testID="private-content">Registros familiares</Text></DeviceLock>);
    expect(view.queryByTestId('private-content')).toBeNull();
    await waitFor(() => expect(view.getByText('Desbloquear')).toBeTruthy());
    expect(mockPreventScreenCaptureAsync).toHaveBeenCalledWith('ampara-private-data');
    expect(mockEnableAppSwitcherProtectionAsync).toHaveBeenCalledWith(0.85);
    await fireEvent.press(view.getByText('Desbloquear'));
    await waitFor(() => expect(view.getByTestId('private-content')).toBeTruthy());
    await act(async () => { onAppStateChange?.('background'); });
    await waitFor(() => expect(view.getByText('Desbloquear')).toBeTruthy());
  });

  it('fails closed when the device has no enrolled passcode', async () => {
    Platform.OS = 'ios';
    mockGetEnrolledLevelAsync.mockImplementationOnce(async () => 0);
    const view = await render(<DeviceLock><Text testID="private-content">Registros familiares</Text></DeviceLock>);
    await waitFor(() => expect(view.getByText('Desbloquear')).toBeTruthy());
    await fireEvent.press(view.getByText('Desbloquear'));
    await waitFor(() => expect(view.getByText(/Ative o código de desbloqueio/)).toBeTruthy());
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    expect(view.queryByTestId('private-content')).toBeNull();
  });

  it('does not expose the local database on unsupported web preview', async () => {
    Platform.OS = 'web';
    const view = await render(<DeviceLock><Text testID="private-content">Registros familiares</Text></DeviceLock>);
    expect(view.queryByTestId('private-content')).toBeNull();
    expect(mockPreventScreenCaptureAsync).not.toHaveBeenCalled();
  });

  it('keeps private content closed and offers retry if capture protection fails', async () => {
    Platform.OS = 'android';
    mockPreventScreenCaptureAsync.mockRejectedValueOnce(new Error('native protection unavailable'));
    const view = await render(<DeviceLock><Text testID="private-content">Registros familiares</Text></DeviceLock>);

    await waitFor(() => expect(view.getByText('Tentar novamente')).toBeTruthy());
    expect(view.getByText(/Não foi possível iniciar a proteção de captura/)).toBeTruthy();
    expect(view.queryByTestId('private-content')).toBeNull();
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });
});

describe('native metadata', () => {
  it('does not mount Expo Head without a hosted handoff origin', () => {
    expect(WebTitle()).toBeNull();
  });
});
