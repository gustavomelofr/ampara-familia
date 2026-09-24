import type { PropsWithChildren } from 'react';
import { Text, type TextProps, StyleSheet } from 'react-native';

import { theme } from '@/src/theme';

type AppTextProps = PropsWithChildren<TextProps & { tone?: 'ink' | 'muted' | 'forest' | 'clay' | 'danger' | 'warning' | 'surface'; variant?: 'display' | 'title' | 'body' | 'label' | 'small' }>;

export function AppText({ children, style, tone = 'ink', variant = 'body', ...props }: AppTextProps) {
  return <Text {...props} style={[styles[variant], { color: theme.colors[tone] }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
});
