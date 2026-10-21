import { Router } from 'express';
import { all, get, run, tx, getSetting, setSetting } from '../db.js';
import {
  today, addDays, monthStart, isoDateTime, normalizePhone, must, toInt, parseJSON, initials, maskPhone, HttpError,
} from '../util.js';
import {
  authRequired, adminRequired, log, clientIp, userLabel, hashPassword, PERMISSIONS, DEFAULT_PERMS, publicUser,
} from '../auth.js';
import { storeView } from '../data.js';
import { DEFAULT_TEMPLATE } from '../sms.js';
import { toCsv } from '../csv.js';

const r = Router();
r.use(authRequired, adminRequired);

function superOnly(req) {
  must(req.user.role === 'superadmin', 403, "Bu amal faqat super admin uchun");
}

function checkPassword(password) {
  must(String(password || '').length >= 6, 400, "Parol kamida 6 belgidan iborat bo'lsin");
}

const ROLE_LABEL = { owner: 'Egasi', manager: 'Menejer', cashier: 'Kassir', superadmin: 'Egasi', support: "Qo'llab-quvvatlash", finance: 'Moliya' };

function planView(p) {
  return {
    id: p.id, name: p.name, tag: p.tag, price: p.price, clientLimit: p.client_limit, staffLimit: p.staff_limit,
    smsLimit: p.sms_limit, features: parseJSON(p.features, []),
    subscribers: get('SELECT COUNT(*) AS n FROM stores WHERE plan_id = ?', p.id).n,
  };
}

function storeRows() {
  return all(
    `SELECT s.*, p.name AS plan_name,
       (SELECT COUNT(*) FROM clients c WHERE c.store_id = s.id AND c.kind = 'customer') AS clients,
       (SELECT COALESCE(SUM(amount),0) FROM debts d WHERE d.store_id = s.id AND d.direction = 'give') AS turnover,
       (SELECT name FROM users u WHERE u.store_id = s.id AND u.role = 'owner' LIMIT 1) AS owner,
       (SELECT phone FROM users u WHERE u.store_id = s.id AND u.role = 'owner' LIMIT 1) AS owner_phone,
       (SELECT MAX(last_login) FROM users u WHERE u.store_id = s.id) AS last_active
     FROM stores s LEFT JOIN plans p ON p.id = s.plan_id ORDER BY s.created_at DESC`,
  ).map((s) => ({
    id: s.id,
    code: `ST-${String(s.id).padStart(5, '0')}`,
    initials: initials(s.name),
    name: s.name,
    city: s.city,
    region: s.region || s.city.split(',')[0],
    owner: s.owner || '—',
    phone: s.owner_phone || s.phone,
    plan: s.plan_name || '—',
    planId: s.plan_id,
    clients: s.clients,
    turnover: s.turnover,
    until: s.sub_until,
    joined: s.created_at.slice(0, 10),
    lastActive: s.last_active,
    smsEnabled: !!s.sms_enabled,
    status: s.status,
  }));
}

function filterStores(list, { q = '', region = '', plan = '', status = '' }) {
  const query = String(q).trim().toLowerCase();
  return list.filter((s) =>
    (!query || s.name.toLowerCase().includes(query) || s.owner.toLowerCase().includes(query) || s.phone.replace(/\D/g, '').includes(query.replace(/\D/g, '') || '~'))
    && (!region || s.region === region)
    && (!plan || String(s.planId) === String(plan))
    && (!status || status === 'all' || s.status === status));
}

r.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- umumiy ko'rinish ----------

