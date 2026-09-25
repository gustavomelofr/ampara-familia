import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { ConfirmPanel } from '@/src/components/ConfirmPanel';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { deleteMedication, listMedications } from '@/src/database/repository';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
import type { MedicationNote } from '@/src/database/models';
import { theme } from '@/src/theme';

export default function MedicationsScreen() {
  const db = useAppDatabase();
  const router = useRouter();
  const [medications, setMedications] = useState<MedicationNote[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    try { setMedications(await listMedications(db)); setError(''); }
    catch { setError('Não foi possível carregar a lista.'); }
    finally { setLoading(false); }
  }, [db]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const archive = async (item: MedicationNote) => {
    try {
      await deleteMedication(db, item.id);
      setConfirmingId(null);
      await refresh();
    } catch {
      setError('Não foi possível remover a anotação. Tente novamente.');
    }
  };

  return (
    <AppScreen>
      <PageHeader eyebrow="MEDICAMENTOS" title="Uma lista para consultar." subtitle="Anote o que foi informado pela família, sem substituir a receita ou a orientação de saúde." onBack={() => router.back()} />
      <ActivePersonNotice />
      <View style={styles.notice}><AppText tone="warning" variant="small">O Ampara não calcula doses, não confirma a administração e não envia alertas de medicação. Confira sempre a prescrição e fale com um profissional em caso de dúvida.</AppText></View>
      <PrimaryButton title="Adicionar à lista" onPress={() => router.push('/medication/new')} />
      <View style={styles.list}>
        {loading ? <ScreenMessage title="Carregando lista" message="As anotações ficam neste aparelho." /> : error && medications.length === 0 ? <ScreenMessage tone="error" title="A lista não foi carregada" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : medications.length ? medications.map((item, index) => (
          <View key={item.id} style={[styles.entry, index > 0 && styles.divider]}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <AppText variant="label">{item.name}</AppText>
                {item.schedule ? <AppText tone="muted" variant="small">{item.schedule}</AppText> : null}
                {item.notes ? <AppText tone="muted" variant="small">{item.notes}</AppText> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${item.name} da lista`} onPress={() => setConfirmingId(item.id)} style={styles.remove}>
                <AppText tone="danger" variant="small">Remover</AppText>
              </Pressable>
            </View>
            {confirmingId === item.id ? <View style={styles.confirmWrap}>
              <ConfirmPanel
                title="Remover da lista?"
                message={`“${item.name}” será retirado deste aparelho. A anotação não altera nenhuma prescrição.`}
                confirmLabel="Remover"
                onCancel={() => setConfirmingId(null)}
                onConfirm={() => void archive(item)}
              />
            </View> : null}
          </View>
        )) : <ScreenMessage title="Lista vazia." message="Você pode anotar um nome para consultar depois." actionLabel="Adicionar à lista" onAction={() => router.push('/medication/new')} />}
      </View>
      {error && medications.length > 0 ? <ScreenMessage tone="error" title="A lista pode estar desatualizada" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  notice: { padding: 15, borderRadius: theme.radius.md, backgroundColor: theme.colors.claySoft, marginBottom: 18 },
  list: { marginTop: 22, borderTopWidth: 1, borderTopColor: theme.colors.border },
  entry: { paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 74, gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  copy: { flex: 1, gap: 4 },
  remove: { minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  confirmWrap: { width: '100%' },
});
