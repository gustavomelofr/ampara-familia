import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { decryptSnapshot, isValidBackupPassphrase } from '@/src/backup/crypto';
import { pickEncryptedBackup } from '@/src/backup/files';
import { BackupError, type BackupSnapshot } from '@/src/backup/format';
import { restoreDatabaseFromBackup } from '@/src/database/backupRecovery';
import { AppText } from '@/src/components/AppText';
import { ConfirmPanel } from '@/src/components/ConfirmPanel';
import { Field } from '@/src/components/Field';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { theme } from '@/src/theme';

type SelectedBackup = { name: string; bytes: Uint8Array };

export function DatabaseRecoveryPanel({
  databasePath,
  onRecovered,
}: {
  databasePath: string;
  onRecovered: () => void;
}) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<SelectedBackup | null>(null);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<BackupSnapshot | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recoveryComplete, setRecoveryComplete] = useState(false);

  useEffect(() => () => {
    if (selected) selected.bytes.fill(0);
  }, [selected]);

  async function run(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof BackupError || cause instanceof Error
        ? cause.message
        : 'Não foi possível restaurar o backup. Mantenha este aparelho e tente novamente; não apague o arquivo de recuperação.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <AppText variant="label">Recuperar por um backup criptografado</AppText>
      <AppText tone="muted" variant="small">
        O banco atual não abriu. Escolha um arquivo .ampara e sua senha. A restauração prepara e verifica
        um novo banco antes de substituir o arquivo inacessível.
      </AppText>
      <PrimaryButton
        title={busy ? 'Aguarde…' : 'Escolher arquivo de backup'}
        secondary
        onPress={() => void run(async () => {
          const backup = await pickEncryptedBackup();
          if (!backup) return;
          selected?.bytes.fill(0);
          setSelected(backup);
          setPassword('');
          setPending(null);
        })}
        disabled={busy || recoveryComplete}
      />
      {selected ? (
        <View style={styles.selected}>
          <AppText variant="label">Arquivo: {selected.name}</AppText>
          <Field
            label="Senha do backup"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            editable={!busy}
          />
          <PrimaryButton
            title={busy ? 'Verificando…' : 'Verificar arquivo'}
            onPress={() => void run(async () => {
              if (!selected) throw new BackupError('Escolha um arquivo de backup antes de continuar.');
              if (!isValidBackupPassphrase(password)) throw new BackupError('Digite a senha do backup.');
              const snapshot = await decryptSnapshot(selected.bytes, password);
              selected.bytes.fill(0);
              setSelected(null);
              setPassword('');
              setPending(snapshot);
            })}
            disabled={busy || !isValidBackupPassphrase(password)}
          />
        </View>
      ) : null}
      {pending ? (
        <ConfirmPanel
          title="Substituir o banco que não abre?"
          message={`O backup de ${pending.recipients.length} ${pending.recipients.length === 1 ? 'pessoa' : 'pessoas'} foi validado. O arquivo atual está inacessível; qualquer alteração que não esteja neste backup poderá não ser recuperada. Os lembretes precisarão ser recriados.`}
          confirmLabel={busy ? 'Restaurando…' : 'Restaurar este backup'}
          disabled={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void run(async () => {
            if (!pending) return;
            const remindersPending = await restoreDatabaseFromBackup(databasePath, pending);
            setPending(null);
            setNotice(remindersPending
              ? 'Backup restaurado, mas alguns lembretes antigos ainda podem aparecer. Revise a agenda e recrie os lembretes necessários.'
              : 'Backup restaurado. Os lembretes não são incluídos no arquivo; abra os compromissos e recrie os necessários.');
            setRecoveryComplete(true);
          })}
        />
      ) : null}
      {error ? <ScreenMessage tone="error" title="A restauração não foi concluída" message={error} /> : null}
      {notice ? <ScreenMessage title="Backup restaurado" message={notice} /> : null}
      {recoveryComplete ? <PrimaryButton title="Abrir registros" secondary onPress={onRecovered} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 20, paddingTop: 18, gap: 12 },
  selected: { padding: 16, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, gap: 10 },
});
