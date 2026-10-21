export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

/** 12450000 -> "12 450 000" */
export function money(n: number | null | undefined) {
  return Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Kiritilgan summani raqamga aylantiradi: "500 000" -> 500000 */
export function parseMoney(s: string) {
  return parseInt(String(s).replace(/\D/g, ""), 10) || 0;
}

/** Kiritish paytida bo'shliq bilan formatlash */
export function moneyInput(s: string) {
  const n = String(s).replace(/\D/g, "");
  return n ? money(Number(n)) : "";
}

/** "2026-10-25" -> "25.10.2026" */
export function dmy(s?: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/** "2026-10-25" -> "25.10" */
export function dm(s?: string | null) {
  if (!s) return "—";
  return `${s.slice(8, 10)}.${s.slice(5, 7)}`;
}

/** "2026-10-25" -> "25-oktabr" */
export function dayMonth(s?: string | null) {
  if (!s) return "—";
  return `${Number(s.slice(8, 10))}-${MONTHS[Number(s.slice(5, 7)) - 1]}`;
}

/** "2026-10-18" -> "18-okt" */
export function dayMonthShort(s?: string | null) {
  if (!s) return "—";
  return `${Number(s.slice(8, 10))}-${MONTHS_SHORT[Number(s.slice(5, 7)) - 1]}`;
}

/** "2026-10-25" -> "25-oktabr, 2026" */
export function longDate(s?: string | null) {
  if (!s) return "—";
  return `${dayMonth(s)}, ${s.slice(0, 4)}`;
}

/** dd.mm.yyyy kiritilgan sanani yyyy-mm-dd ga */
export function toIso(s: string) {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function initials(name = "") {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** "16 kun qoldi" kabi qisqa belgi uchun rang klassi */
export type Status = "ok" | "late" | "paid" | "new";
export const statusClass = (s: Status) => (s === "late" ? "late" : s === "paid" ? "paid" : "");
export const statusBadge = (s: Status) => (s === "late" ? "b-late" : s === "paid" || s === "new" ? "b-paid" : "b-ok");
export const statusText = (s: Status) => (s === "late" ? "Muddati o'tgan" : s === "paid" ? "Yopilgan" : s === "new" ? "Yangi" : "Faol");

export const ROLE_LABEL: Record<string, string> = { owner: "Egasi", manager: "Menejer", cashier: "Kassir" };
