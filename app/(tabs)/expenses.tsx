import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { deleteExpense, listExpenses } from '@/src/database/repository';
import type { Expense } from '@/src/database/models';
import { formatDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ExpensesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setExpenses(await listExpenses(db));
      setError('');
    } catch {
      setError('Não foi possível carregar os gastos.');
    }
  }, [db]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const total = expenses.reduce((sum, item) => sum + item.amountCents, 0);

  const confirmDelete = (item: Expense) => Alert.alert('Excluir gasto?', item.title, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => { void deleteExpense(db, item.id).then(refresh); } },
  ]);

  return (
    <AppScreen>
      <PageHeader eyebrow="DESPESAS" title="Os gastos em perspectiva." subtitle="Um registro simples para a família consultar quando precisar." />
      <ActivePersonNotice />
      <View style={styles.total}>
        <AppText tone="muted" variant="small">Total dos registros</AppText>
        <AppText variant="title" style={styles.totalValue}>{currency.format(total / 100)}</AppText>
      </View>
      <PrimaryButton title="Anotar um gasto" onPress={() => router.push('/expense/new')} />
      <View style={styles.list}>
        {expenses.length ? expenses.map((item, index) => (
          <View key={item.id} style={[styles.row, index > 0 && styles.divider]}>
            <View style={styles.copy}>
              <AppText variant="label">{item.title}</AppText>
              <AppText tone="muted" variant="small">{item.category} · {formatDate(item.spentOn)}</AppText>
            </View>
            <AppText variant="label">{currency.format(item.amountCents / 100)}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={`Excluir gasto ${item.title}`} onPress={() => confirmDelete(item)} hitSlop={8} style={styles.remove}><AppText tone="muted" variant="small">×</AppText></Pressable>
          </View>
        )) : <View style={styles.empty}><AppText variant="title">Nenhum gasto anotado.</AppText><AppText tone="muted">Registre um quando quiser acompanhar as despesas.</AppText></View>}
      </View>
      {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  total: { paddingVertical: 18, marginBottom: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 5 },
  totalValue: { fontSize: 26, lineHeight: 32 },
  list: { marginTop: 20, borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  copy: { flex: 1, gap: 4 },
  remove: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 28, gap: 8 },
});
