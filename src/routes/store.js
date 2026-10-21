import { Router } from 'express';
import { all, get, run, tx, smsAllowed } from '../db.js';
import {
  today, addDays, diffDays, monthStart, isoDateTime, MONTHS_TITLE, MONTHS_SHORT, normalizePhone, must, toInt,
  parseDate, parseJSON, initials, dmy, fmtMoney, HttpError,
} from '../util.js';
import { authRequired, storeRequired, can, log, clientIp, userLabel, publicUser } from '../auth.js';
import { loadDebts, loadClients, clientHistory, storeView, debtCode } from '../data.js';
import { recordPhoneSms, renderTemplate, DEFAULT_TEMPLATE } from '../sms.js';
import { toCsv } from '../csv.js';

const r = Router();
r.use(authRequired, storeRequired);

const METHODS = ['Naqd', 'Karta', 'Click', 'Payme'];
const USD_RATE = Number(process.env.USD_RATE || 12800);

// ---------- yordamchilar ----------

function periodRange(period) {
  const t = today();
  if (period === 'week') return { from: addDays(t, -6), to: t };
  if (period === 'year') return { from: `${t.slice(0, 4)}-01-01`, to: t };
  return { from: monthStart(), to: t };
}

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

function lastMonths(n) {
  const d = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
    out.push({ ym, label: MONTHS_SHORT[x.getMonth()], ...monthRange(ym) });
  }
  return out;
}

function chartBuckets(period) {
  if (period === 'week') {
    const t = today();
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(t, i - 6);
      return { label: `${day.slice(8, 10)}.${day.slice(5, 7)}`, from: day, to: day };
    });
  }
  return lastMonths(period === 'year' ? 12 : 6);
}

function sumGiven(storeId, from, to) {
  return get("SELECT COALESCE(SUM(amount),0) AS s FROM debts WHERE store_id = ? AND direction = 'give' AND date BETWEEN ? AND ?", storeId, from, to).s;
}

function sumCollected(storeId, from, to) {
  return get(
    `SELECT COALESCE(SUM(p.amount),0) AS s, COUNT(*) AS n FROM payments p JOIN debts d ON d.id = p.debt_id
     WHERE p.store_id = ? AND d.direction = 'give' AND substr(p.created_at,1,10) BETWEEN ? AND ?`,
    storeId, from, to,
  );
}

function chart(storeId, period) {
  return chartBuckets(period).map((b) => ({
    label: b.label,
    given: sumGiven(storeId, b.from, b.to),
    collected: sumCollected(storeId, b.from, b.to).s,
  }));
}

function recentActivity(storeId, limit = 5) {
  const debts = all(
    `SELECT d.id, d.amount, d.date, d.direction, d.source, d.created_at, c.name FROM debts d JOIN clients c ON c.id = d.client_id
     WHERE d.store_id = ? ORDER BY d.date DESC, d.id DESC LIMIT ?`, storeId, limit,
  ).map((d) => ({
    type: d.direction === 'give' ? 'debt' : 'take',
    label: d.direction === 'give' ? 'Qarz berildi' : 'Qarz olindi',
    date: d.date, at: `${d.date} ${d.created_at.slice(11)}`, client: d.name, method: d.source, amount: d.amount,
  }));
  const pays = all(
    `SELECT p.amount, p.method, p.created_at, c.name FROM payments p JOIN debts d ON d.id = p.debt_id JOIN clients c ON c.id = d.client_id
     WHERE p.store_id = ? ORDER BY p.created_at DESC LIMIT ?`, storeId, limit,
  ).map((p) => ({ type: 'payment', label: "To'lov", date: p.created_at.slice(0, 10), at: p.created_at, client: p.name, method: p.method, amount: p.amount }));
  return [...debts, ...pays].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

function notify(storeId, type, title, text, ref = null) {
  run('INSERT INTO notifications(store_id, type, title, text, ref, created_at) VALUES(?,?,?,?,?,?)', storeId, type, title, text, ref, isoDateTime());
}

function findClient(req, id) {
  const c = get('SELECT * FROM clients WHERE id = ? AND store_id = ?', id, req.store.id);
  if (!c) throw new HttpError(404, 'Mijoz topilmadi');
  return c;
}

function sendCsv(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(rows));
}

// ---------- boshqaruv paneli ----------

