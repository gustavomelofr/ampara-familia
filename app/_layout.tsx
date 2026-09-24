import { DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

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
      <RootNavigator />
    </SQLiteProvider>
  );
}

function RootNavigator() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getCareProfile(db)
      .then((profile) => {
        if (active) {
          setReady(true);
          if (!profile) router.replace('/onboarding');
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, [db, router]);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.paper }}>
        <ActivityIndicator color={theme.colors.forest} />
      </View>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.paper } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="event/form" options={{ title: 'Compromisso', presentation: 'modal' }} />
        <Stack.Screen name="task/form" options={{ title: 'Tarefa', presentation: 'modal' }} />
        <Stack.Screen name="expense/new" options={{ title: 'Novo gasto', presentation: 'modal' }} />
        <Stack.Screen name="document/new" options={{ title: 'Novo documento', presentation: 'modal' }} />
        <Stack.Screen name="medication/new" options={{ title: 'Novo medicamento', presentation: 'modal' }} />
        <Stack.Screen name="share-summary" options={{ title: 'Compartilhar resumo', presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacidade e dados' }} />
        <Stack.Screen name="care-profile" options={{ title: 'Pessoa acompanhada' }} />
        <Stack.Screen name="documents" options={{ title: 'Documentos' }} />
        <Stack.Screen name="medications" options={{ title: 'Medicamentos' }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
