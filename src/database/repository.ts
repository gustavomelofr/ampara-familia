import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  CareDocument,
  CareEvent,
  CareTask,
  CareProfile,
  EventKind,
  Expense,
  MedicationNote,
  Relationship,
} from '@/src/database/models';
import { isValidIsoDate } from '@/src/utils/date';

export type EventInput = {
  title: string;
  kind: EventKind;
  date: string;
  time?: string;
  location?: string;
  notes?: string;
  reminderMinutes?: number | null;
};

export type TaskInput = {
  title: string;
  dueDate?: string;
  assignee?: string;
  notes?: string;
};

export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

type RecipientRow = { id: number; person_name: string; relationship: Relationship; updated_at: string };
type EventRow = {
  id: number; title: string; kind: EventKind; event_date: string; event_time: string | null;
  location: string | null; notes: string | null; reminder_minutes: number | null;
  notification_id: string | null;
};
type TaskRow = {
  id: number; title: string; due_date: string | null; assignee: string | null;
  notes: string | null; completed: number;
};
type ExpenseRow = {
  id: number; title: string; amount_cents: number; category: string; spent_on: string; notes: string | null;
};
type DocumentRow = {
  id: number; title: string; location: string | null; expires_on: string | null; completed: number;
};
type MedicationRow = { id: number; name: string; schedule: string | null; notes: string | null; active: number };

const optionalText = (value?: string | null) => value?.trim() || null;
const requiredText = (value: string, label: string) => {
  const text = value.trim();
  if (text.length < 2) throw new RepositoryError(`Digite ${label}.`);
  return text;
};
async function requiredActiveRecipientId(db: SQLiteDatabase) {
  const id = await getActiveCareProfileId(db);
  if (!id) throw new RepositoryError('Cadastre uma pessoa acompanhada para continuar.');
  return id;
}
const mapEvent = (row: EventRow): CareEvent => ({
  id: row.id, title: row.title, kind: row.kind, date: row.event_date, time: row.event_time,
  location: row.location, notes: row.notes, reminderMinutes: row.reminder_minutes,
  notificationId: row.notification_id,
});
const mapTask = (row: TaskRow): CareTask => ({
  id: row.id, title: row.title, dueDate: row.due_date, assignee: row.assignee,
  notes: row.notes, completed: row.completed === 1,
});
const mapExpense = (row: ExpenseRow): Expense => ({
  id: row.id, title: row.title, amountCents: row.amount_cents, category: row.category,
  spentOn: row.spent_on, notes: row.notes,
});
const mapDocument = (row: DocumentRow): CareDocument => ({
  id: row.id, title: row.title, location: row.location, expiresOn: row.expires_on,
  completed: row.completed === 1,
});
const mapMedication = (row: MedicationRow): MedicationNote => ({
  id: row.id, name: row.name, schedule: row.schedule, notes: row.notes, active: row.active === 1,
});

const mapProfile = (row: RecipientRow): CareProfile => ({
  id: row.id,
  personName: row.person_name,
  relationship: row.relationship,
  updatedAt: row.updated_at,
});

export async function listCareProfiles(db: SQLiteDatabase): Promise<CareProfile[]> {
  const rows = await db.getAllAsync<RecipientRow>(
    'SELECT id, person_name, relationship, updated_at FROM care_recipients ORDER BY id ASC',
  );
  return rows.map(mapProfile);
}

export async function getActiveCareProfileId(db: SQLiteDatabase): Promise<number | null> {
  const settings = await db.getFirstAsync<{ active_recipient_id: number | null }>(
    'SELECT active_recipient_id FROM app_settings WHERE id = 1',
  );
  const activeId = settings?.active_recipient_id;
  if (activeId) {
    const active = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM care_recipients WHERE id = ?', activeId,
    );
    if (active) return active.id;
  }

  const first = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM care_recipients ORDER BY id ASC LIMIT 1',
  );
  if (!first) return null;
  await db.runAsync(
    `INSERT INTO app_settings (id, active_recipient_id) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET active_recipient_id = excluded.active_recipient_id`,
    first.id,
  );
  return first.id;
}

