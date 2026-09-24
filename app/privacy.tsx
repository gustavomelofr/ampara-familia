import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { clearAllCareData, listAllEventNotificationIds } from '@/src/database/repository';
import { theme } from '@/src/theme';

export default function PrivacyScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => Alert.alert(
    'Apagar todos os registros?',
    'O perfil, a agenda, as tarefas e as anotações serão removidos deste aparelho. Essa ação não pode ser desfeita.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar tudo', style: 'destructive', onPress: () => {
        setDeleting(true);
        void (async () => {
          try {
            const notifications = await listAllEventNotificationIds(db);
            for (const notificationId of notifications) {
              await Notifications.cancelScheduledNotificationAsync(notificationId);
            }
            await clearAllCareData(db);
            router.replace('/onboarding');
          } catch {
            setError('Não foi possível apagar todos os dados. Tente novamente.');
          } finally { setDeleting(false); }
        })();
      } },
    ],
  );

  return (
    <AppScreen bottomInset={24}>
      <AppText accessibilityRole="header" variant="display" style={styles.title}>Seus dados, no seu aparelho.</AppText>
      <AppText tone="muted" style={styles.subtitle}>O Ampara não cria conta e não sincroniza registros com outros celulares.</AppText>
      <View style={styles.section}>
        <AppText variant="label">O que fica salvo aqui</AppText>
        <AppText tone="muted">Nome do familiar, compromissos, tarefas, gastos e as anotações que você incluir. Lembretes agendados são locais.</AppText>
      </View>
      <View style={styles.section}>
        <AppText variant="label">Compartilhamento</AppText>
        <AppText tone="muted">Só acontece quando você escolhe as seções, revisa a prévia e abre as opções de compartilhamento do aparelho.</AppText>
      </View>
      <View style={styles.section}>
        <AppText variant="label">Limites desta versão</AppText>
        <AppText tone="muted">Ainda não há arquivo de backup ou restauração no app. O backup automático do aparelho depende das configurações do sistema. Para informações sensíveis, mantenha também uma cópia segura fora do celular.</AppText>
      </View>
      <View style={styles.section}>
        <AppText variant="label">Proteja o aparelho</AppText>
        <AppText tone="muted">Use o bloqueio de tela do telefone e evite registrar informações além do necessário. Esta versão não tem senha própria para abrir o Ampara.</AppText>
      </View>
      {error ? <AppText tone="danger" accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <PrimaryButton title={deleting ? 'Apagando…' : 'Apagar todos os registros'} secondary onPress={confirmDelete} disabled={deleting} />
      <AppText tone="muted" variant="small" style={styles.footer}>Lembretes não confirmam que uma consulta ou atividade aconteceu. O Ampara não substitui orientação profissional.</AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6 },
  subtitle: { marginTop: 8, marginBottom: 24 },
  section: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 7 },
  error: { marginBottom: 14 },
  footer: { textAlign: 'center', marginTop: 18 },
});
