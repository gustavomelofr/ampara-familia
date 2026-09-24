import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/src/theme';

type AppScreenProps = PropsWithChildren<{ scroll?: boolean; bottomInset?: number }>;

export function AppScreen({ children, scroll = true, bottomInset = 34 }: AppScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return <SafeAreaView edges={['top']} style={styles.safe}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.paper },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 34 },
});
