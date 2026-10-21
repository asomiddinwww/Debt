import { all, get, smsAllowed } from './db.js';
import { today, debtStatus, dueLabel, initials, diffDays } from './util.js';

export const debtCode = (id) => `#Q-${id}`;

/** Do'kon qarzlari: to'langan va qoldiq summasi bilan */
export function loadDebts(storeId, extraWhere = '', ...params) {
  const t = today();
  const rows = all(
    `SELECT d.*, c.name AS client_name, c.phone AS client_phone, c.kind AS client_kind,
       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.debt_id = d.id), 0) AS paid
     FROM debts d JOIN clients c ON c.id = d.client_id
     WHERE d.store_id = ? ${extraWhere}
     ORDER BY d.date DESC, d.id DESC`,
    storeId, ...params,
  );
  return rows.map((d) => {
    const remaining = Math.max(0, d.amount - d.paid);
    return {
      id: d.id,
      code: debtCode(d.id),
      clientId: d.client_id,
      clientName: d.client_name,
      clientPhone: d.client_phone,
      direction: d.direction,
      amount: d.amount,
      paid: d.paid,
      remaining,
      currency: d.currency,
      date: d.date,
      dueDate: d.due_date,
      note: d.note,
      source: d.source,
      smsReminder: !!d.sms_reminder,
      status: debtStatus(remaining, d.due_date, t),
      dueLabel: dueLabel(remaining, d.due_date, t),
      createdAt: d.created_at,
    };
  });
}

/** Mijozlar bo'yicha yig'ma ma'lumot */
export function loadClients(storeId) {
  const t = today();
  const clients = all('SELECT * FROM clients WHERE store_id = ? ORDER BY name', storeId);
  const debts = loadDebts(storeId);
  const byClient = new Map();
  for (const d of debts) {
    if (!byClient.has(d.clientId)) byClient.set(d.clientId, []);
    byClient.get(d.clientId).push(d);
  }
  return clients.map((c) => {
    const list = byClient.get(c.id) || [];
    const given = list.reduce((s, d) => s + d.amount, 0);
    const paid = list.reduce((s, d) => s + d.paid, 0);
    const remaining = list.reduce((s, d) => s + d.remaining, 0);
    const open = list.filter((d) => d.remaining > 0 && d.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const nextDue = open[0]?.dueDate || null;
    const status = list.length === 0 ? 'new' : debtStatus(remaining, nextDue, t);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      kind: c.kind,
      note: c.note,
      initials: initials(c.name),
      given,
      paid,
      remaining,
      nextDue,
      daysLeft: nextDue ? diffDays(t, nextDue) : null,
      status,
      dueLabel: list.length === 0 ? "Qarz yo'q" : dueLabel(remaining, nextDue, t),
      debtsCount: list.length,
      createdAt: c.created_at,
    };
  });
}

/** Mijoz tarixi: qarzlar va to'lovlar bitta lentada */
export function clientHistory(storeId, clientId) {
  const debts = all(
    'SELECT id, amount, date, source, direction, note, created_at FROM debts WHERE store_id = ? AND client_id = ?',
    storeId, clientId,
  ).map((d) => ({
    kind: d.direction === 'give' ? 'debt' : 'take',
    title: d.direction === 'give' ? 'Qarz berildi' : 'Qarz olindi',
    amount: d.amount,
    date: d.date,
    at: `${d.date} ${d.created_at.slice(11)}`,
    method: d.source,
    note: d.note,
    debtId: d.id,
  }));
  const pays = all(
    `SELECT p.id, p.amount, p.method, p.created_at, p.debt_id FROM payments p
     JOIN debts d ON d.id = p.debt_id WHERE p.store_id = ? AND d.client_id = ?`,
    storeId, clientId,
  ).map((p) => ({
    kind: 'payment',
    title: "To'lov",
    amount: p.amount,
    date: p.created_at.slice(0, 10),
    at: p.created_at,
    method: p.method,
    debtId: p.debt_id,
    paymentId: p.id,
  }));
  return [...debts, ...pays].sort((a, b) => b.at.localeCompare(a.at));
}

export function storeView(s) {
  if (!s) return null;
  const plan = s.plan_id ? get('SELECT * FROM plans WHERE id = ?', s.plan_id) : null;
  return {
    id: s.id,
    code: `ST-${String(s.id).padStart(5, '0')}`,
    name: s.name,
    branch: s.branch,
    city: s.city,
    region: s.region,
    phone: s.phone,
    address: s.address,
    inn: s.inn,
    telegram: s.telegram,
    currency: s.currency,
    language: s.language,
    status: s.status,
    subUntil: s.sub_until,
    plan: plan ? { id: plan.id, name: plan.name, smsLimit: plan.sms_limit, staffLimit: plan.staff_limit, clientLimit: plan.client_limit } : null,
    initials: initials(s.name),
    smsEnabled: !!s.sms_enabled,
    smsAllowed: smsAllowed(s),
    createdAt: s.created_at,
  };
}