r.get('/overview', (req, res) => {
  const stores = storeRows();
  const ms = monthStart();
  const t = today();
  const page = Math.max(1, toInt(req.query.page, 1));
  const filtered = filterStores(stores, req.query);
  const capacity = Number(getSetting('sms_capacity', 20000));
  const balance = Number(getSetting('sms_balance', 0));
  res.json({
    stores: {
      total: stores.length,
      newThisMonth: stores.filter((s) => s.joined >= ms).length,
      active: stores.filter((s) => s.status === 'active').length,
      trial: stores.filter((s) => s.status === 'trial').length,
      blocked: stores.filter((s) => s.status === 'blocked').length,
    },
    users: {
      total: get("SELECT COUNT(*) AS n FROM users WHERE store_id IS NOT NULL").n,
      activeToday: get("SELECT COUNT(*) AS n FROM users WHERE store_id IS NOT NULL AND substr(last_login,1,10) = ?", t).n,
    },
    revenueMonth: get("SELECT COALESCE(SUM(amount),0) AS s FROM invoices WHERE status = 'ok' AND created_at >= ?", ms).s,
    paidSubs: get("SELECT COUNT(*) AS n FROM stores s JOIN plans p ON p.id = s.plan_id WHERE s.status = 'active' AND p.price > 0").n,
    sms: { balance, capacity, low: balance < capacity * 0.5 },
    list: filtered.slice((page - 1) * 7, page * 7),
    listTotal: filtered.length,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / 7)),
    plans: all('SELECT * FROM plans ORDER BY sort').map(planView),
    events: all("SELECT * FROM logs WHERE module IN ('Do''konlar','Obuna','SMS') AND level IN ('ok','err') ORDER BY created_at DESC LIMIT 4"),
  });
});

// ---------- do'konlar ----------

r.get('/stores', (req, res) => {
  const stores = storeRows();
  const list = filterStores(stores, req.query);
  res.json({
    stores: list,
    counts: {
      total: stores.length,
      active: stores.filter((s) => s.status === 'active').length,
      trial: stores.filter((s) => s.status === 'trial').length,
      blocked: stores.filter((s) => s.status === 'blocked').length,
    },
    regions: [...new Set(stores.map((s) => s.region).filter(Boolean))].sort(),
    plans: all('SELECT id, name FROM plans ORDER BY sort'),
  });
});

r.get('/stores/:id', (req, res) => {
  const s = get('SELECT * FROM stores WHERE id = ?', toInt(req.params.id));
  must(s, 404, "Do'kon topilmadi");
  const row = storeRows().find((x) => x.id === s.id);
  const plan = get('SELECT * FROM plans WHERE id = ?', s.plan_id);
  res.json({
    store: { ...storeView(s), ...row },
    staff: get('SELECT COUNT(*) AS n FROM users WHERE store_id = ?', s.id).n,
    staffLimit: plan?.staff_limit ?? null,
    smsUsed: get("SELECT COUNT(*) AS n FROM sms_log WHERE store_id = ? AND kind != 'otp' AND created_at >= ?", s.id, monthStart()).n,
    smsLimit: plan?.sms_limit ?? 0,
  });
});