r.get('/dashboard', (req, res) => {
  const sid = req.store.id;
  const period = ['week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'month';
  const t = today();
  const clients = loadClients(sid);
  const customers = clients.filter((c) => c.kind === 'customer');
  const suppliers = clients.filter((c) => c.kind === 'supplier');
  const debtors = customers.filter((c) => c.remaining > 0);

  const owed = debtors.reduce((s, c) => s + c.remaining, 0);
  const myDebt = suppliers.reduce((s, c) => s + c.remaining, 0);
  const late = debtors.filter((c) => c.status === 'late');
  const totalGiven = customers.reduce((s, c) => s + c.given, 0);
  const totalCollected = customers.reduce((s, c) => s + c.paid, 0);
  const range = periodRange(period);
  const collectedMonth = sumCollected(sid, monthStart(), t).s;

  const sorted = [...debtors].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'late' ? -1 : 1;
    if (a.status === 'late') return (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
    return (a.nextDue || '9999').localeCompare(b.nextDue || '9999');
  });

  res.json({
    period,
    owed,
    myDebt,
    collectedMonth,
    collectedPeriod: sumCollected(sid, range.from, range.to).s,
    givenPeriod: sumGiven(sid, range.from, range.to),
    totalGiven,
    totalCollected,
    recoveryPct: totalGiven ? Math.round((totalCollected / totalGiven) * 100) : 0,
    overdueSum: late.reduce((s, c) => s + c.remaining, 0),
    overdueClients: late.length,
    activeClients: debtors.length,
    onTimeClients: debtors.filter((c) => c.status === 'ok').length,
    closedClients: customers.filter((c) => c.status === 'paid').length,
    counts: {
      all: debtors.length,
      overdue: late.length,
      week: debtors.filter((c) => c.status === 'ok' && c.daysLeft !== null && c.daysLeft <= 7).length,
    },
    debtors: sorted,
    chart: chart(sid, period),
    recent: recentActivity(sid, 5),
    unread: get('SELECT COUNT(*) AS n FROM notifications WHERE store_id = ? AND is_read = 0', sid).n,
  });
});

// ---------- mijozlar ----------

r.get('/clients', (req, res) => {
  const { filter = 'all', q = '', sort = 'amount', kind = 'customer' } = req.query;
  let list = loadClients(req.store.id);
  if (kind !== 'all') list = list.filter((c) => c.kind === kind);
  const query = String(q).trim().toLowerCase();
  if (query) {
    const digits = query.replace(/\D/g, '');
    list = list.filter((c) => c.name.toLowerCase().includes(query) || (digits && c.phone.replace(/\D/g, '').includes(digits)));
  }
  if (filter === 'debtors') list = list.filter((c) => c.remaining > 0);
  if (filter === 'active') list = list.filter((c) => c.status === 'ok');
  if (filter === 'late') list = list.filter((c) => c.status === 'late');
  if (filter === 'paid') list = list.filter((c) => c.status === 'paid');
  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'due') list.sort((a, b) => (a.nextDue || '9999').localeCompare(b.nextDue || '9999'));
  else list.sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));

  const everyone = loadClients(req.store.id).filter((c) => kind === 'all' || c.kind === kind);
  res.json({
    clients: list,
    total: everyone.length,
    totalRemaining: everyone.reduce((s, c) => s + c.remaining, 0),
    counts: {
      all: everyone.length,
      debtors: everyone.filter((c) => c.remaining > 0).length,
      active: everyone.filter((c) => c.status === 'ok').length,
      late: everyone.filter((c) => c.status === 'late').length,
      paid: everyone.filter((c) => c.status === 'paid').length,
    },
  });
});

r.post('/clients', (req, res) => {
  const name = String(req.body?.name || '').trim();
  must(name.length >= 2, 400, 'Mijoz ismini kiriting');
  const phone = req.body?.phone ? normalizePhone(req.body.phone) : '';
  must(phone !== null, 400, "Telefon raqam noto'g'ri");
  const kind = req.body?.kind === 'supplier' ? 'supplier' : 'customer';
  const plan = get('SELECT client_limit FROM plans WHERE id = ?', req.store.plan_id);
  if (plan?.client_limit) {
    const n = get('SELECT COUNT(*) AS n FROM clients WHERE store_id = ?', req.store.id).n;
    must(n < plan.client_limit, 403, `Tarifingiz ${plan.client_limit} tagacha mijozga ruxsat beradi. Tarifni yangilang`);
  }
  const info = run('INSERT INTO clients(store_id, name, phone, kind, note, created_at) VALUES(?,?,?,?,?,?)',
    req.store.id, name, phone || '', kind, String(req.body?.note || ''), isoDateTime());
  const client = loadClients(req.store.id).find((c) => c.id === Number(info.lastInsertRowid));
  res.status(201).json({ client });
});

