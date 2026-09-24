import { DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { PageHeader } from '@/src/components/PageHeader';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { getCareProfile } from '@/src/database/repository';
import { DATABASE_NAME, migrateDatabase } from '@/src/database/schema';
import { theme } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <>
        <Head><title>Ampara Família</title></Head>
        <RootNavigator />
      </>
    </SQLiteProvider>
  );
}

function RootNavigator() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    void getCareProfile(db)
      .then((profile) => {
        if (active) {
          setStatus('ready');
          if (!profile) router.replace('/onboarding');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => { active = false; };
  }, [db, retry, router]);

  useEffect(() => {
    if (status === 'loading') return;
    void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') {
    return (
      <AppScreen scroll={false} bottomInset={0}>
        <View style={styles.loading}>
          <View style={styles.mark}><AppText tone="surface" variant="title">A</AppText></View>
          <AppText variant="title">Abrindo seus registros</AppText>
          <AppText tone="muted">Tudo continua neste aparelho.</AppText>
          <View style={styles.skeleton} />
          <View style={[styles.skeleton, styles.skeletonShort]} />
        </View>
      </AppScreen>
    );
  }

  if (status === 'error') {
    return (
      <AppScreen>
        <PageHeader eyebrow="AMPARA FAMÍLIA" title="Não foi possível abrir os registros." subtitle="Os dados permanecem neste aparelho. Tente carregar novamente." />
        <ScreenMessage tone="error" title="O armazenamento não respondeu" message="Feche outros apps que estejam usando o aparelho e tente novamente." actionLabel="Tentar novamente" onAction={() => setRetry((attempt) => attempt + 1)} />
      </AppScreen>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
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
    </ThemeProvider>
  );
}

const styles = {
  loading: { flex: 1, justifyContent: 'center' as const, gap: 10, maxWidth: 340, width: '100%' as const, alignSelf: 'center' as const },
  mark: { width: 48, height: 48, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: theme.colors.forest, marginBottom: 12 },
  skeleton: { height: 13, borderRadius: 7, backgroundColor: theme.colors.forestSoft, marginTop: 14 },
  skeletonShort: { width: '62%' as const, marginTop: 0 },
};
