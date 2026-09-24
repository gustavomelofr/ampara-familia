import { useState } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { formatDate, fromIsoDate, isValidIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

export function DateField({ label, value, onChange, optional = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const [showIOS, setShowIOS] = useState(false);
  const selectedDate = isValidIsoDate(value) ? fromIsoDate(value) : new Date();
  const handleChange = (_event: unknown, date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
    if (Platform.OS === 'ios') setShowIOS(false);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.group}>
        <AppText variant="label">{label}{optional ? ' (opcional)' : ''}</AppText>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={optional ? 'Campo opcional. Deixe vazio se não houver data.' : undefined}
          value={value}
          onChangeText={onChange}
          placeholder="AAAA-MM-DD"
          style={styles.input}
        />
        {optional && value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Limpar ${label.toLocaleLowerCase('pt-BR')}`} onPress={() => onChange('')} hitSlop={8} style={styles.clearDate}>
            <AppText tone="forest" variant="small">Limpar data</AppText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: selectedDate, mode: 'date', onValueChange: handleChange });
    } else {
      setShowIOS((current) => !current);
    }
  };

  return (
    <View style={styles.group}>
      <AppText variant="label">{label}{optional ? ' (opcional)' : ''}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDate(value) : 'escolher data'}`} onPress={openPicker} style={styles.dateButton}>
        <AppText tone={value ? 'ink' : 'muted'}>{value ? formatDate(value) : 'Escolher data'}</AppText>
        <AppText tone="forest" variant="label">Alterar</AppText>
      </Pressable>
      {optional && value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Limpar ${label.toLocaleLowerCase('pt-BR')}`} onPress={() => onChange('')} hitSlop={8} style={styles.clearDate}>
          <AppText tone="forest" variant="small">Limpar data</AppText>
        </Pressable>
      ) : null}
      {Platform.OS === 'ios' && showIOS ? (
        <DateTimePicker display="compact" mode="date" value={selectedDate} onValueChange={handleChange} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, marginBottom: 18 },
  input: { minHeight: 56, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 15, color: theme.colors.ink, backgroundColor: theme.colors.surface, fontSize: 16 },
  dateButton: { minHeight: 56, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 15, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' },
  clearDate: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
});