r.post('/stores', (req, res) => {
  superOnly(req);
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const ownerName = String(b.ownerName || '').trim();
  const phone = normalizePhone(b.phone);
  must(name.length >= 2, 400, "Do'kon nomini kiriting");
  must(ownerName.length >= 2, 400, 'Egasining ismini kiriting');
  must(phone, 400, "Telefon raqam noto'g'ri");
  must(!get('SELECT id FROM users WHERE phone = ?', phone), 400, 'Bu raqam bilan foydalanuvchi mavjud');
  checkPassword(b.password);
  const plan = b.planId ? get('SELECT * FROM plans WHERE id = ?', toInt(b.planId)) : get('SELECT * FROM plans ORDER BY sort LIMIT 1');
  const trialDays = Number(getSetting('trial_days', 14)) || 14;
  const city = String(b.city || '').trim();
  const id = tx(() => {
    const s = run(
      `INSERT INTO stores(name, city, region, phone, plan_id, status, sub_until, sms_template, rules, prefs, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      name, city, city.split(',')[0], phone, plan?.id ?? null, 'trial', addDays(today(), trialDays), DEFAULT_TEMPLATE,
      JSON.stringify({ before: true, due: true, after: false }), JSON.stringify({ dailyReport: true, overdueAlert: true, sms: true }), isoDateTime(),
    );
    const sid = Number(s.lastInsertRowid);
    run('INSERT INTO users(store_id, name, phone, password_hash, role, created_at) VALUES(?,?,?,?,?,?)', sid, ownerName, phone, hashPassword(String(b.password)), 'owner', isoDateTime());
    return sid;
  });
  log('ok', "Do'konlar", `Yangi do'kon qo'shildi: ${name}`, userLabel(req), clientIp(req));
  res.status(201).json({ id });
});

r.patch('/stores/:id', (req, res) => {
  const s = get('SELECT * FROM stores WHERE id = ?', toInt(req.params.id));
  must(s, 404, "Do'kon topilmadi");
  const action = req.body?.action;
  if (action === 'block') {
    run("UPDATE stores SET status = 'blocked' WHERE id = ?", s.id);
    log('err', "Do'konlar", `Bloklandi: ${s.name}`, userLabel(req), clientIp(req));
  } else if (action === 'unblock') {
    run('UPDATE stores SET status = ? WHERE id = ?', s.sub_until && s.sub_until >= today() ? 'active' : 'trial', s.id);
    log('ok', "Do'konlar", `Blokdan chiqarildi: ${s.name}`, userLabel(req), clientIp(req));
  } else if (action === 'extend') {
    const days = Math.max(1, toInt(req.body?.days, 30));
    const base = s.sub_until && s.sub_until > today() ? s.sub_until : today();
    const until = addDays(base, days);
    const plan = get('SELECT * FROM plans WHERE id = ?', s.plan_id);
    tx(() => {
      run("UPDATE stores SET sub_until = ?, status = 'active' WHERE id = ?", until, s.id);
      run('INSERT INTO invoices(store_id, plan_id, period_from, period_to, gateway, amount, status, created_at) VALUES(?,?,?,?,?,?,?,?)',
        s.id, s.plan_id, base, until, String(req.body?.gateway || "Bank o'tkazmasi"), plan?.price || 0, 'ok', isoDateTime());
    });
    log('ok', 'Obuna', `Obuna uzaytirildi: ${s.name} (${days} kun)`, userLabel(req), clientIp(req));
  } else if (action === 'sms_on' || action === 'sms_off') {
    run('UPDATE stores SET sms_enabled = ? WHERE id = ?', action === 'sms_on' ? 1 : 0, s.id);
    log('info', 'SMS', `${s.name}: SMS yuborish ${action === 'sms_on' ? 'yoqildi' : "o'chirildi"}`, userLabel(req), clientIp(req));
  } else if (action === 'plan') {
    const plan = get('SELECT * FROM plans WHERE id = ?', toInt(req.body?.planId));
    must(plan, 400, 'Tarif topilmadi');
    run('UPDATE stores SET plan_id = ? WHERE id = ?', plan.id, s.id);
    log('info', 'Obuna', `Tarif o'zgartirildi: ${s.name} → ${plan.name}`, userLabel(req), clientIp(req));
  } else {
    throw new HttpError(400, "Noma'lum amal");
  }
  res.json({ ok: true });
});

r.get('/stores.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dokonlar.csv"');
  res.send(toCsv(storeRows().map((s) => ({
    ID: s.code, "Do'kon": s.name, Hudud: s.city, Egasi: s.owner, Telefon: s.phone, Tarif: s.plan,
    Mijozlar: s.clients, 'Qarz aylanmasi': s.turnover, 'Obuna tugashi': s.until, "Qo'shilgan": s.joined, Holat: s.status,
  }))));
});

// ---------- foydalanuvchilar ----------