r.get('/clients/:id', (req, res) => {
  const c = findClient(req, toInt(req.params.id));
  const summary = loadClients(req.store.id).find((x) => x.id === c.id);
  res.json({
    client: summary,
    debts: loadDebts(req.store.id, 'AND d.client_id = ?', c.id),
    history: clientHistory(req.store.id, c.id),
  });
});

r.put('/clients/:id', (req, res) => {
  const c = findClient(req, toInt(req.params.id));
  const name = String(req.body?.name ?? c.name).trim();
  must(name.length >= 2, 400, 'Mijoz ismini kiriting');
  const phone = req.body?.phone !== undefined ? (req.body.phone ? normalizePhone(req.body.phone) : '') : c.phone;
  must(phone !== null, 400, "Telefon raqam noto'g'ri");
  run('UPDATE clients SET name = ?, phone = ?, note = ? WHERE id = ?', name, phone, String(req.body?.note ?? c.note), c.id);
  res.json({ client: loadClients(req.store.id).find((x) => x.id === c.id) });
});

r.delete('/clients/:id', can('delete_debt'), (req, res) => {
  const c = findClient(req, toInt(req.params.id));
  run('DELETE FROM clients WHERE id = ?', c.id);
  log('warn', 'Mijozlar', `Mijoz o'chirildi: ${c.name}`, userLabel(req), clientIp(req));
  res.json({ ok: true });
});

function smsRequired(req, _res, next) {
  must(smsAllowed(req.store), 403, "SMS yuborish administrator tomonidan o'chirilgan");
  next();
}

r.post('/clients/:id/remind', can('send_sms'), smsRequired, (req, res) => {
  const c = findClient(req, toInt(req.params.id));
  const summary = loadClients(req.store.id).find((x) => x.id === c.id);
  must(summary.remaining > 0, 400, "Bu mijozda ochiq qarz yo'q");
  must(c.phone, 400, "Mijozning telefon raqami yo'q");
  // SMS do'kon egasining telefonidan ketadi: frontend sms: havolasini ochadi
  const text = renderTemplate(req.store.sms_template, { name: c.name, amount: summary.remaining, due: summary.nextDue, store: req.store });
  recordPhoneSms({ store: req.store, phone: c.phone, text, type: summary.status === 'late' ? "Muddat o'tdi" : 'Muddat eslatmasi', clientId: c.id });
  res.json({ ok: true, phone: c.phone, text });
});

// ---------- qarzlar ----------

r.get('/debts', (req, res) => {
  const { direction = 'all', status = 'all', q = '', from, to } = req.query;
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 8)));
  let list = loadDebts(req.store.id);
  const allDebts = list;
  if (direction !== 'all') list = list.filter((d) => d.direction === direction);
  if (status !== 'all') list = list.filter((d) => d.status === status);
  if (from) list = list.filter((d) => d.date >= from);
  if (to) list = list.filter((d) => d.date <= to);
  const query = String(q).trim().toLowerCase().replace('#', '');
  if (query) list = list.filter((d) => d.clientName.toLowerCase().includes(query) || d.code.toLowerCase().includes(query));

  const give = allDebts.filter((d) => d.direction === 'give' && d.remaining > 0);
  const take = allDebts.filter((d) => d.direction === 'take' && d.remaining > 0);
  const giveSum = give.reduce((s, d) => s + d.remaining, 0);
  const takeSum = take.reduce((s, d) => s + d.remaining, 0);

  res.json({
    debts: list.slice((page - 1) * limit, page * limit),
    total: list.length,
    page,
    pages: Math.max(1, Math.ceil(list.length / limit)),
    summary: {
      give: giveSum, giveOpen: give.length,
      take: takeSum, takeParties: new Set(take.map((d) => d.clientId)).size,
      balance: giveSum - takeSum,
    },
  });
});