export async function setActiveCareProfile(db: SQLiteDatabase, id: number) {
  const profile = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM care_recipients WHERE id = ?', id,
  );
  if (!profile) throw new RepositoryError('Essa pessoa acompanhada não foi encontrada.');
  await db.runAsync(
    `INSERT INTO app_settings (id, active_recipient_id) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET active_recipient_id = excluded.active_recipient_id`,
    id,
  );
}

export async function getCareProfile(db: SQLiteDatabase, id?: number): Promise<CareProfile | null> {
  const recipientId = id ?? await getActiveCareProfileId(db);
  if (!recipientId) return null;
  const row = await db.getFirstAsync<RecipientRow>(
    'SELECT id, person_name, relationship, updated_at FROM care_recipients WHERE id = ?',
    recipientId,
  );
  return row ? mapProfile(row) : null;
}

export async function createCareProfile(
  db: SQLiteDatabase,
  input: { personName: string; relationship: Relationship },
) {
  const name = requiredText(input.personName, 'o nome do seu familiar');
  let recipientId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM care_recipients',
    );
    if ((result?.count ?? 0) >= 2) throw new RepositoryError('Nesta versão, é possível organizar até duas pessoas.');
    const inserted = await db.runAsync(
      'INSERT INTO care_recipients (person_name, relationship) VALUES (?, ?)',
      name,
      input.relationship,
    );
    recipientId = inserted.lastInsertRowId;
    if ((result?.count ?? 0) === 0) {
      await db.runAsync(
        `INSERT INTO app_settings (id, active_recipient_id) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET active_recipient_id = excluded.active_recipient_id`,
        recipientId,
      );
    }
  });
  return recipientId;
}

export async function saveCareProfile(
  db: SQLiteDatabase,
  id: number,
  input: { personName: string; relationship: Relationship },
) {
  const name = requiredText(input.personName, 'o nome do seu familiar');
  const result = await db.runAsync(
    `UPDATE care_recipients SET person_name = ?, relationship = ?, updated_at = datetime('now') WHERE id = ?`,
    name,
    input.relationship,
    id,
  );
  if (result.changes < 1) throw new RepositoryError('Essa pessoa acompanhada não foi encontrada.');
}

export async function listEvents(db: SQLiteDatabase, fromDate?: string): Promise<CareEvent[]> {
  const recipientId = await requiredActiveRecipientId(db);
  const rows = fromDate
    ? await db.getAllAsync<EventRow>(
        `SELECT id, title, kind, event_date, event_time, location, notes, reminder_minutes, notification_id
         FROM care_events WHERE recipient_id = ? AND event_date >= ? ORDER BY event_date ASC, event_time ASC, id ASC`,
        recipientId,
        fromDate,
      )
    : await db.getAllAsync<EventRow>(
        `SELECT id, title, kind, event_date, event_time, location, notes, reminder_minutes, notification_id
         FROM care_events WHERE recipient_id = ? ORDER BY event_date DESC, event_time DESC, id DESC`,
        recipientId,
      );
  return rows.map(mapEvent);
}

export async function getEvent(db: SQLiteDatabase, id: number) {
  const recipientId = await requiredActiveRecipientId(db);
  const row = await db.getFirstAsync<EventRow>(
    `SELECT id, title, kind, event_date, event_time, location, notes, reminder_minutes, notification_id
     FROM care_events WHERE id = ? AND recipient_id = ?`, id, recipientId,
  );
  return row ? mapEvent(row) : null;
}

