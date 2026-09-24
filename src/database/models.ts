export type Relationship = 'mãe' | 'pai' | 'outro';
export type EventKind = 'consulta' | 'exame' | 'prazo' | 'outro';

export type CareProfile = {
  id: number;
  personName: string;
  relationship: Relationship;
  updatedAt: string;
};

export type CareEvent = {
  id: number;
  title: string;
  kind: EventKind;
  date: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  reminderMinutes: number | null;
  notificationId: string | null;
};

export type CareTask = {
  id: number;
  title: string;
  dueDate: string | null;
  assignee: string | null;
  notes: string | null;
  completed: boolean;
};

export type Expense = {
  id: number;
  title: string;
  amountCents: number;
  category: string;
  spentOn: string;
  notes: string | null;
};

export type CareDocument = {
  id: number;
  title: string;
  location: string | null;
  expiresOn: string | null;
  completed: boolean;
};

export type MedicationNote = {
  id: number;
  name: string;
  schedule: string | null;
  notes: string | null;
  active: boolean;
};