r.post('/debts', can('add_debt'), (req, res) => {
  const b = req.body || {};
  const direction = b.direction === 'take' ? 'take' : 'give';
  const currency = b.currency === 'USD' ? 'USD' : 'UZS';
  let amount = toInt(b.amount);
  must(amount > 0, 400, "Summani to'g'ri kiriting");
  let note = String(b.note || '').trim();
  if (currency === 'USD') {
    note = `${note ? note + ' · ' : ''}${fmtMoney(amount)} USD (kurs ${fmtMoney(USD_RATE)})`;
    amount = amount * USD_RATE;
  }
  const date = parseDate(b.date) || today();
  const dueDate = b.dueDate ? parseDate(b.dueDate) : null;
  must(!b.dueDate || dueDate, 400, "Qaytarish muddati noto'g'ri (kk.oo.yyyy)");
  must(!dueDate || dueDate >= date, 400, 'Qaytarish muddati qarz sanasidan oldin bo‘lishi mumkin emas');

  const result = tx(() => {
    let clientId = toInt(b.clientId);
    if (clientId) {
      findClient(req, clientId);
    } else {
      const name = String(b.clientName || '').trim();
      must(name.length >= 2, 400, 'Mijozni tanlang yoki ismini kiriting');
      const phone = b.clientPhone ? normalizePhone(b.clientPhone) : '';
      must(phone !== null, 400, "Telefon raqam noto'g'ri");
      const existing = get('SELECT id FROM clients WHERE store_id = ? AND lower(name) = lower(?)', req.store.id, name);
      clientId = existing?.id || Number(run('INSERT INTO clients(store_id, name, phone, kind, created_at) VALUES(?,?,?,?,?)',
        req.store.id, name, phone || '', direction === 'take' ? 'supplier' : 'customer', isoDateTime()).lastInsertRowid);
    }
    const info = run(
      `INSERT INTO debts(store_id, client_id, direction, amount, currency, date, due_date, note, source, sms_reminder, created_by, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      req.store.id, clientId, direction, amount, currency, date, dueDate, note, String(b.source || 'Mahsulot'),
      b.smsReminder === false ? 0 : 1, req.user.id, isoDateTime(),
    );
    return { id: Number(info.lastInsertRowid), clientId };
  });

  const debt = loadDebts(req.store.id, 'AND d.id = ?', result.id)[0];
  const prefs = parseJSON(req.store.prefs, {});
  if (prefs.bigDebt && amount >= 5_000_000) {
    notify(req.store.id, 'due', 'Katta qarz qo‘shildi', `${debt.clientName} — ${fmtMoney(amount)} so'm.`, `big:${debt.id}`);
  }
  log('info', 'Qarzlar', `Yangi qarz yozuvi: ${debt.code} (${fmtMoney(amount)} so'm)`, userLabel(req), clientIp(req));
  res.status(201).json({ debt });
});

r.get('/debts/:id', (req, res) => {
  const d = loadDebts(req.store.id, 'AND d.id = ?', toInt(req.params.id))[0];
  must(d, 404, 'Qarz topilmadi');
  const payments = all('SELECT p.*, u.name AS by_name FROM payments p LEFT JOIN users u ON u.id = p.received_by WHERE p.debt_id = ? ORDER BY p.created_at DESC', d.id);
  res.json({ debt: d, payments });
});

r.delete('/debts/:id', can('delete_debt'), (req, res) => {
  const d = get('SELECT * FROM debts WHERE id = ? AND store_id = ?', toInt(req.params.id), req.store.id);
  must(d, 404, 'Qarz topilmadi');
  run('DELETE FROM debts WHERE id = ?', d.id);
  log('warn', 'Qarzlar', `Qarz yozuvi o'chirildi: ${debtCode(d.id)}`, userLabel(req), clientIp(req));
  res.json({ ok: true });
});

// ---------- to'lovlar ----------

r.get('/payments', (req, res) => {
  const sid = req.store.id;
  const t = today();
  const ym = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : t.slice(0, 7);
  const { from, to } = monthRange(ym);
  const method = METHODS.includes(req.query.method) ? req.query.method : null;
  const methodSql = req.query.method === 'Click/Payme' ? "AND p.method IN ('Click','Payme')" : method ? 'AND p.method = ?' : '';
  const params = method && req.query.method !== 'Click/Payme' ? [method] : [];

  const rows = all(
    `SELECT p.*, c.name AS client_name, c.id AS client_id, u.name AS by_name, u.role AS by_role
     FROM payments p JOIN debts d ON d.id = p.debt_id JOIN clients c ON c.id = d.client_id LEFT JOIN users u ON u.id = p.received_by
     WHERE p.store_id = ? AND substr(p.created_at,1,10) BETWEEN ? AND ? ${methodSql}
     ORDER BY p.created_at DESC`,
    sid, from, to, ...params,
  ).map((p) => ({
    id: p.id,
    date: p.created_at.slice(0, 10),
    time: p.created_at.slice(11, 16),
    clientId: p.client_id,
    clientName: p.client_name,
    debtId: p.debt_id,
    debtCode: debtCode(p.debt_id),
    method: p.method,
    by: p.by_name ? (p.by_role === 'cashier' ? `${p.by_name} (kassir)` : p.by_name) : '—',
    amount: p.amount,
  }));

  const today_ = sumCollected(sid, t, t);
  const week = sumCollected(sid, addDays(t, -6), t);
  const month = sumCollected(sid, from, to);
  const byMethod = all(
    `SELECT method, COALESCE(SUM(amount),0) AS s FROM payments WHERE store_id = ? AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY method`,
    sid, from, to,
  );
  const monthTotal = byMethod.reduce((s, m) => s + m.s, 0);
  const [y, m] = ym.split('-').map(Number);

  res.json({
    month: ym,
    monthLabel: `${MONTHS_TITLE[m - 1]}, ${y}`,
    payments: rows,
    stats: {
      today: { sum: today_.s, count: today_.n },
      week: { sum: week.s, count: week.n },
      month: { sum: month.s, count: month.n },
      average: month.n ? Math.round(month.s / month.n) : 0,
    },
    methods: METHODS.map((name) => {
      const s = byMethod.find((x) => x.method === name)?.s || 0;
      return { name, sum: s, pct: monthTotal ? Math.round((s / monthTotal) * 100) : 0 };
    }),
  });
});

r.post('/payments', can('take_payment'), (req, res) => {
  const b = req.body || {};
  let amount = toInt(b.amount);
  must(amount > 0, 400, "Summani to'g'ri kiriting");
  const method = METHODS.includes(b.method) ? b.method : 'Naqd';
  const sid = req.store.id;

  // Muayyan qarzga yoki mijozning eng eski ochiq qarzlariga taqsimlanadi
  let targets;
  if (b.debtId) {
    targets = loadDebts(sid, 'AND d.id = ?', toInt(b.debtId)).filter((d) => d.remaining > 0);
    must(targets.length, 400, "Bu qarz allaqachon yopilgan yoki topilmadi");
  } else {
    const cid = toInt(b.clientId);
    must(cid, 400, 'Mijozni tanlang');
    findClient(req, cid);
    targets = loadDebts(sid, 'AND d.client_id = ?', cid).filter((d) => d.remaining > 0).sort((a, b2) => a.date.localeCompare(b2.date));
    must(targets.length, 400, "Bu mijozda ochiq qarz yo'q");
  }
  const totalOpen = targets.reduce((s, d) => s + d.remaining, 0);
  must(amount <= totalOpen, 400, `To'lov qoldiqdan katta. Qoldiq: ${fmtMoney(totalOpen)} so'm`);

  const at = isoDateTime();
  tx(() => {
    for (const d of targets) {
      if (amount <= 0) break;
      const part = Math.min(amount, d.remaining);
      run('INSERT INTO payments(store_id, debt_id, amount, method, received_by, created_at) VALUES(?,?,?,?,?,?)', sid, d.id, part, method, req.user.id, at);
      amount -= part;
    }
  });

  const paidNow = toInt(b.amount);
  const client = loadClients(sid).find((c) => c.id === targets[0].clientId);
  const closed = client.remaining === 0;
  notify(sid, 'pay', "To'lov qabul qilindi", `${client.name} ${fmtMoney(paidNow)} so'm to'ladi.${closed ? " Qarz to'liq yopildi." : ''}`);
  log('ok', "To'lovlar", `To'lov qabul qilindi: ${targets[0].code}`, userLabel(req), clientIp(req));

  let receipt = null;
  if (client.phone && b.sendReceipt && smsAllowed(req.store)) {
    const text = `${req.store.name}: ${fmtMoney(paidNow)} so'm to'lov qabul qilindi. Qoldiq: ${fmtMoney(client.remaining)} so'm.`;
    recordPhoneSms({ store: req.store, phone: client.phone, text, type: "To'lov tasdig'i", kind: 'payment', clientId: client.id });
    receipt = { phone: client.phone, text };
  }
  res.status(201).json({ ok: true, client, receipt });
});

// ---------- hisobotlar ----------

r.get('/reports', can('view_reports'), (req, res) => {
  const sid = req.store.id;
  const t = today();
  let range;
  let label;
  if (/^\d{4}-\d{2}$/.test(req.query.month || '')) {
    range = monthRange(req.query.month);
    const m = Number(req.query.month.slice(5, 7));
    label = `${MONTHS_TITLE[m - 1]}, ${req.query.month.slice(0, 4)}`;
  } else {
    const period = ['week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'month';
    range = periodRange(period);
    const m = new Date().getMonth();
    label = period === 'week' ? "So'nggi 7 kun" : period === 'year' ? `${t.slice(0, 4)}-yil` : `${MONTHS_TITLE[m]}da`;
  }
  const given = sumGiven(sid, range.from, range.to);
  const collected = sumCollected(sid, range.from, range.to).s;
  const newClients = get("SELECT COUNT(*) AS n FROM clients WHERE store_id = ? AND kind = 'customer' AND substr(created_at,1,10) BETWEEN ? AND ?", sid, range.from, range.to).n;

  const open = loadDebts(sid).filter((d) => d.direction === 'give' && d.remaining > 0);
  const aging = { notDue: 0, d10: 0, d30: 0, older: 0 };
  for (const d of open) {
    const late = d.dueDate ? diffDays(d.dueDate, t) : 0;
    if (late <= 0) aging.notDue += d.remaining;
    else if (late <= 10) aging.d10 += d.remaining;
    else if (late <= 30) aging.d30 += d.remaining;
    else aging.older += d.remaining;
  }
  const lateSum = aging.d10 + aging.d30 + aging.older;
  const top = loadClients(sid).filter((c) => c.kind === 'customer' && c.remaining > 0).sort((a, b) => b.remaining - a.remaining).slice(0, 5);

  res.json({
    label,
    range,
    given,
    collected,
    rate: given ? Math.round((collected / given) * 100) : 0,
    newClients,
    monthly: chart(sid, 'month'),
    status: { onTime: aging.notDue, late: lateSum },
    aging,
    top: top.map((c) => ({ id: c.id, name: c.name, remaining: c.remaining })),
    months: lastMonths(12).reverse().map((m) => ({ value: m.ym, label: `${MONTHS_TITLE[Number(m.ym.slice(5)) - 1]}, ${m.ym.slice(0, 4)}` })),
  });
});

r.get('/reports/export', can('view_reports'), (req, res) => {
  const rows = loadClients(req.store.id).filter((c) => c.kind === 'customer').map((c) => ({
    Mijoz: c.name, Telefon: c.phone, Berilgan: c.given, "To'langan": c.paid, Qoldiq: c.remaining, Muddat: dmy(c.nextDue), Holat: c.dueLabel,
  }));
  sendCsv(res, 'hisobot.csv', rows);
});

// ---------- eslatmalar ----------

function plannedReminders(store) {
  const rules = parseJSON(store.rules, {});
  const now = isoDateTime();
  const t = today();
  const out = [];
  for (const d of loadDebts(store.id)) {
    if (d.direction !== 'give' || d.remaining <= 0 || !d.dueDate || !d.smsReminder) continue;
    let when = null;
    if (rules.before && `${addDays(d.dueDate, -1)} 10:00` >= now.slice(0, 16)) when = `${addDays(d.dueDate, -1)} 10:00`;
    else if (rules.due && `${d.dueDate} 09:00` >= now.slice(0, 16)) when = `${d.dueDate} 09:00`;
    else if (rules.after && d.dueDate < t) {
      const late = diffDays(d.dueDate, t);
      when = `${addDays(t, (3 - (late % 3)) % 3 || 3)} 09:00`;
    }
    if (!when) continue;
    const client = get('SELECT phone FROM clients WHERE id = ?', d.clientId);
    out.push({
      id: `plan-${d.id}`,
      clientId: d.clientId,
      name: d.clientName,
      initials: initials(d.clientName),
      note: d.status === 'late' ? "Muddat o'tgan · takroriy" : when.startsWith(d.dueDate) ? 'Muddat kuni' : 'Muddatdan 1 kun oldin',
      amount: d.remaining,
      at: when,
      status: 'plan',
      phone: client?.phone || '',
      text: renderTemplate(store.sms_template, { name: d.clientName, amount: d.remaining, due: d.dueDate, store }),
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

r.get('/reminders', (req, res) => {
  const s = req.store;
  const status = req.query.status || 'all';
  const planned = plannedReminders(s);
  const sent = all(
    `SELECT l.*, c.name AS client_name FROM sms_log l LEFT JOIN clients c ON c.id = l.client_id
     WHERE l.store_id = ? AND l.kind IN ('before','due','after','manual') ORDER BY l.created_at DESC LIMIT 50`, s.id,
  ).map((l) => {
    const debt = l.debt_id ? loadDebts(s.id, 'AND d.id = ?', l.debt_id)[0] : null;
    const client = l.client_id ? loadClients(s.id).find((c) => c.id === l.client_id) : null;
    return {
      id: `sms-${l.id}`,
      clientId: l.client_id,
      name: l.client_name || l.phone,
      initials: initials(l.client_name || '?'),
      note: l.status === 'fail' ? "Raqam o'chirilgan bo'lishi mumkin" : l.type === "Muddat o'tdi" ? "Muddat o'tgan · takroriy" : l.type,
      amount: debt?.remaining ?? client?.remaining ?? 0,
      at: l.created_at.slice(0, 16),
      status: l.status === 'fail' ? 'fail' : l.status === 'phone' ? 'phone' : 'sent',
    };
  });
  let items = [...planned, ...sent];
  if (status === 'plan') items = planned;
  if (status === 'sent') items = sent;

  const ms = monthStart();
  const monthSent = get("SELECT COUNT(*) AS n FROM sms_log WHERE store_id = ? AND kind != 'otp' AND status != 'fail' AND created_at >= ?", s.id, ms);
  const endOfToday = `${today()} 23:59`;
  res.json({
    items,
    stats: {
      sent: monthSent.n,
      planned: planned.length,
      dueToday: planned.filter((p) => p.at <= endOfToday).length,
      overdue: loadClients(s.id).filter((c) => c.kind === 'customer' && c.status === 'late').length,
    },
    smsEnabled: smsAllowed(s),
    template: s.sms_template || DEFAULT_TEMPLATE,
    rules: { before: false, due: false, after: false, ...parseJSON(s.rules, {}) },
    preview: (() => {
      const c = loadClients(s.id).find((x) => x.kind === 'customer' && x.remaining > 0);
      return c ? renderTemplate(s.sms_template, { name: c.name, amount: c.remaining, due: c.nextDue, store: s }) : '';
    })(),
  });
});

r.put('/reminders/settings', can('send_sms'), (req, res) => {
  const tpl = String(req.body?.template ?? req.store.sms_template).slice(0, 320);
  const rules = { ...parseJSON(req.store.rules, {}), ...(req.body?.rules || {}) };
  run('UPDATE stores SET sms_template = ?, rules = ? WHERE id = ?', tpl, JSON.stringify(rules), req.store.id);
  res.json({ ok: true, template: tpl, rules });
});

// Kechikkan mijozlar va ularga tayyor SMS matni (har biri telefondan alohida yuboriladi)
r.get('/reminders/overdue', can('send_sms'), smsRequired, (req, res) => {
  const late = loadClients(req.store.id).filter((c) => c.kind === 'customer' && c.status === 'late');
  res.json({
    items: late.map((c) => ({
      clientId: c.id, name: c.name, initials: c.initials, phone: c.phone, amount: c.remaining, dueLabel: c.dueLabel,
      text: renderTemplate(req.store.sms_template, { name: c.name, amount: c.remaining, due: c.nextDue, store: req.store }),
    })),
  });
});

// ---------- bildirishnomalar ----------

r.get('/notifications', (req, res) => {
  const rows = all('SELECT * FROM notifications WHERE store_id = ? ORDER BY created_at DESC LIMIT 60', req.store.id);
  const t = today();
  const y = addDays(t, -1);
  const groups = [
    { title: 'Bugun', items: [] },
    { title: 'Kecha', items: [] },
    { title: 'Avvalroq', items: [] },
  ];
  for (const n of rows) {
    const d = n.created_at.slice(0, 10);
    const item = {
      id: n.id, type: n.type, title: n.title, text: n.text, unread: !n.is_read,
      time: d === t || d === y ? n.created_at.slice(11, 16) : `${d.slice(8, 10)}.${d.slice(5, 7)}`,
    };
    (d === t ? groups[0] : d === y ? groups[1] : groups[2]).items.push(item);
  }
  res.json({ groups: groups.filter((g) => g.items.length), unread: rows.filter((n) => !n.is_read).length });
});

r.post('/notifications/read-all', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE store_id = ?', req.store.id);
  res.json({ ok: true });
});

// ---------- sozlamalar ----------

r.get('/settings', (req, res) => {
  const staff = all("SELECT * FROM users WHERE store_id = ? ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, id", req.store.id);
  res.json({
    store: storeView(req.store),
    prefs: { dailyReport: true, overdueAlert: true, bigDebt: false, sms: true, pin: false, ...parseJSON(req.store.prefs, {}) },
    staff: staff.map((u) => ({ ...publicUser(u), initials: initials(u.name) })),
    lastBackup: `${today()} 09:00`,
  });
});

r.put('/settings/store', can('manage_staff'), (req, res) => {
  const s = req.store;
  const b = req.body || {};
  const name = String(b.name ?? s.name).trim();
  must(name.length >= 2, 400, "Do'kon nomini kiriting");
  run(
    `UPDATE stores SET name = ?, branch = ?, phone = ?, address = ?, inn = ?, telegram = ?, currency = ?, language = ? WHERE id = ?`,
    name, String(b.branch ?? s.branch), String(b.phone ?? s.phone), String(b.address ?? s.address), String(b.inn ?? s.inn),
    String(b.telegram ?? s.telegram), b.currency === 'USD' ? 'USD' : 'UZS', String(b.language ?? s.language), s.id,
  );
  res.json({ store: storeView(get('SELECT * FROM stores WHERE id = ?', s.id)) });
});

r.put('/settings/prefs', (req, res) => {
  const prefs = { ...parseJSON(req.store.prefs, {}), ...(req.body || {}) };
  run('UPDATE stores SET prefs = ? WHERE id = ?', JSON.stringify(prefs), req.store.id);
  res.json({ prefs });
});

r.put('/settings/profile', (req, res) => {
  const name = String(req.body?.name || '').trim();
  must(name.length >= 2, 400, 'Ismingizni kiriting');
  run('UPDATE users SET name = ? WHERE id = ?', name, req.user.id);
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

// Yangi login (xodim) faqat super admin tomonidan yaratiladi: POST /api/admin/users

r.delete('/staff/:id', can('manage_staff'), (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ? AND store_id = ?', toInt(req.params.id), req.store.id);
  must(u, 404, 'Xodim topilmadi');
  must(u.role !== 'owner', 400, "Do'kon egasini o'chirib bo'lmaydi");
  run('DELETE FROM users WHERE id = ?', u.id);
  res.json({ ok: true });
});

// ---------- eksport ----------

r.get('/export/clients.csv', (req, res) => {
  sendCsv(res, 'mijozlar.csv', loadClients(req.store.id).map((c) => ({
    Mijoz: c.name, Telefon: c.phone, Turi: c.kind === 'supplier' ? 'Yetkazib beruvchi' : 'Mijoz',
    Berilgan: c.given, "To'langan": c.paid, Qoldiq: c.remaining, Muddat: dmy(c.nextDue), Holat: c.dueLabel,
  })));
});

r.get('/export/debts.csv', (req, res) => {
  sendCsv(res, 'qarzlar.csv', loadDebts(req.store.id).map((d) => ({
    Yozuv: d.code, Sana: dmy(d.date), Mijoz: d.clientName, Turi: d.direction === 'give' ? 'Berildi' : 'Olindi',
    Summa: d.amount, "To'langan": d.paid, Qoldiq: d.remaining, Muddat: dmy(d.dueDate), Izoh: d.note,
  })));
});

r.get('/export/payments.csv', (req, res) => {
  const rows = all(
    `SELECT p.*, c.name AS client_name, u.name AS by_name FROM payments p JOIN debts d ON d.id = p.debt_id
     JOIN clients c ON c.id = d.client_id LEFT JOIN users u ON u.id = p.received_by WHERE p.store_id = ? ORDER BY p.created_at DESC`,
    req.store.id,
  );
  sendCsv(res, "to'lovlar.csv", rows.map((p) => ({
    Sana: p.created_at, Mijoz: p.client_name, Yozuv: debtCode(p.debt_id), Usul: p.method, 'Qabul qildi': p.by_name || '', Summa: p.amount,
  })));
});

export default r;
