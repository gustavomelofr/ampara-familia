import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { retryPendingNotificationCleanup } from '@/src/database/notificationCleanup';
import { removeLegacySqlCipherSecrets } from '@/src/database/legacyEncryptionCleanup';

export const DATABASE_NAME = 'ampara.db';
const DATABASE_VERSION = 2;

const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS care_profile (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  person_name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('mãe', 'pai', 'outro')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS care_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('consulta', 'exame', 'prazo', 'outro')),
  event_date TEXT NOT NULL,
  event_time TEXT,
  location TEXT,
  notes TEXT,
  reminder_minutes INTEGER,
  notification_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_care_events_date ON care_events(event_date, event_time);

CREATE TABLE IF NOT EXISTS care_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  due_date TEXT,
  assignee TEXT,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_care_tasks_due ON care_tasks(completed, due_date);

CREATE TABLE IF NOT EXISTS care_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  category TEXT NOT NULL,
  spent_on TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS care_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  location TEXT,
  expires_on TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medication_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  schedule TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export async function migrateDatabase(db: SQLiteDatabase): Promise<SQLiteDatabase> {
  db = await migrateDatabaseSchema(db);
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    await retryPendingNotificationCleanup(db);
    await removeLegacySqlCipherSecrets();
  }
  return db;
}

export async function migrateDatabaseSchema(db: SQLiteDatabase): Promise<SQLiteDatabase> {
  let integrity: { quick_check: string }[];
  try {
    // Read before any journal-mode or schema writes so SQLCipher/unknown files fail closed.
    integrity = await db.getAllAsync<{ quick_check: string }>('PRAGMA quick_check');
  } catch {
    throw new Error('Este arquivo não pôde ser validado como banco local. Seus registros não foram alterados; mantenha o app instalado e contate o suporte.');
  }
  if (integrity.length === 0 || integrity.some((row) => row.quick_check !== 'ok')) {
    throw new Error('Este arquivo não pôde ser validado como banco local. Seus registros não foram alterados; mantenha o app instalado e contate o suporte.');
  }

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;
  const existingTables = await db.getFirstAsync<{ table_count: number }>(
    `SELECT COUNT(*) AS table_count FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'android_metadata'`,
  );
  if (currentVersion > DATABASE_VERSION) {
    throw new Error('Este banco foi criado por uma versão mais recente do app. Seus registros não foram alterados.');
  }
  if (currentVersion === 0 && (existingTables?.table_count ?? 0) > 0) {
    throw new Error('O banco local tem um formato desconhecido. Seus registros não foram alterados; contate o suporte.');
  }

  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  if (currentVersion < 1) {
    await db.execAsync(INITIAL_SCHEMA);
    currentVersion = 1;
  }
  if (currentVersion < DATABASE_VERSION) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS care_recipients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_name TEXT NOT NULL,
          relationship TEXT NOT NULL CHECK (relationship IN ('mãe', 'pai', 'outro')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT OR IGNORE INTO care_recipients (id, person_name, relationship, updated_at)
          SELECT id, person_name, relationship, updated_at FROM care_profile;

        CREATE TABLE IF NOT EXISTS app_settings (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          active_recipient_id INTEGER
        );

        INSERT OR IGNORE INTO app_settings (id, active_recipient_id)
          SELECT 1, (SELECT MIN(id) FROM care_recipients);

        ALTER TABLE care_events ADD COLUMN recipient_id INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE care_tasks ADD COLUMN recipient_id INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE care_expenses ADD COLUMN recipient_id INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE care_documents ADD COLUMN recipient_id INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE medication_notes ADD COLUMN recipient_id INTEGER NOT NULL DEFAULT 1;

        CREATE INDEX IF NOT EXISTS idx_care_events_recipient_date ON care_events(recipient_id, event_date, event_time);
        CREATE INDEX IF NOT EXISTS idx_care_tasks_recipient_due ON care_tasks(recipient_id, completed, due_date);
        CREATE INDEX IF NOT EXISTS idx_care_expenses_recipient_date ON care_expenses(recipient_id, spent_on);
        CREATE INDEX IF NOT EXISTS idx_care_documents_recipient_expiry ON care_documents(recipient_id, expires_on);
        CREATE INDEX IF NOT EXISTS idx_medications_recipient_active ON medication_notes(recipient_id, active);

        DROP TABLE care_profile;
        PRAGMA user_version = ${DATABASE_VERSION};
      `);
    });
  }
  return db;
}
