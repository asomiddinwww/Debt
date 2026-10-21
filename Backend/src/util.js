// Sana, holat va matn yordamchilari

const pad = (n) => String(n).padStart(2, '0');

export function now() {
  return new Date();
}

export function isoDate(d = now()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoDateTime(d = now()) {
  return `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function today() {
  return isoDate();
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function diffDays(fromStr, toStr) {
  const a = new Date(`${fromStr.slice(0, 10)}T00:00:00`);
  const b = new Date(`${toStr.slice(0, 10)}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export function monthStart(d = now()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
export const MONTHS_TITLE = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
export const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

/** "2026-10-25" -> "25.10.2026" */
export function dmy(s) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** Ochiq qarz holati: ok | late | paid */
export function debtStatus(remaining, dueDate, t = today()) {
  if (remaining <= 0) return 'paid';
  if (dueDate && dueDate < t) return 'late';
  return 'ok';
}

/** "5 kun qoldi" / "8 kun o'tdi" / "Bugun" / "Yopilgan" */
export function dueLabel(remaining, dueDate, t = today()) {
  if (remaining <= 0) return 'Yopilgan';
  if (!dueDate) return 'Muddatsiz';
  const d = diffDays(t, dueDate);
  if (d === 0) return 'Bugun';
  if (d > 0) return `${d} kun qoldi`;
  return `${-d} kun o'tdi`;
}

export function initials(name = '') {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Telefonni "+998 90 123 45 67" ko'rinishiga keltiradi */
export function normalizePhone(input = '') {
  let digits = String(input).replace(/\D/g, '');
  if (digits.length === 9) digits = '998' + digits;
  if (digits.length !== 12 || !digits.startsWith('998')) return null;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

export function maskPhone(phone = '') {
  const p = phone.split(' ');
  if (p.length !== 5) return phone;
  return `${p[0]} ${p[1]} *** ** ${p[4]}`;
}

export function fmtMoney(n) {
  return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function parseJSON(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function must(cond, status, message) {
  if (!cond) throw new HttpError(status, message);
}

export function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? '').replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** "dd.mm.yyyy" yoki "yyyy-mm-dd" -> "yyyy-mm-dd" */
export function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
