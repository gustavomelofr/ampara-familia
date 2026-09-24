import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { PageHeader } from '@/src/components/PageHeader';
import { theme } from '@/src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <PageHeader eyebrow="AMPARA FAMÍLIA" title="Essa tela não existe." subtitle="O endereço pode ter mudado ou não estar disponível." />
        <Link href="/" style={styles.link}>
          <AppText tone="forest" variant="label">Ir para Hoje</AppText>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.paper,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
