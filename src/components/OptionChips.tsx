import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { theme } from '@/src/theme';

export function OptionChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}>
              <AppText tone={selected ? 'surface' : 'ink'} variant="label">{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { minHeight: 44, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: theme.colors.surface },
  selected: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  pressed: { opacity: 0.8 },
});
