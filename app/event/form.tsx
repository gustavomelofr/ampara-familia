import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ActivePersonNotice } from '@/src/components/ActivePersonNotice';
import { DateField } from '@/src/components/DateField';
import { Field } from '@/src/components/Field';
import { OptionChips } from '@/src/components/OptionChips';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { createEvent, getEvent, RepositoryError, setEventNotification, updateEvent } from '@/src/database/repository';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
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
  const db = useAppDatabase();
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
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(Boolean(eventId));

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError('');
    void getEvent(db, eventId).then((event) => {
      if (!active) return;
      if (!event) {
        setLoadError('Este compromisso não está disponível neste perfil.');
        return;
      }
      setTitle(event.title);
      setKind(event.kind);
      setDate(event.date);
      setTime(event.time ?? '');
      setLocation(event.location ?? '');
      setNotes(event.notes ?? '');
      setReminderMinutes(event.reminderMinutes);
    }).catch(() => {
      if (active) setLoadError('Não foi possível abrir o compromisso. Tente novamente.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, eventId, loadAttempt]);

  const save = async () => {
    if (saved) {
      router.back();
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const input = { title, kind, date, time, location, notes, reminderMinutes };
      const existing = eventId ? await getEvent(db, eventId) : null;
      const event = eventId ? await updateEvent(db, eventId, input) : await createEvent(db, input);
      let reminderNotice = '';
      let canScheduleReminder = true;
      if (existing?.notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
          await setEventNotification(db, event.id, null);
        } catch {
          canScheduleReminder = false;
          reminderNotice = 'O compromisso foi salvo, mas não foi possível substituir o aviso anterior. Ele pode continuar no horário antigo.';
        }
      }
      if (reminderMinutes !== null && canScheduleReminder) {
        let scheduledNotificationId: string | null = null;
        try {
          const requested = await Notifications.getPermissionsAsync();
          const permission = requested.granted ? requested : await Notifications.requestPermissionsAsync();
          if (permission.granted) {
            const eventDate = fromIsoDate(date);
            const [hours, minutes] = (time || '09:00').split(':').map(Number);
            eventDate.setHours(hours, minutes, 0, 0);
            eventDate.setMinutes(eventDate.getMinutes() - reminderMinutes);
            if (eventDate.getTime() > Date.now()) {
              scheduledNotificationId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Um compromisso está chegando',
                  body: 'Abra o Ampara para revisar os detalhes que você registrou.',
                  data: { eventId: event.id },
                },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eventDate },
              });
              await setEventNotification(db, event.id, scheduledNotificationId);
            } else {
              reminderNotice = 'A data já passou para o horário do lembrete. O compromisso continua na agenda, sem aviso agendado.';
            }
          } else {
            reminderNotice = 'As notificações estão desativadas no aparelho. O compromisso continua na agenda, sem aviso agendado.';
          }
        } catch {
          if (scheduledNotificationId) {
            try { await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId); } catch { /* O usuário já recebeu o aviso de falha abaixo. */ }
          }
          reminderNotice = 'Não foi possível programar o lembrete. O compromisso continua na agenda.';
        }
      }
      if (reminderNotice) {
        setNotice(reminderNotice);
        setSaved(true);
        return;
      }
      router.back();
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause.message : 'Não foi possível salvar o compromisso.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppScreen bottomInset={24}>
        <PageHeader eyebrow="AGENDA" title="Abrindo compromisso." subtitle="Carregando os detalhes salvos neste aparelho." onBack={() => router.back()} />
      </AppScreen>
    );
  }

  if (loadError) {
    return (
      <AppScreen bottomInset={24}>
        <PageHeader eyebrow="AGENDA" title="Compromisso indisponível." onBack={() => router.back()} />
        <ScreenMessage tone="error" title="Não foi possível abrir o compromisso" message={loadError} actionLabel="Tentar novamente" onAction={() => setLoadAttempt((attempt) => attempt + 1)} />
      </AppScreen>
    );
  }

  if (saved) {
    return (
      <AppScreen bottomInset={24}>
        <PageHeader eyebrow="AGENDA" title="Compromisso salvo." onBack={() => router.back()} />
        <ScreenMessage title="O registro está na agenda" message={notice} actionLabel="Voltar à agenda" onAction={() => router.back()} />
      </AppScreen>
    );
  }

  return (
    <AppScreen bottomInset={24}>
      <PageHeader eyebrow="AGENDA" title={eventId ? 'Revise o compromisso.' : 'O que precisa ficar marcado?'} subtitle="Registre o que sua família precisa ter à mão." onBack={() => router.back()} />
      <ActivePersonNotice interactive={false} />
      <Field label="Nome do compromisso" testID="event-title" value={title} onChangeText={setTitle} placeholder="Ex.: consulta com a cardiologista" autoCapitalize="sentences" />
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
  privacyNote: { padding: 14, backgroundColor: theme.colors.forestSoft, borderRadius: theme.radius.md, marginBottom: 18 },
  error: { marginBottom: 14 },
});
