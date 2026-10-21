import type { Status } from "./format";

export type User = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  storeId: number | null;
  device?: string;
  status?: string;
  lastLogin?: string | null;
  initials?: string;
};

export type Store = {
  id: number;
  code: string;
  name: string;
  branch: string;
  city: string;
  region: string;
  phone: string;
  address: string;
  inn: string;
  telegram: string;
  currency: string;
  language: string;
  status: "active" | "trial" | "blocked";
  subUntil: string | null;
  plan: { id: number; name: string; smsLimit: number; staffLimit: number | null; clientLimit: number | null } | null;
  initials: string;
  smsEnabled: boolean;
  smsAllowed: boolean;
};

export type Me = { user: User; store: Store | null; permissions: Record<string, boolean>; sms: boolean };

export type Client = {
  id: number;
  name: string;
  phone: string;
  kind: "customer" | "supplier";
  note: string;
  initials: string;
  given: number;
  paid: number;
  remaining: number;
  nextDue: string | null;
  daysLeft: number | null;
  status: Status;
  dueLabel: string;
  debtsCount: number;
  createdAt: string;
};

export type Debt = {
  id: number;
  code: string;
  clientId: number;
  clientName: string;
  clientPhone: string;
  direction: "give" | "take";
  amount: number;
  paid: number;
  remaining: number;
  currency: string;
  date: string;
  dueDate: string | null;
  note: string;
  source: string;
  smsReminder: boolean;
  status: Status;
  dueLabel: string;
};

export type HistoryItem = {
  kind: "debt" | "take" | "payment";
  title: string;
  amount: number;
  date: string;
  at: string;
  method: string;
  note?: string;
};

export type Activity = { type: "debt" | "take" | "payment"; label: string; date: string; client: string; method: string; amount: number };

export type ChartPoint = { label: string; given: number; collected: number };

export type Dashboard = {
  owed: number;
  myDebt: number;
  collectedMonth: number;
  collectedPeriod: number;
  givenPeriod: number;
  totalGiven: number;
  totalCollected: number;
  recoveryPct: number;
  overdueSum: number;
  overdueClients: number;
  activeClients: number;
  onTimeClients: number;
  closedClients: number;
  counts: { all: number; overdue: number; week: number };
  debtors: Client[];
  chart: ChartPoint[];
  recent: Activity[];
  unread: number;
};

export type Report = {
  label: string;
  given: number;
  collected: number;
  rate: number;
  newClients: number;
  monthly: ChartPoint[];
  status: { onTime: number; late: number };
  aging: { notDue: number; d10: number; d30: number; older: number };
  top: { id: number; name: string; remaining: number }[];
  months: { value: string; label: string }[];
};

export type Payment = {
  id: number;
  date: string;
  time: string;
  clientId: number;
  clientName: string;
  debtId: number;
  debtCode: string;
  method: string;
  by: string;
  amount: number;
};
