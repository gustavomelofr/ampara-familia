import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <AppText accessibilityRole="header" variant="title">Essa tela não existe.</AppText>

        <Link href="/" style={styles.link}>
          <AppText tone="forest" variant="label">Voltar ao início</AppText>
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
