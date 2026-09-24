import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { listTasks, setTaskCompleted, deleteTask } from '@/src/database/repository';
import type { CareTask } from '@/src/database/models';
import { formatDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

export default function TasksScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks(db));
      setError('');
    } catch {
      setError('Não foi possível carregar as tarefas. Tente novamente.');
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const visibleTasks = tasks.filter((task) => showCompleted ? task.completed : !task.completed);

  const removeTask = (task: CareTask) => {
    Alert.alert('Excluir tarefa?', `“${task.title}” será removida deste aparelho.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { void deleteTask(db, task.id).then(refresh); } },
    ]);
  };

  return (
    <AppScreen>
      <PageHeader eyebrow="TAREFAS" title="Um passo de cada vez." subtitle="Anote o próximo passo e, se ajudar, quem vai cuidar dele." />
      <ActivePersonNotice />
      <PrimaryButton title="Adicionar tarefa" onPress={() => router.push('/task/form')} />

      <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filtrar tarefas">
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: !showCompleted }} onPress={() => setShowCompleted(false)} style={[styles.filter, !showCompleted && styles.filterSelected]}>
          <AppText tone={!showCompleted ? 'surface' : 'ink'} variant="label">Em aberto</AppText>
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: showCompleted }} onPress={() => setShowCompleted(true)} style={[styles.filter, showCompleted && styles.filterSelected]}>
          <AppText tone={showCompleted ? 'surface' : 'ink'} variant="label">Concluídas</AppText>
        </Pressable>
      </View>

      {visibleTasks.length ? visibleTasks.map((task, index) => (
        <View key={task.id} style={[styles.row, index > 0 && styles.divider]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
            accessibilityLabel={`${task.completed ? 'Reabrir' : 'Concluir'} tarefa: ${task.title}`}
            onPress={() => { void setTaskCompleted(db, task.id, !task.completed).then(refresh).catch(() => setError('Não foi possível atualizar a tarefa.')); }}
            style={[styles.check, task.completed && styles.checked]}>
            {task.completed ? <AppText tone="surface" variant="label">✓</AppText> : null}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/task/form', params: { id: String(task.id) } })} style={styles.copy}>
            <AppText variant="label" style={task.completed && styles.done}>{task.title}</AppText>
            <AppText tone="muted" variant="small">
              {[task.dueDate ? `Até ${formatDate(task.dueDate)}` : null, task.assignee ? `Com ${task.assignee}` : null].filter(Boolean).join(' · ') || 'Sem data definida'}
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${task.title}`} hitSlop={10} onPress={() => removeTask(task)} style={styles.remove}>
            <AppText tone="muted" variant="small">Excluir</AppText>
          </Pressable>
        </View>
      )) : (
        <View style={styles.empty}>
          <AppText variant="title">{showCompleted ? 'Ainda não há tarefas concluídas.' : 'Tudo em dia por aqui.'}</AppText>
          <AppText tone="muted">Uma lista curta também é uma forma de cuidar.</AppText>
        </View>
      )}
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 18 },
  filter: { minHeight: 44, borderRadius: theme.radius.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterSelected: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  copy: { flex: 1, gap: 4, paddingVertical: 8 },
  done: { textDecorationLine: 'line-through', color: theme.colors.muted },
  remove: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  empty: { paddingVertical: 30, gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  error: { marginTop: 16 },
});
