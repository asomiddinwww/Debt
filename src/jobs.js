import { all, get, run, smsAllowed } from './db.js';
import { today, addDays, diffDays, isoDateTime, parseJSON, fmtMoney, dmy } from './util.js';
import { loadDebts } from './data.js';

function hasNotification(storeId, ref) {
  return !!get('SELECT id FROM notifications WHERE store_id = ? AND ref = ?', storeId, ref);
}

/**
 * Avtomatik eslatmalar va bildirishnomalar.
 * Har 10 daqiqada ishlaydi; har bir qoida kuniga bir marta bajariladi.
 */
export function runJobs() {
  const t = today();
  const hour = new Date().getHours();
  const stores = all("SELECT * FROM stores WHERE status != 'blocked'");

  for (const store of stores) {
    const rules = parseJSON(store.rules, {});
    const prefs = parseJSON(store.prefs, {});
    const canSms = smsAllowed(store);
    const debts = loadDebts(store.id).filter((d) => d.direction === 'give' && d.remaining > 0 && d.dueDate);

    for (const d of debts) {
      const left = diffDays(t, d.dueDate);
      // SMS do'kon egasining telefonidan ketadi, shuning uchun qoidalar vaqti kelganda
      // "eslatma yuborish kerak" bildirishnomasi yaratiladi (Eslatmalar sahifasida bir bosishda yuboriladi)
      // SMS o'chirilgan bo'lsa ham eslatma ishlaydi — do'kon egasi mijozga o'zi eslatadi
      const smsOn = d.smsReminder && (!canSms || prefs.sms !== false);
      const remind = (kind, when) => {
        const ref = `remind:${d.id}:${kind}:${t}`;
        if (hasNotification(store.id, ref)) return;
        run('INSERT INTO notifications(store_id, type, title, text, ref, created_at) VALUES(?,?,?,?,?,?)',
          store.id, 'sms', canSms ? 'Eslatma yuborish vaqti' : 'Mijozga eslating',
          canSms ? `${d.clientName}ga SMS eslatma yuboring (${when}). Eslatmalar bo'limidan bir bosishda yuboriladi.` : `${d.clientName} — ${when}, qoldiq ${fmtMoney(d.remaining)} so'm. Mijozga eslating.`,
          ref, isoDateTime());
      };
      if (smsOn && rules.before && left === 1 && hour >= 10) remind('before', 'muddat ertaga');
      if (smsOn && rules.due && left === 0 && hour >= 9) remind('due', 'muddat bugun');
      if (smsOn && rules.after && left < 0 && -left % 3 === 0 && hour >= 9) remind('after', `${-left} kun kechikdi`);

      // Bildirishnomalar: muddat yaqinlashganda (1 kun qolganda) va kechikkanda (har kuni)
      if (left === 1 && !hasNotification(store.id, `due:${d.id}`)) {
        run('INSERT INTO notifications(store_id, type, title, text, ref, created_at) VALUES(?,?,?,?,?,?)',
          store.id, 'due', 'Muddat yaqinlashmoqda', `${d.clientName} — ${dmy(d.dueDate).slice(0, 5)} gacha ${fmtMoney(d.remaining)} so'm.`, `due:${d.id}`, isoDateTime());
      }
      if (left < 0 && prefs.overdueAlert !== false && !hasNotification(store.id, `late:${d.id}:${t}`)) {
        run('INSERT INTO notifications(store_id, type, title, text, ref, created_at) VALUES(?,?,?,?,?,?)',
          store.id, 'late', "Muddat o'tdi", `${d.clientName} qarzi ${-left} kundan beri kechikmoqda.`, `late:${d.id}:${t}`, `${t} 09:00:00`);
      }
    }

    // Muddati tugagan sinov/obunalar
    if (store.sub_until && store.sub_until < addDays(t, -3) && store.status === 'trial') {
      run("UPDATE stores SET status = 'blocked' WHERE id = ?", store.id);
      run("INSERT INTO logs(level, module, message, user_label, created_at) VALUES('err','Obuna',?, 'Tizim', ?)",
        `Bloklandi: ${store.name} · Sinov muddati tugadi`, isoDateTime());
    }
  }
}
