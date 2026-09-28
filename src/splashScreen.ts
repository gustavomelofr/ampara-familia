import * as SplashScreen from 'expo-splash-screen';

// Keep the native splash visible only until React has rendered the local loading screen.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export async function hideNativeSplashScreen(): Promise<void> {
  try {
    await SplashScreen.hideAsync();
  } catch {
    // A native splash can already be hidden by the time the root layout mounts.
  }
}
