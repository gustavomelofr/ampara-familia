import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { DateField } from '@/src/components/DateField';
import { Field } from '@/src/components/Field';
import { OptionChips } from '@/src/components/OptionChips';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { createExpense, RepositoryError } from '@/src/database/repository';
import { parseBrlAmountToCents } from '@/src/utils/money';
import { toLocalIsoDate } from '@/src/utils/date';

const categories = ['Farmácia', 'Transporte', 'Consulta', 'Casa', 'Outro'] as const;
type Category = (typeof categories)[number];

export default function NewExpenseScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Outro');
  const [spentOn, setSpentOn] = useState(toLocalIsoDate(new Date()));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const amountCents = parseBrlAmountToCents(amount);
      if (amountCents === null) throw new RepositoryError('Informe um valor maior que zero, como 25,90.');
      await createExpense(db, { title, amountCents, category, spentOn, notes });
      router.back();
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause.message : 'Não foi possível salvar o gasto.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppScreen bottomInset={24}>
      <PageHeader eyebrow="DESPESAS" title="Anote um gasto." subtitle="Um registro para a família consultar, não uma conta compartilhada." onBack={() => router.back()} />
      <ActivePersonNotice interactive={false} />
      <Field label="O que foi pago?" value={title} onChangeText={setTitle} placeholder="Ex.: remédio de uso contínuo" />
      <Field label="Valor em reais" value={amount} onChangeText={setAmount} placeholder="0,00" keyboardType="decimal-pad" hint="Use vírgula para separar os centavos, por exemplo 25,90." />
      <OptionChips label="Categoria" value={category} onChange={setCategory} options={categories.map((value) => ({ value, label: value }))} />
      <DateField label="Data" value={spentOn} onChange={setSpentOn} />
      <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title={saving ? 'Salvando…' : 'Salvar gasto'} onPress={() => void save()} disabled={saving || title.trim().length < 2 || amount.length === 0} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({ error: { marginBottom: 14 } });
