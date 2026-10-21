import { run, get, getSetting, setSetting } from './db.js';
import { isoDateTime, fmtMoney, dmy, monthStart } from './util.js';
import { log } from './auth.js';

export const DEFAULT_TEMPLATE =
  "Assalomu alaykum, {ism}! {dokon} do'konidagi {summa} so'm qarzingizni {muddat} gacha qaytarishingizni so'raymiz.";

export function renderTemplate(tpl, { name, amount, due, store }) {
  const first = (name || '').split(' ')[0];
  return (tpl || DEFAULT_TEMPLATE)
    .replaceAll('{ism}', first)
    .replaceAll('{summa}', fmtMoney(amount))
    .replaceAll('{muddat}', dmy(due))
    .replaceAll('{dokon}', store?.name || '');
}

/**
 * Do'kon egasining o'z telefonidan yuborilgan SMSni jurnalga yozish.
 * Xabarni telefonning SMS ilovasi yuboradi (sms: havola), shuning uchun
 * yetkazilgani tasdiqlanmaydi — holati 'phone'.
 */
export function recordPhoneSms({ store, phone, text, type, kind = 'manual', clientId = null, debtId = null }) {
  run(
    'INSERT INTO sms_log(store_id, client_id, debt_id, phone, type, kind, text, status, created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    store.id, clientId, debtId, phone, type, kind, text, 'phone', isoDateTime(),
  );
}

/**
 * SMS provayder orqali yuborish (hozircha ishlatilmaydi). Haqiqiy provayder (Eskiz, Playmobile va h.k.) ulanmagan bo'lsa,
 * xabar konsolga chiqariladi va jurnalga "yetkazildi" deb yoziladi.
 */
export function sendSms({ store, phone, text, type, kind = 'manual', clientId = null, debtId = null }) {
  const balance = Number(getSetting('sms_balance', 0));
  let status = 'sent';
  if (!phone) status = 'fail';
  if (balance <= 0) status = 'fail';

  if (store) {
    const plan = get('SELECT sms_limit FROM plans WHERE id = ?', store.plan_id);
    const used = get("SELECT COUNT(*) AS n FROM sms_log WHERE store_id = ? AND created_at >= ? AND kind != 'otp'", store.id, monthStart()).n;
    if (plan && plan.sms_limit > 0 && used >= plan.sms_limit) status = 'fail';
    if (plan && plan.sms_limit === 0 && kind !== 'otp') status = 'fail';
  }

  if (status === 'sent') {
    setSetting('sms_balance', balance - 1);
    console.log(`[SMS] -> ${phone}: ${text}`);
  } else {
    log('err', 'SMS', `Yetkazilmadi: ${phone || "raqam yo'q"}`, store?.name || 'Tizim');
  }

  run(
    'INSERT INTO sms_log(store_id, client_id, debt_id, phone, type, kind, text, status, created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    store?.id ?? null, clientId, debtId, phone || '', type, kind, text, status, isoDateTime(),
  );
  return status;
}
