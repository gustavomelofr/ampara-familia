import type { PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/src/theme';

type AppScreenProps = PropsWithChildren<{ scroll?: boolean; bottomInset?: number }>;

export function AppScreen({ children, scroll = true, bottomInset = 34 }: AppScreenProps) {
  const contentStyle = [styles.content, { paddingBottom: bottomInset + 12 }];
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={contentStyle}
      keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={contentStyle}>{children}</View>
  );

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.paper },
  content: { flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34 },
});
