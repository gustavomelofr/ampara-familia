import { View, StyleSheet } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText accessibilityRole="header" variant="title">{title}</AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 12, gap: 12 },
});
