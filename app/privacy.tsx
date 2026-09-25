import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ConfirmPanel } from '@/src/components/ConfirmPanel';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { clearAllCareData, listAllEventNotificationIds } from '@/src/database/repository';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
import { theme } from '@/src/theme';

export default function PrivacyScreen() {
  const db = useAppDatabase();
  const router = useRouter();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteAll = async () => {
    setDeleting(true);
    setError('');
    try {
      const notifications = await listAllEventNotificationIds(db);
      for (const notificationId of notifications) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }
      await clearAllCareData(db);
      router.replace('/onboarding');
    } catch {
      setError('Não foi possível apagar todos os dados e lembretes. Nenhum registro foi removido; tente novamente.');
      setConfirmingDelete(false);
    } finally { setDeleting(false); }
  };

  return (
    <AppScreen bottomInset={24}>
      <PageHeader eyebrow="DADOS E PRIVACIDADE" title="Seus dados, no seu aparelho." subtitle="O Ampara não cria conta e não sincroniza registros com outros celulares." onBack={() => router.back()} />
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
        <AppText tone="muted">Você pode criar e restaurar um arquivo criptografado com uma senha escolhida por você. No Android, os dados do app não entram no backup automático do sistema; no iPhone, a chave do banco é vinculada à proteção do aparelho. Confirme sempre que o arquivo exportado foi salvo fora deste celular.</AppText>
        <PrimaryButton title="Criar ou restaurar backup" secondary onPress={() => router.push('/backup')} />
      </View>
      <View style={styles.section}>
        <AppText variant="label">Proteja o aparelho</AppText>
        <AppText tone="muted">O Ampara pede Face ID, Touch ID ou código do aparelho ao abrir e ao voltar ao app. Os registros locais usam SQLCipher, com a chave no armazenamento seguro do sistema. O app também bloqueia capturas de tela e oculta a prévia nas telas recentes quando o sistema permite. Mantenha o bloqueio de tela ativo.</AppText>
      </View>
      {error ? <ScreenMessage tone="error" title="Os dados não foram apagados" message={error} /> : null}
      {confirmingDelete ? (
        <ConfirmPanel
          title="Apagar todos os registros?"
          message="O perfil, a agenda, as tarefas e as anotações serão removidos deste aparelho. Essa ação não pode ser desfeita."
          confirmLabel={deleting ? 'Apagando…' : 'Apagar tudo'}
          disabled={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void deleteAll()}
        />
      ) : (
        <PrimaryButton title="Apagar todos os registros" danger onPress={() => setConfirmingDelete(true)} disabled={deleting} />
      )}
      <AppText tone="muted" variant="small" style={styles.footer}>Lembretes não confirmam que uma consulta ou atividade aconteceu. O Ampara não substitui orientação profissional.</AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 7 },
  footer: { textAlign: 'center', marginTop: 18 },
});
