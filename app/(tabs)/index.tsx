import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SectionTitle } from '@/src/components/SectionTitle';
import { getCareProfile, listEvents, listTasks } from '@/src/database/repository';
import type { CareEvent, CareProfile, CareTask } from '@/src/database/models';
import { formatDate, formatDateWithWeekday, getGreeting, toLocalIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [event, setEvent] = useState<CareEvent | null>(null);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [loadError, setLoadError] = useState(false);

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
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const firstName = profile?.personName.split(/\s+/)[0] ?? 'sua família';

  return (
    <AppScreen>
      <PageHeader
        eyebrow="AMPARA FAMÍLIA · CUIDADO EM FAMÍLIA"
        title={`${getGreeting()}, ${firstName}.`}
        subtitle={new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
      />
      <Pressable accessibilityRole="button" onPress={() => router.push('/care-profile')} style={styles.personSwitcher}>
        <AppText tone="muted" variant="small">Acompanhando: {profile?.personName ?? 'familiar'}</AppText>
        <AppText tone="forest" variant="label">Trocar pessoa</AppText>
      </Pressable>

      <View style={styles.focusBlock}>
        <View style={styles.focusHead}>
          <AppText tone="surface" variant="label">PRÓXIMO COMPROMISSO</AppText>
          <AppText tone="surface" variant="small">{profile?.relationship === 'mãe' ? 'Sua mãe' : profile?.relationship === 'pai' ? 'Seu pai' : 'Seu familiar'}</AppText>
        </View>
        {event ? (
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
        <Pressable accessibilityRole="button" onPress={() => router.push('/agenda')} style={({ pressed }) => [styles.focusLink, pressed && styles.pressed]}>
          <AppText tone="surface" variant="label">Ver agenda</AppText>
          <AppText tone="surface" variant="label">›</AppText>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <PrimaryButton title="Adicionar compromisso" onPress={() => router.push('/event/form')} />
        <PrimaryButton title="Criar tarefa" secondary onPress={() => router.push('/task/form')} />
      </View>

      <SectionTitle title="Pequenos próximos passos" action={
        <Pressable accessibilityRole="button" accessibilityLabel="Ver todas as tarefas" onPress={() => router.push('/tasks')} hitSlop={10}>
          <AppText tone="forest" variant="label">Ver tudo</AppText>
        </Pressable>
      } />
      {tasks.length > 0 ? (
        <View style={styles.taskList}>
          {tasks.map((task, index) => (
            <Pressable key={task.id} accessibilityRole="button" onPress={() => router.push('/tasks')} style={[styles.taskLine, index > 0 && styles.divider]}>
              <View style={styles.taskDot} />
              <View style={styles.taskCopy}>
                <AppText variant="label">{task.title}</AppText>
                <AppText tone="muted" variant="small">{task.dueDate ? `Até ${formatDate(task.dueDate)}` : task.assignee ? `Com ${task.assignee}` : 'Sem data definida'}</AppText>
              </View>
              <AppText tone="muted" variant="title">›</AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyTasks}>
          <AppText variant="label">Sem tarefas pendentes</AppText>
          <AppText tone="muted" variant="small">Você pode anotar um próximo passo quando precisar.</AppText>
        </View>
      )}

      <View style={styles.bottomNote}>
        <AppText tone="muted" variant="small">Seus registros ficam neste aparelho. Os lembretes ajudam a organizar a rotina, mas não substituem orientação profissional.</AppText>
      </View>
      {loadError ? <AppText tone="danger" variant="small" accessibilityRole="alert">Não foi possível atualizar os dados. Tente novamente ao abrir a tela.</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  focusBlock: { backgroundColor: theme.colors.forest, borderRadius: 22, padding: 22, marginTop: 2 },
  personSwitcher: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -14, marginBottom: 14 },
  focusHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eventTitle: { marginTop: 22, marginBottom: 8 },
  eventTime: { marginBottom: 4 },
  focusLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,252,246,0.28)', marginTop: 18, paddingTop: 12 },
  actions: { gap: 10, marginTop: 16 },
  taskList: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  taskLine: { flexDirection: 'row', alignItems: 'center', minHeight: 68, gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  taskDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.clay },
  taskCopy: { flex: 1, gap: 3 },
  emptyTasks: { paddingVertical: 14, gap: 4, borderTopWidth: 1, borderTopColor: theme.colors.border },
  bottomNote: { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  pressed: { opacity: 0.75 },
});
