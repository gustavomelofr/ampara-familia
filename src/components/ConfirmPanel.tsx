import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

type ConfirmPanelProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmPanel({ title, message, confirmLabel = 'Excluir', disabled = false, onCancel, onConfirm }: ConfirmPanelProps) {
  return (
    <View style={styles.panel} accessibilityRole="alert">
      <AppText variant="label">{title}</AppText>
      <AppText tone="muted" variant="small">{message}</AppText>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed, disabled && styles.disabled]}>
          <AppText tone="forest" variant="label">Cancelar</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onConfirm} style={({ pressed }) => [styles.confirm, pressed && styles.pressed, disabled && styles.disabled]}>
          <AppText tone="surface" variant="label">{confirmLabel}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: theme.colors.clay, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, padding: 14, gap: 8, marginVertical: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 2 },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  confirm: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.danger },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.75 },
});
