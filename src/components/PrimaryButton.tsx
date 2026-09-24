import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

type Props = PropsWithChildren<{
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}>;

export function PrimaryButton({ title, onPress, secondary = false, danger = false, disabled = false, accessibilityHint, children }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        danger ? styles.danger : secondary ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      {children ? <View style={styles.content}>{children}</View> : null}
      <AppText tone={disabled ? 'muted' : secondary ? 'forest' : 'surface'} variant="label">{title}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
  },
  primary: { backgroundColor: theme.colors.forest },
  secondary: { backgroundColor: theme.colors.forestSoft, borderWidth: 1, borderColor: theme.colors.border },
  danger: { backgroundColor: theme.colors.danger },
  disabled: { backgroundColor: theme.colors.border, borderColor: theme.colors.border, opacity: 1 },
  pressed: { opacity: 0.78 },
  content: { alignItems: 'center', justifyContent: 'center' },
});
