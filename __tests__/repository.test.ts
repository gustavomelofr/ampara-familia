import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, jest } from '@jest/globals';

import { createCareProfile, createEvent, createTask, listEvents, RepositoryError, updateTask } from '@/src/database/repository';

function databaseStub() {
  const row = {
    id: 7,
    title: 'Consulta cardiologista',
    kind: 'consulta' as const,
    event_date: '2026-10-12',
    event_time: '10:30',
    location: null,
    notes: null,
    reminder_minutes: null,
    notification_id: null,
  };
  const db = {
    runAsync: jest.fn(async () => ({ lastInsertRowId: 7, changes: 1 })),
    getFirstAsync: jest.fn(async (query: string) => {
      if (query.includes('active_recipient_id')) return { active_recipient_id: 1 };
      if (query.includes('care_recipients')) return { id: 1 };
      if (query.includes('care_events')) return row;
      return null;
    }),
    getAllAsync: jest.fn(async () => [row]),
  };
  return { db: db as unknown as SQLiteDatabase, raw: db };
}

describe('care repository', () => {
  it('validates and binds event fields instead of interpolating user input into SQL', async () => {
    const { db, raw } = databaseStub();
    const event = await createEvent(db, {
      title: 'Consulta cardiologista',
      kind: 'consulta',
      date: '2026-10-12',
      time: '10:30',
      location: "Clínica d'Ávila",
    });

    expect(event.id).toBe(7);
    expect(raw.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO care_events'),
      1,
      'Consulta cardiologista',
      'consulta',
      '2026-10-12',
      '10:30',
      "Clínica d'Ávila",
      null,
      null,
    );
  });

  it('rejects an impossible date before writing an event', async () => {
    const { db, raw } = databaseStub();
    await expect(createEvent(db, {
      title: 'Exame',
      kind: 'exame',
      date: '2026-02-31',
    })).rejects.toBeInstanceOf(RepositoryError);
    expect(raw.runAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid clock time before writing an event', async () => {
    const { db, raw } = databaseStub();
    await expect(createEvent(db, {
      title: 'Consulta',
      kind: 'consulta',
      date: '2026-10-12',
      time: '28:90',
    })).rejects.toBeInstanceOf(RepositoryError);
    expect(raw.runAsync).not.toHaveBeenCalled();
  });

  it('stores task edits through bound SQL parameters', async () => {
    const { db, raw } = databaseStub();
    await updateTask(db, 3, {
      title: 'Buscar resultado',
      dueDate: '2026-10-20',
      assignee: 'Ana',
    });

    expect(raw.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE care_tasks'),
      'Buscar resultado',
      '2026-10-20',
      'Ana',
      null,
      3,
      1,
    );
  });

  it('rejects empty tasks before touching the database', async () => {
    const { db, raw } = databaseStub();
    await expect(createTask(db, { title: ' ' })).rejects.toBeInstanceOf(RepositoryError);
    expect(raw.runAsync).not.toHaveBeenCalled();
  });

  it('scopes appointment queries to the selected family profile', async () => {
    const { db, raw } = databaseStub();
    await listEvents(db, '2026-10-01');
    expect(raw.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE recipient_id = ? AND event_date >= ?'),
      1,
      '2026-10-01',
    );
  });

  it('allows a second separate profile but prevents adding a third', async () => {
    const db = {
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
      getFirstAsync: jest.fn(async () => ({ count: 1 })),
      runAsync: jest.fn(async () => ({ lastInsertRowId: 2, changes: 1 })),
    } as unknown as SQLiteDatabase;

    await expect(createCareProfile(db, { personName: 'João', relationship: 'pai' })).resolves.toBe(2);
    expect(db.runAsync).toHaveBeenCalledWith(
      'INSERT INTO care_recipients (person_name, relationship) VALUES (?, ?)',
      'João',
      'pai',
    );

    const fullDb = {
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
      getFirstAsync: jest.fn(async () => ({ count: 2 })),
      runAsync: jest.fn(async () => ({ lastInsertRowId: 3, changes: 1 })),
    } as unknown as SQLiteDatabase;
    await expect(createCareProfile(fullDb, { personName: 'Outra pessoa', relationship: 'outro' }))
      .rejects.toThrow('até duas pessoas');
    expect(fullDb.runAsync).not.toHaveBeenCalled();
  });
});
