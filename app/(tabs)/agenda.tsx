import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { ConfirmPanel } from '@/src/components/ConfirmPanel';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { listEvents, deleteEvent } from '@/src/database/repository';
import type { CareEvent, EventKind } from '@/src/database/models';
import { formatDateWithWeekday, toLocalIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

const kindLabels: Record<EventKind, string> = {
  consulta: 'Consulta',
  exame: 'Exame',
  prazo: 'Prazo',
  outro: 'Outro compromisso',
};

export default function AgendaScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    try {
      setEvents(await listEvents(db));
      setError('');
    } catch {
      setError('Não foi possível carregar a agenda. Seus registros continuam salvos neste aparelho.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const today = toLocalIsoDate(new Date());
  const visibleEvents = events
    .filter((event) => showPast ? event.date < today : event.date >= today)
    .sort((left, right) => showPast
      ? right.date.localeCompare(left.date) || (right.time ?? '').localeCompare(left.time ?? '')
      : left.date.localeCompare(right.date) || (left.time ?? '').localeCompare(right.time ?? ''));

  const removeEvent = async (event: CareEvent) => {
    try {
      if (event.notificationId) await Notifications.cancelScheduledNotificationAsync(event.notificationId);
      await deleteEvent(db, event.id);
      setConfirmingId(null);
      await refresh();
    } catch {
      setError('Não foi possível cancelar o lembrete ou excluir o compromisso. Ele foi mantido para você tentar novamente.');
    }
  };

  return (
    <AppScreen>
      <PageHeader eyebrow="AGENDA" title="Datas para ter por perto." subtitle="Consultas, exames e prazos organizados em um só lugar." />
      <ActivePersonNotice />
      <PrimaryButton title="Adicionar compromisso" onPress={() => router.push('/event/form')} />

      <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filtrar compromissos">
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: !showPast }} aria-checked={!showPast} onPress={() => setShowPast(false)} style={[styles.filter, !showPast && styles.filterSelected]}>
          <AppText tone={!showPast ? 'surface' : 'ink'} variant="label">Próximos</AppText>
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: showPast }} aria-checked={showPast} onPress={() => setShowPast(true)} style={[styles.filter, showPast && styles.filterSelected]}>
          <AppText tone={showPast ? 'surface' : 'ink'} variant="label">Anteriores</AppText>
        </Pressable>
      </View>
      <View style={styles.list}>
        {loading ? <ScreenMessage title="Carregando agenda" message="Seus compromissos ficam neste aparelho." /> : error && events.length === 0 ? <ScreenMessage tone="error" title="A agenda não foi carregada" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : visibleEvents.length ? visibleEvents.map((event, index) => (
          <View key={event.id} style={[styles.row, index > 0 && styles.divider]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${kindLabels[event.kind]}: ${event.title}, ${formatDateWithWeekday(event.date)}${event.time ? ` às ${event.time}` : ''}. Editar.`}
              onPress={() => router.push({ pathname: '/event/form', params: { id: String(event.id) } })}
              style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
              <View style={styles.dateMark}>
                <AppText tone="forest" variant="label">{event.date.slice(8, 10)}</AppText>
                <AppText tone="forest" variant="small">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${event.date}T12:00:00`)).replace('.', '')}</AppText>
              </View>
              <View style={styles.copy}>
                <AppText tone="muted" variant="small">{kindLabels[event.kind]}{event.time ? ` · ${event.time}` : ''}</AppText>
                <AppText variant="label" numberOfLines={2}>{event.title}</AppText>
                {event.location ? <AppText tone="muted" variant="small" numberOfLines={1}>{event.location}</AppText> : null}
              </View>
              <AppText tone="muted" variant="title">›</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Excluir ${event.title}`}
              onPress={() => setConfirmingId(event.id)}
              style={styles.delete}>
              <AppText tone="danger" variant="small">Excluir</AppText>
            </Pressable>
            {confirmingId === event.id ? (
              <ConfirmPanel
                title="Excluir compromisso?"
                message={`“${event.title}” será removido deste aparelho.`}
                onCancel={() => setConfirmingId(null)}
                onConfirm={() => void removeEvent(event)}
              />
            ) : null}
          </View>
        )) : (
          <ScreenMessage
            title={showPast ? 'Ainda não há compromissos anteriores.' : 'A agenda está livre.'}
            message={showPast ? 'Os registros anteriores ficam disponíveis aqui.' : 'Adicione uma consulta, exame ou data importante quando quiser.'}
            actionLabel={!showPast ? 'Adicionar compromisso' : undefined}
            onAction={!showPast ? () => router.push('/event/form') : undefined}
          />
        )}
      </View>
      {error && events.length > 0 ? <ScreenMessage tone="error" title="A agenda pode estar desatualizada" message={error} actionLabel="Tentar novamente" onAction={() => void refresh()} /> : null}
      <AppText tone="muted" variant="small" style={styles.note}>Um lembrete ajuda a lembrar da data, mas não confirma presença nem substitui orientação profissional.</AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 18 },
  filter: { minHeight: 44, borderRadius: theme.radius.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterSelected: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  list: { marginTop: 18, borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  main: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dateMark: { width: 52, height: 58, borderRadius: 14, backgroundColor: theme.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  delete: { alignSelf: 'flex-end', minHeight: 44, minWidth: 56, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  note: { marginTop: 22 },
  error: { marginTop: 14 },
  pressed: { opacity: 0.72 },
});
