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
import { listTasks, setTaskCompleted, deleteTask } from '@/src/database/repository';
import type { CareTask } from '@/src/database/models';
import { formatDate, toLocalIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

export default function TasksScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks(db));
      setError('');
    } catch {
      setError('Não foi possível carregar as tarefas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const visibleTasks = tasks.filter((task) => showCompleted ? task.completed : !task.completed);
  const today = toLocalIsoDate(new Date());

  const removeTask = async (task: CareTask) => {
    try {
      await deleteTask(db, task.id);
      setConfirmingId(null);
      await refresh();
    } catch {
      setError('Não foi possível excluir a tarefa. Tente novamente.');
    }
  };

  return (
    <AppScreen>
      <PageHeader eyebrow="TAREFAS" title="Um passo de cada vez." subtitle="Anote o próximo passo e, se ajudar, quem vai cuidar dele." />
      <ActivePersonNotice />
      <PrimaryButton title="Adicionar tarefa" onPress={() => router.push('/task/form')} />

      <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filtrar tarefas">
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: !showCompleted }} aria-checked={!showCompleted} onPress={() => setShowCompleted(false)} style={[styles.filter, !showCompleted && styles.filterSelected]}>
          <AppText tone={!showCompleted ? 'surface' : 'ink'} variant="label">Em aberto</AppText>
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: showCompleted }} aria-checked={showCompleted} onPress={() => setShowCompleted(true)} style={[styles.filter, showCompleted && styles.filterSelected]}>
          <AppText tone={showCompleted ? 'surface' : 'ink'} variant="label">Concluídas</AppText>
        </Pressable>
      </View>

      {loading ? <ScreenMessage title="Carregando tarefas" message="As anotações ficam neste aparelho." /> : error && tasks.length === 0 ? <ScreenMessage tone="error" title="As tarefas não foram carregadas" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : visibleTasks.length ? visibleTasks.map((task, index) => (
        <View key={task.id} style={[styles.row, index > 0 && styles.divider]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
            accessibilityLabel={`${task.completed ? 'Reabrir' : 'Concluir'} tarefa: ${task.title}`}
            aria-checked={task.completed}
            hitSlop={4}
            onPress={() => { void setTaskCompleted(db, task.id, !task.completed).then(refresh).catch(() => setError('Não foi possível atualizar a tarefa.')); }}
            style={styles.checkTarget}>
            <View style={[styles.check, task.completed && styles.checked]}>
              {task.completed ? <AppText tone="surface" variant="label">✓</AppText> : null}
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Editar tarefa: ${task.title}`} onPress={() => router.push({ pathname: '/task/form', params: { id: String(task.id) } })} style={styles.copy}>
            <AppText variant="label" style={task.completed && styles.done}>{task.title}</AppText>
            {task.dueDate ? <AppText tone={!task.completed && task.dueDate < today ? 'danger' : 'muted'} variant="small">{!task.completed && task.dueDate < today ? 'Atrasada · ' : 'Até '}{formatDate(task.dueDate)}</AppText> : <AppText tone="muted" variant="small">Sem data definida</AppText>}
            {task.assignee ? <AppText tone="muted" variant="small">Responsável: {task.assignee}</AppText> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${task.title}`} onPress={() => setConfirmingId(task.id)} style={styles.remove}>
            <AppText tone="danger" variant="small">Excluir</AppText>
          </Pressable>
          {confirmingId === task.id ? <View style={styles.confirmWrap}>
            <ConfirmPanel
              title="Excluir tarefa?"
              message={`“${task.title}” será removida deste aparelho.`}
              onCancel={() => setConfirmingId(null)}
              onConfirm={() => void removeTask(task)}
            />
          </View> : null}
        </View>
      )) : (
        <ScreenMessage
          title={showCompleted ? 'Ainda não há tarefas concluídas.' : 'Tudo em dia por aqui.'}
          message="Uma lista curta também é uma forma de cuidar."
          actionLabel={!showCompleted ? 'Adicionar tarefa' : undefined}
          onAction={!showCompleted ? () => router.push('/task/form') : undefined}
        />
      )}
      {error && tasks.length > 0 ? <ScreenMessage tone="error" title="As tarefas podem estar desatualizadas" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 18 },
  filter: { minHeight: 44, borderRadius: theme.radius.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterSelected: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: 8, flexWrap: 'wrap' },
  confirmWrap: { width: '100%' },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  checkTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  copy: { flex: 1, gap: 4, paddingVertical: 8 },
  done: { textDecorationLine: 'line-through', color: theme.colors.muted },
  remove: { minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
});
