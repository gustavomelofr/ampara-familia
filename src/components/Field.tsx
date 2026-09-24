import type { PropsWithChildren } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

type FieldProps = PropsWithChildren<{
  label: string;
  hint?: string;
  multiline?: boolean;
}> & TextInputProps;

export function Field({ label, hint, multiline = false, children, style, ...props }: FieldProps) {
  return (
    <View style={styles.group}>
      <AppText variant="label" style={styles.label}>{label}</AppText>
      {children ?? (
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.muted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, multiline && styles.multiline, style]}
        />
      )}
      {hint ? <AppText tone="muted" variant="small" style={styles.hint}>{hint}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, marginBottom: 18 },
  label: { marginLeft: 2 },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    fontSize: 16,
  },
  multiline: { minHeight: 98, paddingTop: 14 },
  hint: { marginLeft: 2 },
});
