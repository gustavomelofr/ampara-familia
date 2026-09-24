import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { ConfirmPanel } from '@/src/components/ConfirmPanel';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { deleteExpense, listExpenses } from '@/src/database/repository';
import type { Expense } from '@/src/database/models';
import { formatDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ExpensesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    try {
      setExpenses(await listExpenses(db));
      setError('');
    } catch {
      setError('Não foi possível carregar os gastos. Seus registros continuam salvos neste aparelho.');
    } finally {
      setLoading(false);
    }
  }, [db]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const total = expenses.reduce((sum, item) => sum + item.amountCents, 0);

  const removeExpense = async (item: Expense) => {
    try {
      await deleteExpense(db, item.id);
      setConfirmingId(null);
      await refresh();
    } catch {
      setError('Não foi possível excluir o gasto. Tente novamente.');
    }
  };

  return (
    <AppScreen>
      <PageHeader eyebrow="DESPESAS" title="Gastos da família." subtitle="Um registro simples para consultar quando precisar." onBack={() => router.back()} />
      <ActivePersonNotice />
      <View style={styles.summary}>
        <View style={styles.summaryCopy}>
          <AppText tone="muted" variant="small">Total anotado</AppText>
          <AppText variant="title">{currency.format(total / 100)}</AppText>
        </View>
        <AppText tone="muted" variant="small">{expenses.length} {expenses.length === 1 ? 'registro' : 'registros'}</AppText>
      </View>
      <PrimaryButton title="Anotar um gasto" onPress={() => router.push('/expense/new')} />
      <View style={styles.list}>
        {loading ? <ScreenMessage title="Carregando gastos" message="Seus registros ficam neste aparelho." /> : error && expenses.length === 0 ? <ScreenMessage tone="error" title="Os gastos não foram carregados" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : expenses.length ? expenses.map((item, index) => (
          <View key={item.id} style={[styles.entry, index > 0 && styles.divider]}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <AppText variant="label">{item.title}</AppText>
                <AppText tone="muted" variant="small">{item.category} · {formatDate(item.spentOn)}</AppText>
                {item.notes ? <AppText tone="muted" variant="small" numberOfLines={2}>{item.notes}</AppText> : null}
              </View>
              <AppText variant="label">{currency.format(item.amountCents / 100)}</AppText>
            </View>
            {confirmingId === item.id ? (
              <ConfirmPanel
                title="Excluir gasto?"
                message={`“${item.title}” será removido deste aparelho.`}
                onCancel={() => setConfirmingId(null)}
                onConfirm={() => void removeExpense(item)}
              />
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={`Excluir gasto ${item.title}`} onPress={() => setConfirmingId(item.id)} style={styles.remove}>
                <AppText tone="danger" variant="small">Excluir registro</AppText>
              </Pressable>
            )}
          </View>
        )) : <ScreenMessage title="Nenhum gasto anotado." message="Registre um quando quiser acompanhar as despesas." actionLabel="Anotar um gasto" onAction={() => router.push('/expense/new')} />}
      </View>
      {error && expenses.length > 0 ? <ScreenMessage tone="error" title="Os gastos podem estar desatualizados" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summary: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border, marginBottom: 18 },
  summaryCopy: { gap: 3 },
  list: { marginTop: 22 },
  entry: { paddingVertical: 12 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  copy: { flex: 1, gap: 4 },
  remove: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 8 },
});
