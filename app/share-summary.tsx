import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, Switch, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { getCareProfile, listDocuments, listEvents, listExpenses, listMedications, listTasks } from '@/src/database/repository';
import type { CareDocument, CareEvent, CareProfile, CareTask, Expense, MedicationNote } from '@/src/database/models';
import { formatDate, toLocalIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

type SummaryKey = 'events' | 'tasks' | 'expenses' | 'documents' | 'medications';
const labels: Record<SummaryKey, string> = {
  events: 'Próximos compromissos',
  tasks: 'Tarefas em aberto',
  expenses: 'Gastos registrados',
  documents: 'Checklist de documentos',
  medications: 'Lista informativa de medicamentos',
};
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ShareSummaryScreen() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<CareDocument[]>([]);
  const [medications, setMedications] = useState<MedicationNote[]>([]);
  const [selected, setSelected] = useState<Record<SummaryKey, boolean>>({
    events: true, tasks: true, expenses: false, documents: false, medications: false,
  });
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [careProfile, nextEvents, allTasks, allExpenses, allDocuments, allMedications] = await Promise.all([
        getCareProfile(db),
        listEvents(db, toLocalIsoDate(new Date())),
        listTasks(db),
        listExpenses(db),
        listDocuments(db),
        listMedications(db),
      ]);
      setProfile(careProfile);
      setEvents(nextEvents.slice(0, 5));
      setTasks(allTasks.filter((task) => !task.completed).slice(0, 8));
      setExpenses(allExpenses.slice(0, 8));
      setDocuments(allDocuments);
      setMedications(allMedications.filter((item) => item.active));
      setError('');
    } catch {
      setError('Não foi possível preparar o resumo. Tente novamente.');
    }
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const data: Record<SummaryKey, string[]> = {
    events: events.map((event) => `• ${formatDate(event.date)}${event.time ? `, ${event.time}` : ''}: ${event.title}${event.location ? `, ${event.location}` : ''}`),
    tasks: tasks.map((task) => `• ${task.title}${task.dueDate ? `, até ${formatDate(task.dueDate)}` : ''}${task.assignee ? `, responsável: ${task.assignee}` : ''}`),
    expenses: expenses.map((expense) => `• ${formatDate(expense.spentOn)}: ${expense.title} · ${currency.format(expense.amountCents / 100)}`),
    documents: documents.map((document) => `• ${document.completed ? 'Localizado' : 'Pendente'}: ${document.title}${document.location ? `, ${document.location}` : ''}`),
    medications: medications.map((medication) => `• ${medication.name}${medication.schedule ? `, ${medication.schedule}` : ''}`),
  };
  const content = (Object.keys(labels) as SummaryKey[])
    .filter((key) => selected[key] && data[key].length > 0)
    .map((key) => `${labels[key]}\n${data[key].join('\n')}`);
  const preview = content.length
    ? `Resumo de cuidado${profile ? ` para ${profile.personName}` : ''}\n\n${content.join('\n\n')}`
    : 'Selecione ao menos uma seção com informações para compartilhar.';

  const toggle = (key: SummaryKey, value: boolean) => setSelected((current) => ({ ...current, [key]: value }));
  const share = async () => {
    try { await Share.share({ message: preview, title: 'Resumo de cuidado' }); }
    catch { setError('Não foi possível abrir as opções de compartilhamento.'); }
  };

  return (
    <AppScreen bottomInset={24}>
      <AppText accessibilityRole="header" variant="display" style={styles.title}>Você escolhe o que enviar.</AppText>
      <AppText tone="muted" style={styles.subtitle}>Revise o texto abaixo antes de abrir as opções do aparelho. Nada é enviado sem seu toque.</AppText>
      <ActivePersonNotice />
      <View style={styles.options}>
        {(Object.keys(labels) as SummaryKey[]).map((key, index) => (
          <View key={key} style={[styles.option, index > 0 && styles.divider]}>
            <View style={styles.optionCopy}>
              <AppText variant="label">{labels[key]}</AppText>
              <AppText tone="muted" variant="small">{data[key].length} {data[key].length === 1 ? 'registro' : 'registros'}</AppText>
            </View>
            <Switch
              accessibilityLabel={`Incluir ${labels[key].toLocaleLowerCase('pt-BR')}`}
              value={selected[key]}
              onValueChange={(value) => toggle(key, value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.forest }}
              thumbColor={theme.colors.surface}
            />
          </View>
        ))}
      </View>
      <AppText variant="label" style={styles.previewLabel}>Prévia</AppText>
      <View style={styles.preview}><AppText selectable variant="small">{preview}</AppText></View>
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title="Abrir compartilhamento" onPress={() => void share()} disabled={!content.length} />
      <AppText tone="muted" variant="small" style={styles.footer}>Inclua apenas as informações necessárias para a conversa que você quer ter.</AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6 },
  subtitle: { marginTop: 8, marginBottom: 24 },
  options: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  option: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  optionCopy: { flex: 1, gap: 3 },
  previewLabel: { marginTop: 24, marginBottom: 10 },
  preview: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 16, backgroundColor: theme.colors.surface, marginBottom: 18 },
  error: { marginBottom: 14 },
  footer: { textAlign: 'center', marginTop: 12 },
});
