import { View, StyleSheet } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <AppText tone="forest" variant="label" style={styles.eyebrow}>{eyebrow.toLocaleUpperCase('pt-BR')}</AppText> : null}
      <AppText accessibilityRole="header" variant="display">{title}</AppText>
      {subtitle ? <AppText tone="muted" style={styles.subtitle}>{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 26 },
  eyebrow: { letterSpacing: 1.1, fontSize: 12 },
  subtitle: { marginTop: 2 },
});
