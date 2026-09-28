import { DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { WebTitle } from '@/src/components/WebTitle';
import { DatabaseProvider, useAppDatabase } from '@/src/database/DatabaseProvider';
import { hideNativeSplashScreen } from '@/src/splashScreen';
import {
  getBackupRecoveryNotificationStatus, retryPendingBackupRecoveryNotifications,
} from '@/src/database/encryption';
import { getCareProfile } from '@/src/database/repository';
import { theme } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    void hideNativeSplashScreen();
  }, []);

  return (
    <>
      <WebTitle />
      <DatabaseProvider><RootNavigator /></DatabaseProvider>
    </>
  );
}

function RootNavigator() {
  const db = useAppDatabase();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [notificationCleanupStatus, setNotificationCleanupStatus] = useState<'none' | 'pending' | 'manual'>('none');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    void Promise.all([getCareProfile(db), getBackupRecoveryNotificationStatus()])
      .then(([profile, cleanupStatus]) => {
        if (!active) return;
        setNotificationCleanupStatus(cleanupStatus);
        setStatus('ready');
        if (!profile) router.replace('/onboarding');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => { active = false; };
  }, [db, router, attempt]);

  if (status === 'loading') {
    return <AppScreen><AppText variant="title">Abrindo seus registros</AppText><AppText tone="muted">Tudo continua neste aparelho.</AppText></AppScreen>;
  }
  if (status === 'error') {
    return (
      <AppScreen>
        <ScreenMessage tone="error" title="Não foi possível abrir os registros" message="O banco seguro não respondeu. Seus arquivos permanecem neste aparelho; tente novamente." />
        <PrimaryButton title="Tentar novamente" onPress={() => setAttempt((value) => value + 1)} />
      </AppScreen>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <View style={{ flex: 1 }}>
        {notificationCleanupStatus !== 'none' ? (
          <ScreenMessage
            title="Revise os lembretes locais"
            message={notificationCleanupStatus === 'pending'
              ? 'Alguns lembretes anteriores à restauração podem continuar agendados. Tente limpar esses avisos e recrie somente os necessários.'
              : 'Não foi possível identificar todos os avisos anteriores. Revise a agenda e as notificações do aparelho antes de criar novos lembretes.'}
            actionLabel={notificationCleanupStatus === 'pending' ? 'Tentar limpar avisos antigos' : undefined}
            onAction={notificationCleanupStatus === 'pending'
              ? () => void retryPendingBackupRecoveryNotifications().then(getBackupRecoveryNotificationStatus).then(setNotificationCleanupStatus)
              : undefined}
          />
        ) : null}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.paper } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="event/form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="task/form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="expense/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="document/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="medication/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="share-summary" options={{ presentation: 'modal' }} />
          <Stack.Screen name="expenses" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="care-profile" />
          <Stack.Screen name="documents" />
          <Stack.Screen name="medications" />
        </Stack>
        <StatusBar style="dark" />
      </View>
    </ThemeProvider>
  );
}
