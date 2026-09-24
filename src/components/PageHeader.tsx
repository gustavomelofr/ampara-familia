import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
};

export function PageHeader({ eyebrow, title, subtitle, onBack, backLabel = 'Voltar' }: PageHeaderProps) {
  return (
    <View style={styles.wrap}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <AppText tone="forest" variant="title" style={styles.backArrow}>‹</AppText>
          <AppText tone="forest" variant="label">{backLabel}</AppText>
        </Pressable>
      ) : null}
      {eyebrow ? <AppText tone="forest" variant="label" style={styles.eyebrow}>{eyebrow.toLocaleUpperCase('pt-BR')}</AppText> : null}
      <AppText accessibilityRole="header" aria-level={1} variant="display">{title}</AppText>
      {subtitle ? <AppText tone="muted" style={styles.subtitle}>{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 24 },
  back: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12, marginBottom: 2 },
  backArrow: { fontSize: 28, lineHeight: 32, marginTop: -2 },
  eyebrow: { letterSpacing: 1.1, fontSize: 12 },
  subtitle: { marginTop: 2 },
  pressed: { opacity: 0.72 },
});
