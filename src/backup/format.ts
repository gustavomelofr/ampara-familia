import { isValidIsoDate } from '@/src/utils/date';

export const BACKUP_SCHEMA_VERSION = 2;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_RECORDS_PER_TABLE = 10_000;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export type Recipient = {
  id: number; person_name: string; relationship: 'mãe' | 'pai' | 'outro';
  created_at: string; updated_at: string;
};
export type Event = {
  id: number; recipient_id: number; title: string; kind: 'consulta' | 'exame' | 'prazo' | 'outro';
  event_date: string; event_time: string | null; location: string | null; notes: string | null;
  reminder_minutes: number | null; created_at: string; updated_at: string;
};
export type Task = {
  id: number; recipient_id: number; title: string; due_date: string | null;
  assignee: string | null; notes: string | null; completed: 0 | 1;
  created_at: string; updated_at: string;
};
export type Expense = {
  id: number; recipient_id: number; title: string; amount_cents: number; category: string;
  spent_on: string; notes: string | null; created_at: string;
};
export type Document = {
  id: number; recipient_id: number; title: string; location: string | null;
  expires_on: string | null; completed: 0 | 1; created_at: string;
};
export type Medication = {
  id: number; recipient_id: number; name: string; schedule: string | null;
  notes: string | null; active: 0 | 1; created_at: string;
};

// Logical v2 snapshot. notification_id is deliberately absent: it belongs to this device.
export type BackupSnapshot = {
  schemaVersion: 2;
  exportedAt: string;
  activeRecipientId: number | null;
  recipients: Recipient[];
  events: Event[];
  tasks: Task[];
  expenses: Expense[];
  documents: Document[];
  medications: Medication[];
};

function invalid(): never {
  throw new BackupError('O arquivo não contém um backup válido do Ampara. Nenhum registro foi alterado.');
}

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) return invalid();
  return object;
}

function text(value: unknown, required = false, max = 10_000): void {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || (required && !value.trim())) invalid();
}

function optionalText(value: unknown): void {
  if (value !== null) text(value);
}

function id(value: unknown): void {
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalid();
}

function date(value: unknown): void {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) || !isValidIsoDate(value)) invalid();
}

function timestamp(value: unknown): void {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)) invalid();
  date((value as string).slice(0, 10));
}

function flag(value: unknown): void {
  if (value !== 0 && value !== 1) invalid();
}

function rows(value: unknown, keys: string[], check: (row: Record<string, unknown>) => void): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > MAX_RECORDS_PER_TABLE) return invalid();
  const ids = new Set<number>();
  return value.map((item) => {
    const row = record(item, keys);
    id(row.id);
    if (ids.has(row.id as number)) invalid();
    ids.add(row.id as number);
    check(row);
    return row;
  });
}

function belongsTo(row: Record<string, unknown>, recipients: Set<number>): void {
  id(row.recipient_id);
  if (!recipients.has(row.recipient_id as number)) invalid();
}

export function validateSnapshot(value: unknown): BackupSnapshot {
  const snapshot = record(value, [
    'schemaVersion', 'exportedAt', 'activeRecipientId', 'recipients',
    'events', 'tasks', 'expenses', 'documents', 'medications',
  ]);
  if (snapshot.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupError('Esta versão do backup não é compatível com o aplicativo. Nenhum registro foi alterado.');
  }
  if (typeof snapshot.exportedAt !== 'string' ||
      !/^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(snapshot.exportedAt) ||
      !Number.isFinite(Date.parse(snapshot.exportedAt)) ||
      new Date(snapshot.exportedAt).toISOString() !== snapshot.exportedAt) invalid();

  if (!Array.isArray(snapshot.recipients) || snapshot.recipients.length > 2) invalid();
  const recipients = rows(snapshot.recipients,
    ['id', 'person_name', 'relationship', 'created_at', 'updated_at'], (row) => {
      text(row.person_name, true, 1000);
      if (!['mãe', 'pai', 'outro'].includes(row.relationship as string)) invalid();
      timestamp(row.created_at);
      timestamp(row.updated_at);
    });
  const recipientIds = new Set(recipients.map((row) => row.id as number));
  if (snapshot.activeRecipientId === null) {
    if (recipients.length !== 0) invalid();
  } else {
    id(snapshot.activeRecipientId);
    if (!recipientIds.has(snapshot.activeRecipientId as number)) invalid();
  }

  rows(snapshot.events, [
    'id', 'recipient_id', 'title', 'kind', 'event_date', 'event_time', 'location', 'notes',
    'reminder_minutes', 'created_at', 'updated_at',
  ], (row) => {
    belongsTo(row, recipientIds);
    text(row.title, true);
    if (!['consulta', 'exame', 'prazo', 'outro'].includes(row.kind as string)) invalid();
    date(row.event_date);
    if (row.event_time !== null && (typeof row.event_time !== 'string' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.event_time))) invalid();
    optionalText(row.location);
    optionalText(row.notes);
    if (row.reminder_minutes !== null && row.reminder_minutes !== 30 && row.reminder_minutes !== 1440) invalid();
    timestamp(row.created_at);
    timestamp(row.updated_at);
  });
  rows(snapshot.tasks, [
    'id', 'recipient_id', 'title', 'due_date', 'assignee', 'notes', 'completed', 'created_at', 'updated_at',
  ], (row) => {
    belongsTo(row, recipientIds);
    text(row.title, true);
    if (row.due_date !== null) date(row.due_date);
    optionalText(row.assignee);
    optionalText(row.notes);
    flag(row.completed);
    timestamp(row.created_at);
    timestamp(row.updated_at);
  });
  rows(snapshot.expenses, [
    'id', 'recipient_id', 'title', 'amount_cents', 'category', 'spent_on', 'notes', 'created_at',
  ], (row) => {
    belongsTo(row, recipientIds);
    text(row.title, true);
    if (!Number.isSafeInteger(row.amount_cents) || (row.amount_cents as number) < 0) invalid();
    text(row.category, true);
    date(row.spent_on);
    optionalText(row.notes);
    timestamp(row.created_at);
  });
  rows(snapshot.documents, [
    'id', 'recipient_id', 'title', 'location', 'expires_on', 'completed', 'created_at',
  ], (row) => {
    belongsTo(row, recipientIds);
    text(row.title, true);
    optionalText(row.location);
    if (row.expires_on !== null) date(row.expires_on);
    flag(row.completed);
    timestamp(row.created_at);
  });
  rows(snapshot.medications, [
    'id', 'recipient_id', 'name', 'schedule', 'notes', 'active', 'created_at',
  ], (row) => {
    belongsTo(row, recipientIds);
    text(row.name, true);
    optionalText(row.schedule);
    optionalText(row.notes);
    flag(row.active);
    timestamp(row.created_at);
  });
  return value as BackupSnapshot;
}
