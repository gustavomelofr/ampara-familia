import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { deleteMedication, listMedications } from '@/src/database/repository';
import type { MedicationNote } from '@/src/database/models';
import { theme } from '@/src/theme';

export default function MedicationsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [medications, setMedications] = useState<MedicationNote[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setMedications(await listMedications(db)); setError(''); }
    catch { setError('Não foi possível carregar a lista.'); }
  }, [db]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const archive = (item: MedicationNote) => Alert.alert('Remover da lista?', item.name, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => { void deleteMedication(db, item.id).then(refresh); } },
  ]);

  return (
    <AppScreen>
      <PageHeader eyebrow="MEDICAMENTOS" title="Uma lista para consultar." subtitle="Anote o que foi informado pela família, sem substituir a receita ou a orientação de saúde." />
      <ActivePersonNotice />
      <View style={styles.notice}><AppText tone="warning" variant="small">O Ampara não calcula doses, não confirma a administração e não envia alertas de medicação. Confira sempre a prescrição e fale com um profissional em caso de dúvida.</AppText></View>
      <PrimaryButton title="Adicionar à lista" onPress={() => router.push('/medication/new')} />
      <View style={styles.list}>
        {medications.length ? medications.map((item, index) => (
          <View key={item.id} style={[styles.row, index > 0 && styles.divider]}>
            <View style={styles.copy}>
              <AppText variant="label">{item.name}</AppText>
              {item.schedule ? <AppText tone="muted" variant="small">{item.schedule}</AppText> : null}
              {item.notes ? <AppText tone="muted" variant="small">{item.notes}</AppText> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${item.name} da lista`} hitSlop={8} onPress={() => archive(item)} style={styles.remove}>
              <AppText tone="muted" variant="small">Remover</AppText>
            </Pressable>
          </View>
        )) : <View style={styles.empty}><AppText variant="title">Lista vazia.</AppText><AppText tone="muted">Você pode anotar um nome para consultar depois.</AppText></View>}
      </View>
      {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  notice: { padding: 15, borderRadius: theme.radius.md, backgroundColor: theme.colors.claySoft, marginBottom: 18 },
  list: { marginTop: 22, borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 74, gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  copy: { flex: 1, gap: 4 },
  remove: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  empty: { paddingVertical: 28, gap: 8 },
});
