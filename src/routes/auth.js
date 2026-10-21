import { Router } from 'express';
import { get, run, getSetting } from '../db.js';
import { normalizePhone, must, isoDateTime } from '../util.js';
import {
  signToken, verifyPassword, publicUser, authRequired, log, clientIp, ADMIN_ROLES, PERMISSIONS, DEFAULT_PERMS,
} from '../auth.js';
import { storeView } from '../data.js';

const r = Router();
const STORE_ROLES = ['owner', 'manager', 'cashier'];

function detectDevice(ua = '') {
  if (/iphone|ipad|ios/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  return 'Veb';
}

// Do'kon xodimlari kirishi: faqat super admin yaratgan telefon raqam + parol
r.post('/login', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const password = String(req.body?.password || '');
  must(phone, 400, "Telefon raqam noto'g'ri. Masalan: 90 123 45 67");
  must(password, 400, 'Parolni kiriting');

  const user = get('SELECT * FROM users WHERE phone = ?', phone);
  if (!user || !STORE_ROLES.includes(user.role) || !verifyPassword(password, user.password_hash)) {
    log('warn', 'Auth', "Noto'g'ri telefon yoki parol bilan kirish urinishi", phone.replace(/(\d{3}) (\d{2}) (\d{2})$/, '*** ** $3'), clientIp(req));
    must(false, 401, "Telefon raqam yoki parol noto'g'ri");
  }
  must(user.status !== 'blocked', 403, 'Hisobingiz bloklangan. Administratorga murojaat qiling');
  must(user.status !== 'inactive', 403, 'Hisobingiz faol emas. Administratorga murojaat qiling');

  const store = get('SELECT * FROM stores WHERE id = ?', user.store_id);
  must(store, 403, "Do'kon topilmadi");
  must(store.status !== 'blocked', 403, "Do'kon bloklangan. Administratorga murojaat qiling");

  const device = detectDevice(req.headers['user-agent']);
  run('UPDATE users SET last_login = ?, device = ? WHERE id = ?', isoDateTime(), device, user.id);
  log('info', 'Auth', `${device === 'Veb' ? 'Veb' : 'Mobil ilova'} orqali tizimga kirish`, `${user.name} · ${store.name}`, clientIp(req));

  res.json({ token: signToken(user), user: publicUser(user), store: storeView(store) });
});

// Admin panelga kirish: email + parol
r.post('/admin-login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !ADMIN_ROLES.includes(user.role) || !verifyPassword(password, user.password_hash)) {
    log('warn', 'Auth', `Admin panelga muvaffaqiyatsiz kirish urinishi: ${email || '—'}`, 'Tizim', clientIp(req));
    must(false, 401, "Email yoki parol noto'g'ri");
  }
  run('UPDATE users SET last_login = ? WHERE id = ?', isoDateTime(), user.id);
  log('info', 'Admin', 'Admin panelga kirish', user.name, clientIp(req));
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.get('/me', authRequired, (req, res) => {
  const perms = getSetting('permissions', DEFAULT_PERMS);
  const allowed = Object.fromEntries(PERMISSIONS.map((p) => [p.key, !!perms?.[p.key]?.[req.user.role]]));
  res.json({ user: publicUser(req.user), store: storeView(req.store), permissions: allowed, sms: !!req.store && storeView(req.store).smsAllowed });
});

export default r;
