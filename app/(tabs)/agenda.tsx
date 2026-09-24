import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
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
  const [loadError, setLoadError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setEvents(await listEvents(db));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const today = toLocalIsoDate(new Date());
  const visibleEvents = events
    .filter((event) => showPast ? event.date < today : event.date >= today)
    .sort((left, right) => showPast
      ? right.date.localeCompare(left.date) || (right.time ?? '').localeCompare(left.time ?? '')
      : left.date.localeCompare(right.date) || (left.time ?? '').localeCompare(right.time ?? ''));

  const confirmDelete = (event: CareEvent) => {
    Alert.alert('Excluir compromisso?', `“${event.title}” será removido deste aparelho.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        void deleteEvent(db, event.id).then(async (notificationId) => {
          if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
          await refresh();
        }).catch(() => setLoadError(true));
      } },
    ]);
  };

  return (
    <AppScreen>
      <PageHeader eyebrow="AGENDA" title="Datas para ter por perto." subtitle="Consultas, exames e prazos organizados em um só lugar." />
      <ActivePersonNotice />
      <PrimaryButton title="Adicionar compromisso" onPress={() => router.push('/event/form')} />

      <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filtrar compromissos">
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: !showPast }} onPress={() => setShowPast(false)} style={[styles.filter, !showPast && styles.filterSelected]}>
          <AppText tone={!showPast ? 'surface' : 'ink'} variant="label">Próximos</AppText>
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: showPast }} onPress={() => setShowPast(true)} style={[styles.filter, showPast && styles.filterSelected]}>
          <AppText tone={showPast ? 'surface' : 'ink'} variant="label">Anteriores</AppText>
        </Pressable>
      </View>
      <View style={styles.list}>
        {visibleEvents.length ? visibleEvents.map((event, index) => (
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
              hitSlop={8}
              onPress={() => confirmDelete(event)}
              style={styles.delete}>
              <AppText tone="muted" variant="small">Excluir</AppText>
            </Pressable>
          </View>
        )) : (
          <View style={styles.empty}>
            <AppText variant="title">{showPast ? 'Ainda não há compromissos anteriores.' : 'A agenda está livre.'}</AppText>
            <AppText tone="muted">{showPast ? 'Os registros anteriores ficam disponíveis aqui.' : 'Adicione uma consulta, exame ou data importante quando quiser.'}</AppText>
          </View>
        )}
      </View>
      {loadError ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>Não foi possível carregar a agenda. Tente novamente.</AppText> : null}
      <AppText tone="muted" variant="small" style={styles.note}>Um lembrete ajuda a lembrar da data, mas não confirma presença nem substitui orientação profissional.</AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 18 },
  filter: { minHeight: 44, borderRadius: theme.radius.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterSelected: { backgroundColor: theme.colors.forest, borderColor: theme.colors.forest },
  list: { marginTop: 22, borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  main: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dateMark: { width: 52, height: 58, borderRadius: 14, backgroundColor: theme.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  delete: { alignSelf: 'flex-end', minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  empty: { paddingVertical: 28, gap: 7 },
  note: { marginTop: 22 },
  error: { marginTop: 14 },
  pressed: { opacity: 0.72 },
});
