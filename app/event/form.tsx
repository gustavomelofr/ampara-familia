import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { DateField } from '@/src/components/DateField';
import { Field } from '@/src/components/Field';
import { OptionChips } from '@/src/components/OptionChips';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { createEvent, getEvent, RepositoryError, setEventNotification, updateEvent } from '@/src/database/repository';
import type { EventKind } from '@/src/database/models';
import { toLocalIsoDate, fromIsoDate } from '@/src/utils/date';
import { theme } from '@/src/theme';

const eventOptions: { value: EventKind; label: string }[] = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'exame', label: 'Exame' },
  { value: 'prazo', label: 'Prazo' },
  { value: 'outro', label: 'Outro' },
];

export default function EventFormScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id ? Number(id) : null;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<EventKind>('consulta');
  const [date, setDate] = useState(toLocalIsoDate(new Date()));
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    void getEvent(db, eventId).then((event) => {
      if (!event) return;
      setTitle(event.title);
      setKind(event.kind);
      setDate(event.date);
      setTime(event.time ?? '');
      setLocation(event.location ?? '');
      setNotes(event.notes ?? '');
      setReminderMinutes(event.reminderMinutes);
    });
  }, [db, eventId]);

  const save = async () => {
    setSaving(true);
    setError('');
    let savedEventId = eventId;
    try {
      const input = { title, kind, date, time, location, notes, reminderMinutes };
      const existing = eventId ? await getEvent(db, eventId) : null;
      const event = eventId ? await updateEvent(db, eventId, input) : await createEvent(db, input);
      savedEventId = event.id;

      if (existing?.notificationId) await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
      if (reminderMinutes !== null) {
        try {
          const requested = await Notifications.getPermissionsAsync();
          const permission = requested.granted ? requested : await Notifications.requestPermissionsAsync();
          if (permission.granted) {
            const eventDate = fromIsoDate(date);
            const [hours, minutes] = (time || '09:00').split(':').map(Number);
            eventDate.setHours(hours, minutes, 0, 0);
            eventDate.setMinutes(eventDate.getMinutes() - reminderMinutes);
            if (eventDate.getTime() > Date.now()) {
              const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Um compromisso está chegando',
                  body: 'Abra o Ampara para revisar os detalhes que você registrou.',
                  data: { eventId: event.id },
                },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eventDate },
              });
              await setEventNotification(db, event.id, notificationId);
            } else {
              await setEventNotification(db, event.id, null);
              Alert.alert('Compromisso salvo', 'A data escolhida já passou para este lembrete. Você pode revisar o compromisso na agenda.');
            }
          } else {
            await setEventNotification(db, event.id, null);
            Alert.alert('Compromisso salvo', 'As notificações estão desativadas no aparelho. O compromisso continua na agenda.');
          }
        } catch {
          await setEventNotification(db, event.id, null);
          Alert.alert('Compromisso salvo', 'Não foi possível programar o lembrete. O compromisso continua na agenda.');
        }
      } else if (savedEventId) {
        await setEventNotification(db, savedEventId, null);
      }
      router.back();
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause.message : 'Não foi possível salvar o compromisso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen bottomInset={24}>
      <AppText accessibilityRole="header" variant="display" style={styles.title}>{eventId ? 'Revise o compromisso.' : 'O que não pode passar despercebido?'}</AppText>
      <AppText tone="muted" style={styles.subtitle}>Registre o que sua família precisa ter à mão.</AppText>
      <ActivePersonNotice interactive={false} />
      <Field label="Nome do compromisso" value={title} onChangeText={setTitle} placeholder="Ex.: consulta com a cardiologista" autoCapitalize="sentences" />
      <OptionChips label="Tipo" value={kind} onChange={setKind} options={eventOptions} />
      <DateField label="Data" value={date} onChange={setDate} />
      <Field label="Horário" value={time} onChangeText={setTime} placeholder="Ex.: 09:30" keyboardType="numbers-and-punctuation" hint="Opcional. Use o formato 24 horas. Sem horário, o lembrete considera 9h." />
      <Field label="Local" value={location} onChangeText={setLocation} placeholder="Clínica, endereço ou referência" />
      <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="O que vale lembrar antes de sair?" multiline />
      <OptionChips
        label="Lembrete neste aparelho"
        value={reminderMinutes === null ? 'nenhum' : String(reminderMinutes)}
        onChange={(value) => setReminderMinutes(value === 'nenhum' ? null : Number(value))}
        options={[
          { value: 'nenhum', label: 'Sem lembrete' },
          { value: '30', label: '30 min antes' },
          { value: '1440', label: '1 dia antes' },
        ]}
      />
      <View style={styles.privacyNote}>
        <AppText tone="muted" variant="small">O aviso que aparece na tela bloqueada é genérico. Os detalhes ficam dentro do app.</AppText>
      </View>
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title={saving ? 'Salvando…' : 'Salvar compromisso'} onPress={() => void save()} disabled={saving || title.trim().length < 2} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6 },
  subtitle: { marginTop: 8, marginBottom: 24 },
  privacyNote: { padding: 14, backgroundColor: theme.colors.forestSoft, borderRadius: theme.radius.md, marginBottom: 18 },
  error: { marginBottom: 14 },
});
