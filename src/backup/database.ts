import type { SQLiteDatabase } from 'expo-sqlite';

import { withEncryptedExclusiveTransaction } from '@/src/database/encryption';
import { retryPendingNotificationCleanup, stagePendingNotificationCleanup } from '@/src/database/notificationCleanup';

import {
  BACKUP_SCHEMA_VERSION, BackupError, MAX_RECORDS_PER_TABLE, validateSnapshot,
  type BackupSnapshot, type Document, type Event, type Expense, type Medication, type Recipient, type Task,
} from './format';
import { isMobileBackupAvailable } from './files';

function exclusiveAvailable(db: SQLiteDatabase): void {
  if (!isMobileBackupAvailable(db)) {
    throw new BackupError('Backup e restauração estão disponíveis apenas no app para iOS ou Android.');
  }
}

async function requireV2(db: SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version?.user_version !== BACKUP_SCHEMA_VERSION) {
    throw new BackupError('A versão dos dados deste aparelho não é compatível com o backup.');
  }
}

// Explicit columns exclude device-local notification_id. The limit also bounds malformed local data.
const limit = `LIMIT ${MAX_RECORDS_PER_TABLE + 1}`;

export async function captureSnapshot(db: SQLiteDatabase, encryptionKey?: string): Promise<BackupSnapshot> {
  exclusiveAvailable(db);
  return withEncryptedExclusiveTransaction(db.databasePath, async (txn) => {
    await requireV2(txn);
    const settings = await txn.getFirstAsync<{ active_recipient_id: number | null }>(
      'SELECT active_recipient_id FROM app_settings WHERE id = 1',
    );
    if (!settings) throw new BackupError('Não foi possível ler o perfil ativo neste aparelho.');

    // Reads use a separately keyed, exclusive connection for one consistent logical snapshot.
    const recipients = await txn.getAllAsync<Recipient>(
      `SELECT id, person_name, relationship, created_at, updated_at FROM care_recipients ORDER BY id ${limit}`,
    );
    const events = await txn.getAllAsync<Event>(
      `SELECT id, recipient_id, title, kind, event_date, event_time, location, notes,
              reminder_minutes, created_at, updated_at FROM care_events ORDER BY id ${limit}`,
    );
    const tasks = await txn.getAllAsync<Task>(
      `SELECT id, recipient_id, title, due_date, assignee, notes, completed, created_at, updated_at
       FROM care_tasks ORDER BY id ${limit}`,
    );
    const expenses = await txn.getAllAsync<Expense>(
      `SELECT id, recipient_id, title, amount_cents, category, spent_on, notes, created_at
       FROM care_expenses ORDER BY id ${limit}`,
    );
    const documents = await txn.getAllAsync<Document>(
      `SELECT id, recipient_id, title, location, expires_on, completed, created_at
       FROM care_documents ORDER BY id ${limit}`,
    );
    const medications = await txn.getAllAsync<Medication>(
      `SELECT id, recipient_id, name, schedule, notes, active, created_at
       FROM medication_notes ORDER BY id ${limit}`,
    );
    return validateSnapshot({
      schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(),
      activeRecipientId: settings.active_recipient_id,
      recipients, events, tasks, expenses, documents, medications,
    });
  }, encryptionKey);
}

// Returns the previous device's scheduled IDs only after COMMIT, for best-effort cancellation.
// Never cancel them inside the transaction: a failed insert must leave prior reminders intact.
export async function restoreSnapshot(db: SQLiteDatabase, candidate: unknown, encryptionKey?: string): Promise<string[]> {
  const snapshot = validateSnapshot(candidate);
  exclusiveAvailable(db);
  try {
    return await withEncryptedExclusiveTransaction(db.databasePath, async (txn) => {
      await requireV2(txn);
      const ids = await txn.getAllAsync<{ notification_id: string }>(
        'SELECT notification_id FROM care_events WHERE notification_id IS NOT NULL',
      );
      await stagePendingNotificationCleanup(ids.map((row) => row.notification_id));

      await txn.runAsync('UPDATE app_settings SET active_recipient_id = NULL WHERE id = 1');
      await txn.runAsync('DELETE FROM care_events');
      await txn.runAsync('DELETE FROM care_tasks');
      await txn.runAsync('DELETE FROM care_expenses');
      await txn.runAsync('DELETE FROM care_documents');
      await txn.runAsync('DELETE FROM medication_notes');
      await txn.runAsync('DELETE FROM care_recipients');

    for (const row of snapshot.recipients) {
      await txn.runAsync(
        `INSERT INTO care_recipients (id, person_name, relationship, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        row.id, row.person_name, row.relationship, row.created_at, row.updated_at,
      );
    }
    for (const row of snapshot.events) {
      await txn.runAsync(
        `INSERT INTO care_events (id, recipient_id, title, kind, event_date, event_time, location,
                                  notes, reminder_minutes, notification_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        row.id, row.recipient_id, row.title, row.kind, row.event_date, row.event_time,
        row.location, row.notes, row.reminder_minutes, row.created_at, row.updated_at,
      );
    }
    for (const row of snapshot.tasks) {
      await txn.runAsync(
        `INSERT INTO care_tasks (id, recipient_id, title, due_date, assignee, notes, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.recipient_id, row.title, row.due_date, row.assignee, row.notes,
        row.completed, row.created_at, row.updated_at,
      );
    }
    for (const row of snapshot.expenses) {
      await txn.runAsync(
        `INSERT INTO care_expenses (id, recipient_id, title, amount_cents, category, spent_on, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.recipient_id, row.title, row.amount_cents, row.category,
        row.spent_on, row.notes, row.created_at,
      );
    }
    for (const row of snapshot.documents) {
      await txn.runAsync(
        `INSERT INTO care_documents (id, recipient_id, title, location, expires_on, completed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.recipient_id, row.title, row.location, row.expires_on, row.completed, row.created_at,
      );
    }
    for (const row of snapshot.medications) {
      await txn.runAsync(
        `INSERT INTO medication_notes (id, recipient_id, name, schedule, notes, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.recipient_id, row.name, row.schedule, row.notes, row.active, row.created_at,
      );
    }
    await txn.runAsync(
      `INSERT INTO app_settings (id, active_recipient_id) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET active_recipient_id = excluded.active_recipient_id`,
      snapshot.activeRecipientId,
    );
      return ids.map((row) => row.notification_id);
    }, encryptionKey);
  } catch (error) {
    // If the SQL transaction rolled back, IDs still linked to old rows are left alone and the
    // temporary cleanup journal is cleared. If commit status was uncertain, reconciliation checks
    // the current database before cancelling anything.
    await retryPendingNotificationCleanup(db);
    throw error;
  }
}
