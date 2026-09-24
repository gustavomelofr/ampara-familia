import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { Field } from '@/src/components/Field';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { createMedication, RepositoryError } from '@/src/database/repository';
import { theme } from '@/src/theme';

export default function NewMedicationScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await createMedication(db, { name, schedule, notes });
      router.back();
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause.message : 'Não foi possível salvar a anotação.');
    } finally { setSaving(false); }
  };
  return (
    <AppScreen bottomInset={24}>
      <AppText accessibilityRole="header" variant="display" style={styles.title}>Anote para consultar.</AppText>
      <AppText tone="muted" style={styles.subtitle}>Transcreva somente a informação que sua família já tem.</AppText>
      <ActivePersonNotice interactive={false} />
      <Field label="Nome do medicamento" value={name} onChangeText={setName} placeholder="Conforme aparece na embalagem" />
      <Field label="Horário ou orientação registrada" value={schedule} onChangeText={setSchedule} placeholder="Ex.: manhã, conforme receita" />
      <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />
      <View style={styles.notice}><AppText tone="warning" variant="small">Não inclua dados que não estejam confirmados na receita. O app não substitui a prescrição nem confirma que uma dose foi tomada.</AppText></View>
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title={saving ? 'Salvando…' : 'Salvar anotação'} onPress={() => void save()} disabled={saving || name.trim().length < 2} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({ title: { marginTop: 6 }, subtitle: { marginTop: 8, marginBottom: 24 }, notice: { padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.claySoft, marginBottom: 18 }, error: { marginBottom: 14 } });