r.get('/users', (req, res) => {
  const role = req.query.role || 'all';
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = all(
    `SELECT u.*, s.name AS store_name FROM users u LEFT JOIN stores s ON s.id = u.store_id
     WHERE u.store_id IS NOT NULL ORDER BY COALESCE(u.last_login, '') DESC`,
  );
  const t = today();
  const list = rows
    .filter((u) => role === 'all' || u.role === role)
    .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '~'))
    .map((u) => ({
      ...publicUser(u),
      hasPassword: !!u.password_hash,
      initials: initials(u.name),
      store: u.store_name,
      roleLabel: ROLE_LABEL[u.role] || u.role,
      lastLabel: !u.last_login ? '—' : u.last_login.slice(0, 10) === t ? `Bugun, ${u.last_login.slice(11, 16)}`
        : u.last_login.slice(0, 10) === addDays(t, -1) ? `Kecha, ${u.last_login.slice(11, 16)}`
          : `${u.last_login.slice(8, 10)}.${u.last_login.slice(5, 7)}.${u.last_login.slice(0, 4)}`,
    }));
  res.json({
    users: list,
    stats: {
      total: rows.length,
      owners: rows.filter((u) => u.role === 'owner').length,
      staff: rows.filter((u) => u.role !== 'owner').length,
      activeToday: rows.filter((u) => (u.last_login || '').slice(0, 10) === t).length,
    },
    permissions: PERMISSIONS,
    matrix: getSetting('permissions', DEFAULT_PERMS),
  });
});

r.patch('/users/:id', (req, res) => {
  superOnly(req);
  const u = get('SELECT * FROM users WHERE id = ? AND store_id IS NOT NULL', toInt(req.params.id));
  must(u, 404, 'Foydalanuvchi topilmadi');
  const status = ['active', 'inactive', 'blocked'].includes(req.body?.status) ? req.body.status : u.status;
  run('UPDATE users SET status = ? WHERE id = ?', status, u.id);
  log(status === 'blocked' ? 'warn' : 'info', 'Admin', `Foydalanuvchi holati: ${u.name} → ${status}`, userLabel(req), clientIp(req));
  res.json({ ok: true });
});

// Do'kon uchun yangi login (xodim yoki egasi) — faqat super admin
r.post('/users', (req, res) => {
  superOnly(req);
  const b = req.body || {};
  const store = get('SELECT * FROM stores WHERE id = ?', toInt(b.storeId));
  must(store, 400, "Do'konni tanlang");
  const name = String(b.name || '').trim();
  const phone = normalizePhone(b.phone);
  const role = ['owner', 'manager', 'cashier'].includes(b.role) ? b.role : 'cashier';
  must(name.length >= 2, 400, 'Ismni kiriting');
  must(phone, 400, "Telefon raqam noto'g'ri");
  must(!get('SELECT id FROM users WHERE phone = ?', phone), 400, 'Bu raqam bilan foydalanuvchi allaqachon mavjud');
  checkPassword(b.password);
  const plan = get('SELECT staff_limit FROM plans WHERE id = ?', store.plan_id);
  if (plan?.staff_limit) {
    const n = get('SELECT COUNT(*) AS n FROM users WHERE store_id = ?', store.id).n;
    must(n < plan.staff_limit, 403, `${store.name} tarifi ${plan.staff_limit} tagacha xodimga ruxsat beradi`);
  }
  run('INSERT INTO users(store_id, name, phone, password_hash, role, created_at) VALUES(?,?,?,?,?,?)',
    store.id, name, phone, hashPassword(String(b.password)), role, isoDateTime());
  log('ok', 'Admin', `Yangi login yaratildi: ${name} · ${store.name}`, userLabel(req), clientIp(req));
  res.status(201).json({ ok: true });
});

