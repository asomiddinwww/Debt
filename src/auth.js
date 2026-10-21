import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { get, run, getSetting } from './db.js';
import { HttpError, isoDateTime } from './util.js';

const SECRET = process.env.JWT_SECRET || 'qarz-daftar-dev-secret-change-me';

export const PERMISSIONS = [
  { key: 'add_debt', name: "Qarz qo'shish" },
  { key: 'take_payment', name: "To'lov qabul qilish" },
  { key: 'delete_debt', name: "Qarzni o'chirish" },
  { key: 'view_reports', name: "Hisobotlarni ko'rish" },
  { key: 'send_sms', name: 'SMS yuborish' },
  { key: 'manage_staff', name: 'Xodimlarni boshqarish' },
];

export const DEFAULT_PERMS = {
  add_debt: { owner: true, manager: true, cashier: true },
  take_payment: { owner: true, manager: true, cashier: true },
  delete_debt: { owner: true, manager: true, cashier: false },
  view_reports: { owner: true, manager: true, cashier: false },
  send_sms: { owner: true, manager: true, cashier: false },
  manage_staff: { owner: true, manager: false, cashier: false },
};

export const ADMIN_ROLES = ['superadmin', 'support', 'finance'];

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

export function signToken(user) {
  const days = Number(getSetting('session_days', 30)) || 30;
  return jwt.sign({ uid: user.id, role: user.role, sid: user.store_id ?? null }, SECRET, { expiresIn: `${days}d` });
}

export function clientIp(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  return ip.replace('::ffff:', '') || '—';
}

export function log(level, module, message, userLabel = 'Tizim', ip = '—') {
  run('INSERT INTO logs(level, module, message, user_label, ip, created_at) VALUES(?,?,?,?,?,?)', level, module, message, userLabel, ip, isoDateTime());
}

export function userLabel(req) {
  if (!req.user) return 'Tizim';
  if (ADMIN_ROLES.includes(req.user.role)) return req.user.name;
  return req.store ? `${req.user.name} · ${req.store.name}` : req.user.name;
}

function readToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.query?.token) return String(req.query.token); // CSV yuklab olish havolalari uchun
  return null;
}

export function authRequired(req, _res, next) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Avtorizatsiya talab qilinadi');
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    throw new HttpError(401, 'Sessiya muddati tugagan. Qaytadan kiring');
  }
  const user = get('SELECT * FROM users WHERE id = ?', payload.uid);
  if (!user || user.status !== 'active') throw new HttpError(401, 'Foydalanuvchi topilmadi yoki bloklangan');
  req.user = user;
  if (user.store_id) {
    req.store = get('SELECT * FROM stores WHERE id = ?', user.store_id);
  }
  next();
}

export function storeRequired(req, _res, next) {
  if (!req.store) throw new HttpError(403, "Bu bo'lim faqat do'kon xodimlari uchun");
  if (req.store.status === 'blocked') throw new HttpError(403, "Do'kon bloklangan. Obunani yangilash uchun qo'llab-quvvatlash xizmatiga murojaat qiling");
  next();
}

export function adminRequired(req, _res, next) {
  if (!ADMIN_ROLES.includes(req.user?.role)) throw new HttpError(403, 'Faqat administratorlar uchun');
  next();
}

export function can(perm) {
  return (req, _res, next) => {
    const perms = getSetting('permissions', DEFAULT_PERMS);
    const allowed = perms?.[perm]?.[req.user.role];
    if (!allowed) throw new HttpError(403, "Bu amal uchun ruxsatingiz yo'q");
    next();
  };
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    storeId: u.store_id,
    device: u.device,
    status: u.status,
    lastLogin: u.last_login,
  };
}
