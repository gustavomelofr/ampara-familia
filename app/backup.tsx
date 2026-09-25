import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/src/components/AppScreen';
import { AppText } from '@/src/components/AppText';
import { ConfirmPanel } from '@/src/components/ConfirmPanel';
import { Field } from '@/src/components/Field';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { decryptSnapshot, encryptSnapshot, isValidBackupPassphrase } from '@/src/backup/crypto';
import { captureSnapshot, restoreSnapshot } from '@/src/backup/database';
import { isMobileBackupAvailable, pickEncryptedBackup, shareEncryptedBackup } from '@/src/backup/files';
import { BackupError, type BackupSnapshot } from '@/src/backup/format';
import { useAppDatabase } from '@/src/database/DatabaseProvider';
import { retryPendingNotificationCleanup } from '@/src/database/notificationCleanup';
import { theme } from '@/src/theme';

type Work = 'export' | 'pick' | 'decrypt' | 'restore';

export default function BackupScreen() {
  const db = useAppDatabase();
  const router = useRouter();
  const supported = isMobileBackupAvailable(db);
  const running = useRef(false);
  const [busy, setBusy] = useState<Work | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exportPassword, setExportPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [selected, setSelected] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pending, setPending] = useState<BackupSnapshot | null>(null);
  const [restored, setRestored] = useState<BackupSnapshot | null>(null);

  async function work(step: Work, task: () => Promise<void>) {
    if (running.current || !supported) return;
    running.current = true;
    setBusy(step);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof BackupError ? cause.message :
        step === 'export' ? 'Não foi possível criar ou compartilhar o arquivo. Tente novamente.' :
          'Não foi possível abrir ou restaurar o arquivo. Nenhum registro foi substituído.');
    } finally {
      setBusy(null);
      running.current = false;
    }
  }

  function exportFile() {
    void work('export', async () => {
      try {
        if (!isValidBackupPassphrase(exportPassword)) throw new BackupError('Use uma senha de pelo menos 12 caracteres.');
        if (exportPassword !== confirmation) throw new BackupError('As senhas não coincidem.');
        const snapshot = await captureSnapshot(db);
        const encrypted = await encryptSnapshot(snapshot, exportPassword, confirmation);
        try {
          await shareEncryptedBackup(encrypted);
          setNotice('As opções de compartilhamento foram fechadas. Confira no destino escolhido se o arquivo foi realmente salvo.');
        } finally {
          encrypted.fill(0);
        }
      } finally {
        setExportPassword('');
        setConfirmation('');
      }
    });
  }

  function pickFile() {
    void work('pick', async () => {
      const picked = await pickEncryptedBackup();
      if (picked) {
        selected?.bytes.fill(0);
        setSelected(picked);
        setRestorePassword('');
        setPending(null);
        setRestored(null);
      }
    });
  }

  function checkFile() {
    void work('decrypt', async () => {
      if (!selected) throw new BackupError('Escolha um arquivo de backup antes de continuar.');
      try {
        const snapshot = await decryptSnapshot(selected.bytes, restorePassword);
        selected.bytes.fill(0);
        setSelected(null);
        setPending(snapshot);
      } finally {
        setRestorePassword('');
      }
    });
  }

  function replaceRecords() {
    void work('restore', async () => {
      if (!pending) return;
      const previousNotificationIds = await restoreSnapshot(db, pending);
      setPending(null);
      setRestored(pending);
      const cancellationFailed = previousNotificationIds.length > 0 &&
        !await retryPendingNotificationCleanup(db);
      setNotice(cancellationFailed
        ? 'Registros restaurados. Alguns avisos antigos podem continuar no aparelho. Revise-os e recrie os lembretes dos compromissos importados.'
        : 'Registros restaurados. Os avisos antigos foram cancelados. Abra e salve cada compromisso para criar novamente os lembretes necessários.');
    });
  }

  return (
    <AppScreen bottomInset={24}>
      <PageHeader eyebrow="DADOS E PRIVACIDADE" title="Backup protegido por senha." subtitle="Guarde uma cópia criptografada dos registros de todas as pessoas acompanhadas." onBack={() => router.back()} />
      {!supported ? (
        <ScreenMessage title="Disponível no celular" message="Backup e restauração exigem o app para iOS ou Android, com armazenamento local e transações SQLite disponíveis. A versão web não compartilha arquivos de backup." />
      ) : (
        <>
          <View style={styles.section}>
            <AppText accessibilityRole="header" variant="title">Criar uma cópia</AppText>
            <AppText tone="muted">Inclui os dois perfis, agenda, tarefas concluídas, despesas, documentos e medicamentos inativos. O arquivo só é gerado quando você escolhe compartilhar.</AppText>
            <Field label="Senha do backup" hint="Mínimo de 12 caracteres. Guarde-a separadamente do arquivo; não é possível recuperá-la." value={exportPassword} onChangeText={setExportPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" importantForAutofill="no" editable={!busy} />
            <Field label="Confirme a senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" importantForAutofill="no" editable={!busy} />
            <PrimaryButton title={busy === 'export' ? 'Protegendo o arquivo…' : 'Criar e compartilhar backup'} onPress={exportFile} disabled={Boolean(busy) || !isValidBackupPassphrase(exportPassword) || !confirmation} />
          </View>

          <View style={styles.section}>
            <AppText accessibilityRole="header" variant="title">Restaurar de um arquivo</AppText>
            <AppText tone="muted">Escolha um arquivo .ampara de até 5 MB. Primeiro verificamos a senha e todos os registros; depois você confirma a substituição.</AppText>
            <PrimaryButton title={busy === 'pick' ? 'Abrindo arquivos…' : 'Escolher arquivo'} secondary onPress={pickFile} disabled={Boolean(busy)} />
            {selected ? (
              <View style={styles.selected}>
                <AppText variant="label">Arquivo escolhido: {selected.name}</AppText>
                <Field label="Senha deste arquivo" value={restorePassword} onChangeText={setRestorePassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" importantForAutofill="no" editable={!busy} />
                <PrimaryButton title={busy === 'decrypt' ? 'Verificando arquivo…' : 'Verificar arquivo'} onPress={checkFile} disabled={Boolean(busy) || !isValidBackupPassphrase(restorePassword)} />
              </View>
            ) : null}
            {pending ? (
              <ConfirmPanel
                title="Substituir todos os registros deste aparelho?"
                message={`O backup de ${pending.recipients.length} ${pending.recipients.length === 1 ? 'pessoa' : 'pessoas'} foi validado. Todos os perfis, compromissos, tarefas, despesas, documentos e medicamentos atuais serão substituídos. Isso não pode ser desfeito. Lembretes do arquivo precisarão ser criados novamente.`}
                confirmLabel={busy === 'restore' ? 'Restaurando…' : 'Substituir tudo'}
                disabled={Boolean(busy)}
                onCancel={() => setPending(null)}
                onConfirm={replaceRecords}
              />
            ) : null}
          </View>
          {busy === 'export' || busy === 'decrypt' || busy === 'restore' ? (
            <AppText tone="muted" accessibilityLiveRegion="polite" style={styles.progress}>Aguarde. Proteger ou abrir o arquivo pode levar alguns instantes.</AppText>
          ) : null}
          {error ? <ScreenMessage tone="error" title="Não foi possível continuar" message={error} /> : null}
          {notice ? <ScreenMessage title={restored ? 'Restauração concluída' : 'Confirme o arquivo no destino'} message={notice} /> : null}
          {restored ? <PrimaryButton title="Abrir registros" secondary onPress={() => router.replace(restored.recipients.length ? '/(tabs)' : '/onboarding')} /> : null}
          <View style={styles.security}>
            <AppText variant="label">Limites de segurança</AppText>
            <AppText tone="muted" variant="small">A senha protege este arquivo; é diferente da chave do banco local, que usa SQLCipher no app para iOS ou Android e fica no armazenamento seguro do sistema. Durante a migração de uma versão antiga, o banco original pode permanecer temporariamente como arquivo técnico de recuperação na pasta privada do app até que o banco cifrado seja reaberto e validado. Esse arquivo não usa a senha do backup e não é uma cópia pessoal para compartilhar. O arquivo de exportação é apagado do cache após o compartilhamento; os dados abertos ficam na memória enquanto são processados. O aplicativo não envia o arquivo a servidores, mas o destino escolhido pode guardar uma cópia. A senha não pode ser recuperada.</AppText>
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 22, paddingBottom: 28, gap: 12 },
  selected: { marginTop: 6, padding: 16, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, gap: 10 },
  progress: { paddingVertical: 12 },
  security: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 18, gap: 6, marginTop: 8 },
});