r.put('/users/:id/password', (req, res) => {
  superOnly(req);
  const u = get('SELECT * FROM users WHERE id = ? AND store_id IS NOT NULL', toInt(req.params.id));
  must(u, 404, 'Foydalanuvchi topilmadi');
  checkPassword(req.body?.password);
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(req.body.password)), u.id);
  log('info', 'Admin', `Parol o'zgartirildi: ${u.name}`, userLabel(req), clientIp(req));
  res.json({ ok: true });
});

r.delete('/users/:id', (req, res) => {
  superOnly(req);
  const u = get('SELECT * FROM users WHERE id = ? AND store_id IS NOT NULL', toInt(req.params.id));
  must(u, 404, 'Foydalanuvchi topilmadi');
  run('DELETE FROM users WHERE id = ?', u.id);
  log('warn', 'Admin', `Login o'chirildi: ${u.name}`, userLabel(req), clientIp(req));
  res.json({ ok: true });
});

r.put('/permissions', (req, res) => {
  const incoming = req.body?.matrix || {};
  const matrix = {};
  for (const p of PERMISSIONS) {
    const row = incoming[p.key] || DEFAULT_PERMS[p.key];
    matrix[p.key] = { owner: true, manager: !!row.manager, cashier: !!row.cashier };
  }
  setSetting('permissions', matrix);
  log('info', 'Admin', 'Rollar ruxsatlari yangilandi', userLabel(req), clientIp(req));
  res.json({ matrix });
});

// ---------- tariflar va to'lovlar ----------

r.get('/plans', (_req, res) => {
  res.json({ plans: all('SELECT * FROM plans ORDER BY sort').map(planView) });
});

function planInput(b) {
  const name = String(b.name || '').trim();
  must(name.length >= 2, 400, 'Tarif nomini kiriting');
  const features = Array.isArray(b.features) ? b.features.map(String).filter(Boolean) : String(b.features || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const lim = (v) => (v === '' || v === null || v === undefined ? null : toInt(v));
  return [name, String(b.tag || ''), Math.max(0, toInt(b.price)), lim(b.clientLimit), lim(b.staffLimit), Math.max(0, toInt(b.smsLimit)), JSON.stringify(features)];
}

r.post('/plans', (req, res) => {
  const sort = get('SELECT COALESCE(MAX(sort),0) + 1 AS n FROM plans').n;
  run('INSERT INTO plans(name, tag, price, client_limit, staff_limit, sms_limit, features, sort) VALUES(?,?,?,?,?,?,?,?)', ...planInput(req.body || {}), sort);
  log('info', 'Admin', `Yangi tarif: ${req.body?.name}`, userLabel(req), clientIp(req));
  res.status(201).json({ ok: true });
});

r.put('/plans/:id', (req, res) => {
  const p = get('SELECT * FROM plans WHERE id = ?', toInt(req.params.id));
  must(p, 404, 'Tarif topilmadi');
  run('UPDATE plans SET name = ?, tag = ?, price = ?, client_limit = ?, staff_limit = ?, sms_limit = ?, features = ? WHERE id = ?', ...planInput(req.body || {}), p.id);
  log('info', 'Admin', `Tarif narxi yangilandi: ${p.name}`, userLabel(req), clientIp(req));
  res.json({ ok: true });
});

r.get('/invoices', (req, res) => {
  const status = ['ok', 'wait', 'fail'].includes(req.query.status) ? req.query.status : null;
  const rows = all(
    `SELECT i.*, s.name AS store_name, p.name AS plan_name FROM invoices i JOIN stores s ON s.id = i.store_id LEFT JOIN plans p ON p.id = i.plan_id
     ${status ? 'WHERE i.status = ?' : ''} ORDER BY i.created_at DESC, i.id DESC LIMIT 100`,
    ...(status ? [status] : []),
  );
  res.json({
    invoices: rows.map((i) => ({
      id: i.id, code: `#INV-${i.id}`, date: i.created_at.slice(0, 10), store: i.store_name, plan: i.plan_name || '—',
      from: i.period_from, to: i.period_to, gateway: i.gateway, amount: i.amount, status: i.status,
    })),
    monthRevenue: get("SELECT COALESCE(SUM(amount),0) AS s FROM invoices WHERE status = 'ok' AND created_at >= ?", monthStart()).s,
  });
});

// ---------- SMS xizmati ----------

r.get('/sms', (_req, res) => {
  const t = today();
  const from = addDays(t, -13);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(from, i);
    const row = get("SELECT SUM(status = 'sent') AS ok, SUM(status = 'fail') AS fail FROM sms_log WHERE substr(created_at,1,10) = ?", d);
    return { date: d, ok: row.ok || 0, fail: row.fail || 0 };
  });
  const sent = days.reduce((s, d) => s + d.ok + d.fail, 0);
  const ok = days.reduce((s, d) => s + d.ok, 0);
  const balance = Number(getSetting('sms_balance', 0));
  const capacity = Number(getSetting('sms_capacity', 20000));
  const perDay = sent / 14 || 1;
  const recent = all(
    `SELECT l.*, s.name AS store_name FROM sms_log l LEFT JOIN stores s ON s.id = l.store_id WHERE l.kind != 'otp'
     ORDER BY l.created_at DESC LIMIT 8`,
  ).map((l) => ({
    id: l.id, time: `${l.created_at.slice(8, 10)}.${l.created_at.slice(5, 7)} · ${l.created_at.slice(11, 16)}`,
    store: l.store_name || 'Tizim', to: maskPhone(l.phone), type: l.type, status: l.status,
  }));
  res.json({
    balance, capacity, pct: capacity ? Math.round((balance / capacity) * 100) : 0,
    daysLeft: Math.round(balance / perDay),
    enabled: getSetting('sms_enabled', true) !== false,
    provider: getSetting('sms_provider', '[PROVAYDER NOMI]'),
    sender: getSetting('sms_sender', 'QarzDaftar'),
    connected: !!getSetting('integrations', {})?.sms,
    days, sent, deliveredPct: sent ? Math.round((ok / sent) * 100) : 0, failed: sent - ok,
    recent,
  });
});

