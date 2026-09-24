import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { DateField } from '@/src/components/DateField';
import { Field } from '@/src/components/Field';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { createTask, listTasks, RepositoryError, updateTask } from '@/src/database/repository';
import { toLocalIsoDate } from '@/src/utils/date';

export default function TaskFormScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const taskId = id ? Number(id) : null;
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    void listTasks(db).then((tasks) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      setTitle(task.title);
      setDueDate(task.dueDate ?? '');
      setAssignee(task.assignee ?? '');
      setNotes(task.notes ?? '');
    });
  }, [db, taskId]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const input = { title, dueDate, assignee, notes };
      if (taskId) await updateTask(db, taskId, input);
      else await createTask(db, input);
      router.back();
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause.message : 'Não foi possível salvar a tarefa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen bottomInset={24}>
      <AppText accessibilityRole="header" variant="display" style={styles.title}>{taskId ? 'Revise a tarefa.' : 'Qual é o próximo passo?'}</AppText>
      <AppText tone="muted" style={styles.subtitle}>Deixe claro o que precisa ser feito, sem tentar resolver tudo agora.</AppText>
      <ActivePersonNotice interactive={false} />
      <Field label="Tarefa" value={title} onChangeText={setTitle} placeholder="Ex.: buscar o resultado do exame" autoCapitalize="sentences" />
      <DateField label="Data para lembrar" value={dueDate} onChange={setDueDate} optional />
      <Field label="Pessoa responsável" value={assignee} onChangeText={setAssignee} placeholder="Ex.: Ana (só uma anotação local)" autoCapitalize="words" hint="Esse nome não recebe aviso nem sincroniza com outros aparelhos." />
      <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Um detalhe que ajude depois" multiline />
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title={saving ? 'Salvando…' : 'Salvar tarefa'} onPress={() => void save()} disabled={saving || title.trim().length < 2} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6 },
  subtitle: { marginTop: 8, marginBottom: 24 },
  error: { marginBottom: 14 },
});
