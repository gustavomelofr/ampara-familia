import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToUtf8, concatBytes, utf8ToBytes } from '@noble/hashes/utils';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytesAsync } from 'expo-crypto';

import { BackupError, MAX_BACKUP_BYTES, type BackupSnapshot, validateSnapshot } from './format';

// Wire format: 8-byte magic | 1-byte format version | 4-byte BE PBKDF2 rounds |
// 16-byte salt | AESSealedData.combined() (12-byte random nonce | ciphertext | 16-byte tag).
// The complete header is authenticated as AES-GCM additionalData; no plaintext is written to disk.
const MAGIC = utf8ToBytes('AMPARABK');
const FORMAT_VERSION = 1;
const ROUNDS = 600_000;
const SALT_BYTES = 16;
const HEADER_BYTES = MAGIC.length + 1 + 4 + SALT_BYTES;
const MIN_SEALED_BYTES = 12 + 1 + 16;

export function isValidBackupPassphrase(passphrase: string): boolean {
  return Array.from(passphrase).length >= 12 && passphrase.trim().length > 0;
}

function header(salt: Uint8Array): Uint8Array {
  const result = new Uint8Array(HEADER_BYTES);
  result.set(MAGIC);
  result[MAGIC.length] = FORMAT_VERSION;
  new DataView(result.buffer).setUint32(MAGIC.length + 1, ROUNDS, false);
  result.set(salt, MAGIC.length + 5);
  return result;
}

function parseHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length < HEADER_BYTES + MIN_SEALED_BYTES || bytes.length > MAX_BACKUP_BYTES ||
      MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new BackupError('O arquivo selecionado não é um backup válido do Ampara. Nenhum registro foi alterado.');
  }
  if (bytes[MAGIC.length] !== FORMAT_VERSION) {
    throw new BackupError('Esta versão do arquivo não é compatível com o aplicativo. Nenhum registro foi alterado.');
  }
  // Refuse attacker-chosen work factors before doing any expensive key derivation.
  const rounds = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(MAGIC.length + 1, false);
  if (rounds !== ROUNDS) {
    throw new BackupError('Os parâmetros de segurança do arquivo não são compatíveis. Nenhum registro foi alterado.');
  }
  return bytes.subarray(0, HEADER_BYTES);
}

async function keyFor(passphrase: string, salt: Uint8Array): Promise<AESEncryptionKey> {
  const passwordBytes = utf8ToBytes(passphrase);
  try {
    const derived = await pbkdf2Async(sha256, passwordBytes, salt, { c: ROUNDS, dkLen: 32, asyncTick: 20 });
    try {
      return await AESEncryptionKey.import(derived);
    } finally {
      derived.fill(0);
    }
  } finally {
    passwordBytes.fill(0);
  }
}

export async function encryptSnapshot(snapshot: BackupSnapshot, passphrase: string, confirmation: string): Promise<Uint8Array> {
  if (!isValidBackupPassphrase(passphrase)) throw new BackupError('Use uma senha de pelo menos 12 caracteres.');
  if (passphrase !== confirmation) throw new BackupError('As senhas não coincidem.');
  validateSnapshot(snapshot);
  const plaintext = utf8ToBytes(JSON.stringify(snapshot));
  if (plaintext.length + HEADER_BYTES + 28 > MAX_BACKUP_BYTES) {
    throw new BackupError('Há registros demais para este backup (limite de 5 MB).');
  }
  const salt = await getRandomBytesAsync(SALT_BYTES);
  const authenticatedHeader = header(salt);
  try {
    const key = await keyFor(passphrase, salt);
    const sealed = await aesEncryptAsync(plaintext, key, { additionalData: authenticatedHeader });
    const output = concatBytes(authenticatedHeader, await sealed.combined());
    if (output.length > MAX_BACKUP_BYTES) throw new BackupError('Há registros demais para este backup (limite de 5 MB).');
    return output;
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptSnapshot(bytes: Uint8Array, passphrase: string): Promise<BackupSnapshot> {
  const authenticatedHeader = parseHeader(bytes);
  if (!isValidBackupPassphrase(passphrase)) throw new BackupError('Digite a senha do backup (pelo menos 12 caracteres).');
  const salt = authenticatedHeader.subarray(MAGIC.length + 5);
  const key = await keyFor(passphrase, salt);
  let plaintext: Uint8Array;
  try {
    plaintext = await aesDecryptAsync(AESSealedData.fromCombined(bytes.subarray(HEADER_BYTES)), key, {
      additionalData: authenticatedHeader,
    });
  } catch {
    throw new BackupError('Senha incorreta ou arquivo danificado. Nenhum registro foi alterado.');
  }
  try {
    // Authenticated data is still untrusted input until its shape and relationships are validated.
    return validateSnapshot(JSON.parse(bytesToUtf8(plaintext)) as unknown);
  } catch (cause) {
    if (cause instanceof BackupError) throw cause;
    throw new BackupError('O conteúdo do backup é inválido. Nenhum registro foi alterado.');
  } finally {
    plaintext.fill(0);
  }
}