// Platforma bo'yicha SMS yuborishni yoqish/o'chirish (eslatmalar ishlashda davom etadi)
r.put('/sms/enabled', (req, res) => {
  superOnly(req);
  const enabled = !!req.body?.enabled;
  setSetting('sms_enabled', enabled);
  log(enabled ? 'ok' : 'warn', 'SMS', `Platformada SMS yuborish ${enabled ? 'yoqildi' : "o'chirildi"}`, userLabel(req), clientIp(req));
  res.json({ enabled });
});

r.post('/sms/topup', (req, res) => {
  const amount = toInt(req.body?.amount);
  must(amount > 0, 400, 'Paket hajmini kiriting');
  const balance = Number(getSetting('sms_balance', 0)) + amount;
  setSetting('sms_balance', balance);
  setSetting('sms_capacity', Math.max(Number(getSetting('sms_capacity', 20000)), balance));
  log('ok', 'SMS', `SMS paket to'ldirildi: ${amount.toLocaleString('ru-RU').replace(/,/g, ' ')} ta`, userLabel(req), clientIp(req));
  res.json({ balance });
});

// ---------- tizim jurnali ----------

function logQuery(q) {
  const where = [];
  const params = [];
  if (['info', 'warn', 'err', 'ok'].includes(q.level)) { where.push('level = ?'); params.push(q.level); }
  if (q.module && q.module !== 'all') { where.push('module = ?'); params.push(q.module); }
  if (q.date === 'today' || !q.date) { where.push('substr(created_at,1,10) = ?'); params.push(today()); }
  else if (q.date === '7d') { where.push('substr(created_at,1,10) >= ?'); params.push(addDays(today(), -6)); }
  if (q.q) { where.push('(message LIKE ? OR user_label LIKE ? OR ip LIKE ?)'); const like = `%${q.q}%`; params.push(like, like, like); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

r.get('/logs', (req, res) => {
  const { sql, params } = logQuery(req.query);
  const t = today();
  res.json({
    rows: all(`SELECT * FROM logs ${sql} ORDER BY created_at DESC, id DESC LIMIT 200`, ...params),
    stats: {
      today: get('SELECT COUNT(*) AS n FROM logs WHERE substr(created_at,1,10) = ?', t).n,
      warn: get("SELECT COUNT(*) AS n FROM logs WHERE level = 'warn' AND substr(created_at,1,10) = ?", t).n,
      err: get("SELECT COUNT(*) AS n FROM logs WHERE level = 'err' AND substr(created_at,1,10) = ?", t).n,
      uptime: Math.round(process.uptime()),
    },
    modules: all('SELECT DISTINCT module FROM logs ORDER BY module').map((m) => m.module),
  });
});

r.get('/logs.csv', (req, res) => {
  const { sql, params } = logQuery(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="jurnal.csv"');
  res.send(toCsv(all(`SELECT created_at AS Vaqt, level AS Daraja, module AS Modul, message AS Hodisa, user_label AS Foydalanuvchi, ip AS IP FROM logs ${sql} ORDER BY created_at DESC`, ...params)));
});

// ---------- sozlamalar ----------

r.get('/settings', (_req, res) => {
  res.json({
    general: {
      platformName: getSetting('platform_name', 'Qarz Daftar'),
      supportPhone: getSetting('support_phone', ''),
      supportEmail: getSetting('support_email', ''),
      trialDays: getSetting('trial_days', 14),
    },
    security: { twoFactor: true, ipRestrict: false, suspiciousAlert: true, ...getSetting('security', {}) },
    sessionDays: getSetting('session_days', 30),
    integrations: { payme: true, click: true, sms: true, telegram: false, ...getSetting('integrations', {}) },
    admins: all("SELECT * FROM users WHERE role IN ('superadmin','support','finance') ORDER BY id").map((u) => ({
      id: u.id, name: u.name, email: u.email, initials: initials(u.name), role: ROLE_LABEL[u.role],
    })),
  });
});

r.put('/settings', (req, res) => {
  const b = req.body || {};
  if (b.general) {
    setSetting('platform_name', String(b.general.platformName || 'Qarz Daftar'));
    setSetting('support_phone', String(b.general.supportPhone || ''));
    setSetting('support_email', String(b.general.supportEmail || ''));
    setSetting('trial_days', Math.max(1, toInt(b.general.trialDays, 14)));
  }
  if (b.security) setSetting('security', b.security);
  if (b.sessionDays) setSetting('session_days', Math.max(1, toInt(b.sessionDays, 30)));
  if (b.integrations) setSetting('integrations', b.integrations);
  log('info', 'Admin', 'Platforma sozlamalari yangilandi', userLabel(req), clientIp(req));
  res.json({ ok: true });
});

r.post('/admins', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const role = ['support', 'finance', 'superadmin'].includes(b.role) ? b.role : 'support';
  must(req.user.role === 'superadmin', 403, "Faqat super admin yangi admin qo'sha oladi");
  must(name.length >= 2, 400, 'Ismni kiriting');
  must(/^\S+@\S+\.\S+$/.test(email), 400, "Email noto'g'ri");
  must(password.length >= 6, 400, "Parol kamida 6 belgidan iborat bo'lsin");
  must(!get('SELECT id FROM users WHERE email = ?', email), 400, 'Bu email allaqachon mavjud');
  run('INSERT INTO users(name, email, password_hash, role, created_at) VALUES(?,?,?,?,?)', name, email, hashPassword(password), role, isoDateTime());
  log('info', 'Admin', `Yangi admin qo'shildi: ${email}`, userLabel(req), clientIp(req));
  res.status(201).json({ ok: true });
});

export default r;