export async function createEvent(db: SQLiteDatabase, input: EventInput) {
  const recipientId = await requiredActiveRecipientId(db);
  const title = requiredText(input.title, 'um título para o compromisso');
  if (!isValidIsoDate(input.date)) throw new RepositoryError('Escolha uma data válida.');
  const time = optionalText(input.time);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new RepositoryError('Use um horário válido, como 09:30.');
  const result = await db.runAsync(
    `INSERT INTO care_events (recipient_id, title, kind, event_date, event_time, location, notes, reminder_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    recipientId, title, input.kind, input.date, time, optionalText(input.location),
    optionalText(input.notes), input.reminderMinutes ?? null,
  );
  const event = await getEvent(db, result.lastInsertRowId);
  if (!event) throw new RepositoryError('Não foi possível abrir o compromisso salvo.');
  return event;
}

export async function updateEvent(db: SQLiteDatabase, id: number, input: EventInput) {
  const recipientId = await requiredActiveRecipientId(db);
  const title = requiredText(input.title, 'um título para o compromisso');
  if (!isValidIsoDate(input.date)) throw new RepositoryError('Escolha uma data válida.');
  const time = optionalText(input.time);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new RepositoryError('Use um horário válido, como 09:30.');
  const existing = await getEvent(db, id);
  if (!existing) throw new RepositoryError('O compromisso não foi encontrado.');
  await db.runAsync(
    `UPDATE care_events SET title = ?, kind = ?, event_date = ?, event_time = ?, location = ?, notes = ?,
       reminder_minutes = ?, updated_at = datetime('now') WHERE id = ? AND recipient_id = ?`,
    title, input.kind, input.date, time, optionalText(input.location),
    optionalText(input.notes), input.reminderMinutes ?? null, id, recipientId,
  );
  const updated = await getEvent(db, id);
  if (!updated) throw new RepositoryError('Não foi possível abrir o compromisso atualizado.');
  return updated;
}

export async function setEventNotification(db: SQLiteDatabase, id: number, notificationId: string | null) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync('UPDATE care_events SET notification_id = ?, updated_at = datetime(\'now\') WHERE id = ? AND recipient_id = ?', notificationId, id, recipientId);
}

export async function deleteEvent(db: SQLiteDatabase, id: number) {
  const recipientId = await requiredActiveRecipientId(db);
  const event = await getEvent(db, id);
  await db.runAsync('DELETE FROM care_events WHERE id = ? AND recipient_id = ?', id, recipientId);
  return event?.notificationId ?? null;
}

export async function listAllEventNotificationIds(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ notification_id: string }>(
    'SELECT notification_id FROM care_events WHERE notification_id IS NOT NULL',
  );
  return rows.map((row) => row.notification_id);
}

export async function listTasks(db: SQLiteDatabase): Promise<CareTask[]> {
  const recipientId = await requiredActiveRecipientId(db);
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT id, title, due_date, assignee, notes, completed FROM care_tasks
     WHERE recipient_id = ? ORDER BY completed ASC, due_date IS NULL, due_date ASC, id DESC`,
    recipientId,
  );
  return rows.map(mapTask);
}

export async function createTask(db: SQLiteDatabase, input: TaskInput) {
  const recipientId = await requiredActiveRecipientId(db);
  const title = requiredText(input.title, 'uma descrição para a tarefa');
  if (input.dueDate && !isValidIsoDate(input.dueDate)) throw new RepositoryError('Escolha uma data válida.');
  const result = await db.runAsync(
    `INSERT INTO care_tasks (recipient_id, title, due_date, assignee, notes) VALUES (?, ?, ?, ?, ?)`,
    recipientId, title, input.dueDate || null, optionalText(input.assignee), optionalText(input.notes),
  );
  return result.lastInsertRowId;
}

export async function updateTask(db: SQLiteDatabase, id: number, input: TaskInput) {
  const recipientId = await requiredActiveRecipientId(db);
  const title = requiredText(input.title, 'uma descrição para a tarefa');
  if (input.dueDate && !isValidIsoDate(input.dueDate)) throw new RepositoryError('Escolha uma data válida.');
  await db.runAsync(
    `UPDATE care_tasks SET title = ?, due_date = ?, assignee = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND recipient_id = ?`,
    title, input.dueDate || null, optionalText(input.assignee), optionalText(input.notes), id, recipientId,
  );
}

export async function setTaskCompleted(db: SQLiteDatabase, id: number, completed: boolean) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync(
    `UPDATE care_tasks SET completed = ?, updated_at = datetime('now') WHERE id = ? AND recipient_id = ?`,
    completed ? 1 : 0, id, recipientId,
  );
}

export async function deleteTask(db: SQLiteDatabase, id: number) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync('DELETE FROM care_tasks WHERE id = ? AND recipient_id = ?', id, recipientId);
}

