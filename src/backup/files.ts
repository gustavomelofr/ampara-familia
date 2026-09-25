import { Platform } from 'react-native';

import { BackupError, MAX_BACKUP_BYTES } from './format';

export function isMobileBackupAvailable(db: { databasePath?: unknown }): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') &&
    typeof db.databasePath === 'string' && db.databasePath.length > 0;
}

export async function shareEncryptedBackup(bytes: Uint8Array): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new BackupError('O compartilhamento de arquivos está disponível apenas no app para iOS ou Android.');
  }
  if (bytes.length === 0 || bytes.length > MAX_BACKUP_BYTES) throw new BackupError('O arquivo excede o limite de 5 MB.');
  const Sharing = await import('expo-sharing');
  if (!await Sharing.isAvailableAsync()) {
    throw new BackupError('O compartilhamento de arquivos não está disponível neste aparelho.');
  }
  const { File, Paths } = await import('expo-file-system');
  const { getRandomBytesAsync } = await import('expo-crypto');
  const suffix = Array.from(await getRandomBytesAsync(8), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const file = new File(Paths.cache, `ampara-${new Date().toISOString().slice(0, 10)}-${suffix}.ampara`);
  try {
    file.create();
    file.write(bytes);
    await Sharing.shareAsync(file.uri, { dialogTitle: 'Guardar backup criptografado', mimeType: 'application/octet-stream', UTI: 'public.data' });
  } finally {
    // The share sheet returning does not prove that the user saved the file.
    if (file.exists) file.delete();
  }
}

export async function pickEncryptedBackup(): Promise<{ bytes: Uint8Array; name: string } | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new BackupError('A restauração de arquivos está disponível apenas no app para iOS ou Android.');
  }
  const DocumentPicker = await import('expo-document-picker');
  const { File, Paths } = await import('expo-file-system');
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || result.assets.length !== 1) throw new BackupError('Selecione apenas um arquivo de backup.');

  const cacheRoot = Paths.cache.uri.replace(/\/+$/, '') + '/';
  // Never remove or read a file outside the temporary copy created by the picker.
  if (!asset.uri.startsWith(cacheRoot) || asset.uri.slice(cacheRoot.length).split('/').includes('..')) {
    throw new BackupError('Não foi possível acessar a cópia temporária do arquivo.');
  }
  const file = new File(asset.uri);
  try {
    if (typeof asset.size === 'number' && asset.size > MAX_BACKUP_BYTES) {
      throw new BackupError('O arquivo excede o limite de 5 MB. Nenhum registro foi alterado.');
    }
    if (!file.exists || file.size === 0 || file.size > MAX_BACKUP_BYTES) {
      throw new BackupError('Arquivo ausente, vazio ou maior que 5 MB. Nenhum registro foi alterado.');
    }
    const bytes = await file.bytes();
    // Check again after reading in case the copied file changed between size and read.
    if (bytes.length === 0 || bytes.length > MAX_BACKUP_BYTES) {
      throw new BackupError('O arquivo excede o limite de 5 MB ou está vazio. Nenhum registro foi alterado.');
    }
    return { bytes, name: asset.name.replace(/[\r\n\0]/g, ' ').slice(0, 120) };
  } finally {
    if (file.exists) file.delete();
  }
}
