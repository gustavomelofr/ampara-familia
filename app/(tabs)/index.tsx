import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { SectionTitle } from '@/src/components/SectionTitle';
import { getCareProfile, listEvents, listTasks } from '@/src/database/repository';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
import type { CareEvent, CareProfile, CareTask } from '@/src/database/models';
import { formatDate, formatDateWithWeekday, getGreeting, toLocalIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

export default function TodayScreen() {
  const db = useAppDatabase();
  const router = useRouter();
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [event, setEvent] = useState<CareEvent | null>(null);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [nextProfile, events, allTasks] = await Promise.all([
        getCareProfile(db),
        listEvents(db, toLocalIsoDate(new Date())),
        listTasks(db),
      ]);
      setProfile(nextProfile);
      setEvent(events[0] ?? null);
      setTasks(allTasks.filter((task) => !task.completed).slice(0, 3));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const firstName = profile?.personName.split(/\s+/)[0] ?? 'sua família';

  return (
    <AppScreen>
      <PageHeader
        eyebrow="HOJE"
        title={`${getGreeting()}, ${firstName}.`}
        subtitle={new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
      />
      <ActivePersonNotice />

      {loadError ? <ScreenMessage tone="error" title="Hoje não foi atualizado" message="Seus registros continuam salvos neste aparelho." actionLabel="Tentar novamente" onAction={() => void load()} /> : (
        <View style={styles.focusBlock}>
          <View style={styles.focusHead}>
            <AppText tone="surface" variant="label">PRÓXIMO COMPROMISSO</AppText>
            <AppText tone="surface" variant="small">{profile?.relationship === 'mãe' ? 'Sua mãe' : profile?.relationship === 'pai' ? 'Seu pai' : 'Seu familiar'}</AppText>
          </View>
          {loading ? (
            <>
              <AppText tone="surface" variant="title" style={styles.eventTitle}>Carregando agenda…</AppText>
              <AppText tone="surface" style={styles.eventTime}>Buscando os próximos registros neste aparelho.</AppText>
            </>
          ) : event ? (
            <>
              <AppText accessibilityRole="header" tone="surface" variant="title" style={styles.eventTitle}>{event.title}</AppText>
              <AppText tone="surface" style={styles.eventTime}>{formatDateWithWeekday(event.date)}{event.time ? ` · ${event.time}` : ''}</AppText>
              {event.location ? <AppText tone="surface" variant="small">{event.location}</AppText> : null}
            </>
          ) : (
            <>
              <AppText accessibilityRole="header" tone="surface" variant="title" style={styles.eventTitle}>Ainda não há nada na agenda.</AppText>
              <AppText tone="surface" style={styles.eventTime}>Quando registrar um compromisso, ele aparece aqui.</AppText>
            </>
          )}
          {!loading ? <Pressable accessibilityRole="button" accessibilityHint={event ? 'Abre o compromisso para editar' : 'Abre a agenda'} onPress={() => event ? router.push({ pathname: '/event/form', params: { id: String(event.id) } }) : router.push('/agenda')} style={({ pressed }) => [styles.focusLink, pressed && styles.pressed]}>
            <AppText tone="surface" variant="label">{event ? 'Revisar compromisso' : 'Ver agenda'}</AppText>
            <AppText tone="surface" variant="label">›</AppText>
          </Pressable> : null}
        </View>
      )}

      <View style={styles.actions}>
        <PrimaryButton title="Adicionar compromisso" onPress={() => router.push('/event/form')} />
        <PrimaryButton title="Criar tarefa" secondary onPress={() => router.push('/task/form')} />
      </View>

      <SectionTitle title="Pequenos próximos passos" action={
        <Pressable accessibilityRole="button" accessibilityLabel="Ver todas as tarefas" onPress={() => router.push('/tasks')} hitSlop={10}>
          <AppText tone="forest" variant="label">Ver tudo</AppText>
        </Pressable>
      } />
      {loading ? <ScreenMessage title="Carregando tarefas" message="Buscando os próximos passos." /> : tasks.length > 0 ? (
        <View style={styles.taskList}>
          {tasks.map((task, index) => (
              <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Editar tarefa: ${task.title}`} onPress={() => router.push({ pathname: '/task/form', params: { id: String(task.id) } })} style={[styles.taskLine, index > 0 && styles.divider]}>
              <View style={styles.taskDot} />
              <View style={styles.taskCopy}>
                <AppText variant="label">{task.title}</AppText>
                <AppText tone="muted" variant="small">{task.dueDate ? `Até ${formatDate(task.dueDate)}` : task.assignee ? `Com ${task.assignee}` : 'Sem data definida'}</AppText>
              </View>
              <AppText tone="muted" variant="title">›</AppText>
            </Pressable>
          ))}
        </View>
      ) : !loadError ? (
        <ScreenMessage
          title="Sem tarefas pendentes"
          message="Uma lista curta também é uma forma de cuidar."
          actionLabel="Criar tarefa"
          onAction={() => router.push('/task/form')}
        />
      ) : null}

      <View style={styles.bottomNote}>
        <AppText tone="muted" variant="small">Seus registros ficam neste aparelho. Os lembretes ajudam a organizar a rotina, mas não substituem orientação profissional.</AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  focusBlock: { backgroundColor: theme.colors.forest, borderRadius: 22, padding: 22, marginTop: 2 },
  focusHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eventTitle: { marginTop: 22, marginBottom: 8 },
  eventTime: { marginBottom: 4 },
  focusLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,252,246,0.28)', marginTop: 18, paddingTop: 12 },
  actions: { gap: 10, marginTop: 16 },
  taskList: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  taskLine: { flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  taskDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.clay },
  taskCopy: { flex: 1, gap: 3 },
  bottomNote: { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  pressed: { opacity: 0.75 },
});