export async function listExpenses(db: SQLiteDatabase): Promise<Expense[]> {
  const recipientId = await requiredActiveRecipientId(db);
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT id, title, amount_cents, category, spent_on, notes FROM care_expenses WHERE recipient_id = ? ORDER BY spent_on DESC, id DESC`,
    recipientId,
  );
  return rows.map(mapExpense);
}

export async function createExpense(
  db: SQLiteDatabase,
  input: { title: string; amountCents: number; category: string; spentOn: string; notes?: string },
) {
  const recipientId = await requiredActiveRecipientId(db);
  const title = requiredText(input.title, 'uma descrição para o gasto');
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) throw new RepositoryError('Informe um valor válido.');
  if (!isValidIsoDate(input.spentOn)) throw new RepositoryError('Escolha uma data válida.');
  await db.runAsync(
    `INSERT INTO care_expenses (recipient_id, title, amount_cents, category, spent_on, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    recipientId, title, input.amountCents, requiredText(input.category, 'uma categoria'), input.spentOn, optionalText(input.notes),
  );
}

export async function deleteExpense(db: SQLiteDatabase, id: number) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync('DELETE FROM care_expenses WHERE id = ? AND recipient_id = ?', id, recipientId);
}

export async function listDocuments(db: SQLiteDatabase): Promise<CareDocument[]> {
  const recipientId = await requiredActiveRecipientId(db);
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT id, title, location, expires_on, completed FROM care_documents WHERE recipient_id = ? ORDER BY completed ASC, expires_on IS NULL, expires_on ASC, title ASC`,
    recipientId,
  );
  return rows.map(mapDocument);
}

export async function createDocument(
  db: SQLiteDatabase,
  input: { title: string; location?: string; expiresOn?: string },
) {
  const recipientId = await requiredActiveRecipientId(db);
  const title = requiredText(input.title, 'o nome do documento');
  if (input.expiresOn && !isValidIsoDate(input.expiresOn)) throw new RepositoryError('Escolha uma data válida.');
  await db.runAsync(
    `INSERT INTO care_documents (recipient_id, title, location, expires_on) VALUES (?, ?, ?, ?)`,
    recipientId, title, optionalText(input.location), input.expiresOn || null,
  );
}

export async function deleteDocument(db: SQLiteDatabase, id: number) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync('DELETE FROM care_documents WHERE id = ? AND recipient_id = ?', id, recipientId);
}

export async function setDocumentCompleted(db: SQLiteDatabase, id: number, completed: boolean) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync('UPDATE care_documents SET completed = ? WHERE id = ? AND recipient_id = ?', completed ? 1 : 0, id, recipientId);
}

export async function listMedications(db: SQLiteDatabase): Promise<MedicationNote[]> {
  const recipientId = await requiredActiveRecipientId(db);
  const rows = await db.getAllAsync<MedicationRow>(
    `SELECT id, name, schedule, notes, active FROM medication_notes WHERE recipient_id = ? AND active = 1 ORDER BY name COLLATE NOCASE`,
    recipientId,
  );
  return rows.map(mapMedication);
}

export async function createMedication(
  db: SQLiteDatabase,
  input: { name: string; schedule?: string; notes?: string },
) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync(
    `INSERT INTO medication_notes (recipient_id, name, schedule, notes) VALUES (?, ?, ?, ?)`,
    recipientId, requiredText(input.name, 'o nome do medicamento'), optionalText(input.schedule), optionalText(input.notes),
  );
}

export async function deleteMedication(db: SQLiteDatabase, id: number) {
  const recipientId = await requiredActiveRecipientId(db);
  await db.runAsync('UPDATE medication_notes SET active = 0 WHERE id = ? AND recipient_id = ?', id, recipientId);
}

export async function clearAllCareData(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM care_events');
    await db.runAsync('DELETE FROM care_tasks');
    await db.runAsync('DELETE FROM care_expenses');
    await db.runAsync('DELETE FROM care_documents');
    await db.runAsync('DELETE FROM medication_notes');
    await db.runAsync('DELETE FROM care_recipients');
    await db.runAsync('UPDATE app_settings SET active_recipient_id = NULL WHERE id = 1');
  });
}
