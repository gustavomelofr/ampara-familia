import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { DateField } from '@/src/components/DateField';
import { Field } from '@/src/components/Field';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { createDocument, RepositoryError } from '@/src/database/repository';

export default function NewDocumentScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await createDocument(db, { title, location, expiresOn });
      router.back();
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause.message : 'Não foi possível salvar o documento.');
    } finally { setSaving(false); }
  };
  return (
    <AppScreen bottomInset={24}>
      <AppText accessibilityRole="header" variant="display" style={styles.title}>Onde está o documento?</AppText>
      <AppText tone="muted" style={styles.subtitle}>Registre o nome e um lugar para procurar.</AppText>
      <ActivePersonNotice interactive={false} />
      <Field label="Nome do documento" value={title} onChangeText={setTitle} placeholder="Ex.: cartão do plano de saúde" />
      <Field label="Onde encontrar" value={location} onChangeText={setLocation} placeholder="Ex.: pasta azul na gaveta" />
      <DateField label="Validade" value={expiresOn} onChange={setExpiresOn} optional />
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title={saving ? 'Salvando…' : 'Salvar documento'} onPress={() => void save()} disabled={saving || title.trim().length < 2} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({ title: { marginTop: 6 }, subtitle: { marginTop: 8, marginBottom: 24 }, error: { marginBottom: 14 } });
