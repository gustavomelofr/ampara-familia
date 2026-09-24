import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

type ScreenMessageProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
};

export function ScreenMessage({ title, message, actionLabel, onAction, tone = 'neutral' }: ScreenMessageProps) {
  return (
    <View
      style={[styles.wrap, tone === 'error' && styles.error]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}>
      <AppText accessibilityRole="header" variant="title">{title}</AppText>
      <AppText tone="muted">{message}</AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.action}>
          <AppText tone="forest" variant="label">{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingVertical: 22, gap: 8 },
  error: { borderTopColor: theme.colors.clay },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 2 },
});
