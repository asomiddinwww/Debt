// Demo ma'lumotlar: dizayndagi do'konlar, mijozlar, qarzlar va to'lovlar.
// Ishga tushirish: npm run seed  (bazani tozalab, qaytadan to'ldiradi)
import { fileURLToPath } from 'node:url';
import { db, run, tx, setSetting } from './db.js';
import { hashPassword, DEFAULT_PERMS } from './auth.js';
import { DEFAULT_TEMPLATE } from './sms.js';
import { addDays, today } from './util.js';

// Deterministik tasodifiy sonlar (har safar bir xil demo)
let seedState = 20261020;
function rnd() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const round = (n, step = 50000) => Math.max(step, Math.round(n / step) * step);

const FIRST = ['Aziz', 'Bobur', 'Dilshod', 'Eldor', 'Farrux', 'G‘ayrat', 'Hasan', 'Islom', 'Jamshid', 'Kamol', 'Laziz', 'Mansur', 'Nodir', 'Otabek', 'Pulat', 'Ravshan', 'Sanjar', 'Temur', 'Ulug‘bek', 'Xurshid', 'Zafar', 'Anvar',
  'Barno', 'Dildora', 'Feruza', 'Gulnoza', 'Hilola', 'Iroda', 'Kamola', 'Lola', 'Madina', 'Nargiza', 'Ozoda', 'Rayhona', 'Sevara', 'Shahnoza', 'Umida', 'Yulduz', 'Zarina', 'Mohira'];
const LAST = ['Abdullayev', 'Bakirov', 'Davletov', 'Ergashev', 'Fayziyev', 'G‘aniyev', 'Hamidov', 'Ismoilov', 'Jo‘rayev', 'Karimov', 'Latipov', 'Mirzayev', 'Normatov', 'Olimov', 'Qodirov', 'Rasulov', 'Saidov', 'Toshmatov', 'Usmonov', 'Xolmatov', 'Yo‘ldoshev', 'Zokirov'];
const OPS = ['90', '91', '93', '94', '95', '97', '98', '99', '33', '88'];

function fakeName() {
  const f = pick(FIRST);
  let l = pick(LAST);
  const female = FIRST.indexOf(f) >= 22;
  if (female) l = l.endsWith('ov') || l.endsWith('ev') ? `${l}a` : l;
  return `${f} ${l}`;
}
function fakePhone() {
  const d = () => Math.floor(rnd() * 10);
  return `+998 ${pick(OPS)} ${d()}${d()}${d()} ${d()}${d()} ${d()}${d()}`;
}
const dt = (date, time = '10:00:00') => `${date} ${time.length === 5 ? `${time}:00` : time}`;

function clearAll() {
  db.exec(`
    DELETE FROM payments; DELETE FROM debts; DELETE FROM notifications; DELETE FROM sms_log; DELETE FROM invoices;
    DELETE FROM clients; DELETE FROM users; DELETE FROM stores; DELETE FROM plans; DELETE FROM logs; DELETE FROM otp_codes; DELETE FROM settings;
    DELETE FROM sqlite_sequence;
  `);
}

export function seed() {
  tx(() => {
    clearAll();
    const T = today();

    // ---------- tariflar ----------
    run(`INSERT INTO plans(id, name, tag, price, client_limit, staff_limit, sms_limit, features, sort) VALUES
      (1, 'Boshlang''ich', 'Bepul', 0, 50, 1, 0, '["50 tagacha mijoz","1 xodim","Asosiy hisobotlar"]', 1),
      (2, 'Biznes', 'Ommabop', 99000, NULL, 5, 200, '["Cheksiz mijoz","5 tagacha xodim","Oyiga 200 SMS eslatma"]', 2),
      (3, 'Premium', 'Kengaytirilgan', 199000, NULL, NULL, 1000, '["Bir nechta filial","Cheksiz xodim","Oyiga 1000 SMS, Excel eksport"]', 3)`);

    // ---------- do'konlar ----------
    const rules = JSON.stringify({ before: true, due: true, after: false });
    const prefs = JSON.stringify({ dailyReport: true, overdueAlert: true, bigDebt: false, sms: true, pin: true });
    const stores = [
      // id, name, branch, city, region, plan, status, until, joined, clients, turnover
      [1, 'Baraka Savdo', 'Chilonzor filiali', 'Toshkent, Chilonzor', 'Toshkent', 2, 'active', '2026-11-20', '2026-03-12', 0, 0],
      [2, 'Ziyo Qurilish', 'Bosh ofis', 'Toshkent, Yunusobod', 'Toshkent', 3, 'active', '2027-01-14', '2026-01-05', 182, 214600000],
      [3, 'Shifo Dorixona', '', 'Buxoro', 'Buxoro', 3, 'active', '2027-03-05', '2026-02-22', 96, 48300000],
      [4, 'Farg‘ona Mebel', '', 'Farg‘ona', 'Farg‘ona', 2, 'active', '2026-11-28', '2026-05-17', 39, 87900000],
      [5, 'Oqtepa Savdo', '', 'Namangan', 'Namangan', 2, 'blocked', '2026-10-10', '2026-04-09', 57, 31200000],
      [6, 'Nur Market', '', 'Samarqand', 'Samarqand', 1, 'trial', '2026-11-03', '2026-10-20', 6, 2100000],
      [7, 'Dehqon Bozori #4', '', 'Andijon', 'Andijon', 1, 'trial', '2026-10-30', '2026-10-16', 18, 6750000],
      [8, 'Qo‘qon Tekstil', '', 'Farg‘ona, Qo‘qon', 'Farg‘ona', 2, 'active', '2026-11-08', '2026-06-02', 44, 65400000],
      [9, 'Xorazm Agro', '', 'Urganch', 'Xorazm', 2, 'active', '2026-11-28', '2026-07-28', 31, 22800000],
    ];
    for (const s of stores) {
      run(`INSERT INTO stores(id, name, branch, city, region, phone, address, inn, telegram, plan_id, status, sub_until, sms_template, rules, prefs, created_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      s[0], s[1], s[2], s[3], s[4], s[0] === 1 ? '+998 71 200 00 00' : '', '', '', s[0] === 1 ? '@barakasavdo' : '', s[5], s[6], s[7],
      s[0] === 1 ? "Assalomu alaykum, {ism}! Baraka Savdo do'konidagi {summa} so'm qarzingizni {muddat} gacha qaytarishingizni so'raymiz. Tel: +998 71 200 00 00" : DEFAULT_TEMPLATE,
      rules, prefs, dt(s[8], '09:00'));
    }

    // ---------- foydalanuvchilar ----------
    const users = [
      // id, store, name, phone, role, device, last_login, status
      [1, 1, 'Abdulvoris H.', '+998 90 111 22 33', 'owner', 'Android', dt(T, '14:32'), 'active'],
      [2, 1, 'Aziza R.', '+998 93 444 55 66', 'cashier', 'Android', dt(T, '14:30'), 'active'],
      [3, 1, 'Otabek T.', '+998 97 777 88 99', 'manager', 'Veb', dt(addDays(T, -2), '17:10'), 'active'],
      [4, 2, 'Rustam Z.', '+998 97 333 66 77', 'owner', 'Veb', dt(T, '12:05'), 'active'],
      [5, 2, 'Diyor K.', '+998 99 121 34 56', 'manager', 'Veb', dt(T, '11:48'), 'active'],
      [6, 3, 'Javohir Sh.', '+998 90 777 33 22', 'owner', 'iOS', dt(addDays(T, -1), '19:20'), 'active'],
      [7, 5, 'Kamola O.', '+998 91 444 88 99', 'owner', 'Android', dt('2026-10-10', '08:15'), 'blocked'],
      [8, 6, 'Otabek N.', '+998 93 222 44 55', 'owner', 'Android', dt(T, '11:20'), 'active'],
      [9, 4, 'Sherzod M.', '+998 94 555 11 00', 'owner', 'Android', dt(addDays(T, -1), '10:02'), 'active'],
      [10, 4, 'Laylo M.', '+998 94 909 80 70', 'cashier', 'Android', dt('2026-10-02', '16:40'), 'inactive'],
      [11, 7, 'Gulnora D.', '+998 99 666 22 11', 'owner', 'Android', dt(addDays(T, -1), '09:30'), 'active'],
      [12, 8, 'Ilhom Q.', '+998 91 303 40 50', 'owner', 'Veb', dt(T, '09:12'), 'active'],
      [13, 9, 'Nilufar X.', '+998 95 616 71 81', 'owner', 'iOS', dt(addDays(T, -3), '20:05'), 'active'],
    ];
    // Demo: barcha do'kon loginlari paroli — 123456 (super admin keyin o'zgartiradi)
    const storePw = hashPassword('123456');
    for (const u of users) {
      run('INSERT INTO users(id, store_id, name, phone, role, device, last_login, status, created_at, password_hash) VALUES(?,?,?,?,?,?,?,?,?,?)',
        ...u, dt('2026-03-12'), storePw);
    }
    const pw = hashPassword('admin123');
    run("INSERT INTO users(id, name, email, password_hash, role, created_at) VALUES(100, 'Super admin', 'admin@qarzdaftar.uz', ?, 'superadmin', ?)", pw, dt('2026-01-01'));
    run("INSERT INTO users(id, name, email, password_hash, role, created_at) VALUES(101, 'Madina K.', 'madina@qarzdaftar.uz', ?, 'support', ?)", pw, dt('2026-01-01'));
    run("INSERT INTO users(id, name, email, password_hash, role, created_at) VALUES(102, 'Bobur T.', 'bobur@qarzdaftar.uz', ?, 'finance', ?)", pw, dt('2026-01-01'));

    // ---------- Baraka Savdo: mijozlar ----------
    const named = [
      [1, 'Akmal Karimov', '+998 90 123 45 67', '2026-05-14'],
      [2, 'Dilnoza Rahimova', '+998 93 456 78 90', '2026-06-02'],
      [3, 'Sardor Yusupov', '+998 97 222 33 44', '2026-06-20'],
      [4, 'Nodira Tosheva', '+998 91 765 43 21', '2026-10-16'],
      [5, 'Malika Saidova', '+998 94 333 55 66', '2026-07-08'],
      [6, 'Bekzod Ergashev', '+998 90 555 77 88', '2026-10-20'],
      [7, 'Jasur Aliyev', '+998 99 888 11 22', '2026-08-11'],
    ];
    for (const c of named) run("INSERT INTO clients(id, store_id, name, phone, kind, created_at) VALUES(?,1,?,?,'customer',?)", c[0], c[1], c[2], dt(c[3]));
    run("INSERT INTO clients(id, store_id, name, phone, kind, note, created_at) VALUES(8,1,'Ulgurji Baza','+998 71 255 44 33','supplier','Yetkazib beruvchi',?)", dt('2026-03-20'));

    // Qarzlar (dizayndagi yozuv raqamlari bilan)
    const debts = [
      [1042, 6, 'give', 2500000, '2026-10-20', '2026-11-15', '1 qop shakar, 2 yashik yog‘'],
      [1041, 4, 'give', 3500000, '2026-10-16', '2026-11-05', 'Qurilish mollari'],
      [1040, 8, 'take', 3200000, '2026-10-12', '2026-11-10', 'Ulgurji tovar partiyasi'],
      [1038, 2, 'give', 2800000, '2026-09-28', '2026-10-12', ''],
      [1036, 1, 'give', 4000000, '2026-09-20', '2026-10-25', '2 qop un, 1 yashik yog‘'],
      [1033, 5, 'give', 2100000, '2026-09-15', '2026-10-08', ''],
      [1030, 3, 'give', 1200000, '2026-09-10', '2026-11-01', ''],
      [1027, 7, 'give', 1600000, '2026-09-01', '2026-10-15', ''],
    ];
    for (const d of debts) {
      run(`INSERT INTO debts(id, store_id, client_id, direction, amount, date, due_date, note, source, created_by, created_at)
           VALUES(?,1,?,?,?,?,?,?, 'Mahsulot', 1, ?)`, d[0], d[1], d[2], d[3], d[4], d[5], d[6], dt(d[4], '12:00'));
    }
    const pays = [
      [1027, 600000, 'Karta', 2, dt(T, '14:32')],
      [1036, 1000000, 'Naqd', 1, dt('2026-10-18', '11:05')],
      [1030, 250000, 'Click', 2, dt('2026-10-14', '16:48')],
      [1033, 400000, 'Naqd', 1, dt('2026-10-12', '10:20')],
      [1038, 500000, 'Payme', 2, dt('2026-10-09', '18:11')],
      [1036, 500000, 'Karta', 1, dt('2026-10-05', '12:40')],
      [1027, 1000000, 'Naqd', 2, dt('2026-10-03', '09:55')],
      [1033, 500000, 'Click', 1, dt('2026-10-01', '15:30')],
      [1038, 500000, 'Naqd', 1, dt('2026-09-30', '17:05')],
    ];
    for (const p of pays) run('INSERT INTO payments(store_id, debt_id, amount, method, received_by, created_at) VALUES(1,?,?,?,?,?)', ...p);

    // Yopilgan eski qarzlar (may–sentabr dinamikasi uchun)
    const monthly = [
      ['2026-05', 3200000, 2100000], ['2026-06', 4100000, 2800000], ['2026-07', 3600000, 3000000],
      ['2026-08', 5000000, 3400000], ['2026-09', 0, 4600000],
    ];
    const hist = [];
    let cid = 20;
    let did = 1001;
    for (const [ym, given] of monthly) {
      let left = given;
      while (left > 0) {
        const amount = Math.min(left, round(600000 + rnd() * 900000, 100000));
        left -= amount;
        const day = String(3 + Math.floor(rnd() * 24)).padStart(2, '0');
        const name = fakeName();
        run("INSERT INTO clients(id, store_id, name, phone, kind, created_at) VALUES(?,1,?,?,'customer',?)", cid, name, fakePhone(), dt(`${ym}-${day}`, '09:30'));
        run(`INSERT INTO debts(id, store_id, client_id, direction, amount, date, due_date, source, sms_reminder, created_by, created_at)
             VALUES(?,1,?,'give',?,?,?, 'Mahsulot', 1, 1, ?)`, did, cid, amount, `${ym}-${day}`, addDays(`${ym}-${day}`, 30), dt(`${ym}-${day}`, '12:00'));
        hist.push({ id: did, left: amount });
        cid++;
        did++;
      }
    }
    // To'lovlarni eski qarzlarga navbat bilan (FIFO) taqsimlash
    for (const [ym, , collected] of monthly) {
      let left = collected;
      for (const h of hist) {
        if (left <= 0) break;
        if (h.left <= 0) continue;
        const part = Math.min(h.left, left);
        h.left -= part;
        left -= part;
        const day = String(5 + Math.floor(rnd() * 22)).padStart(2, '0');
        run('INSERT INTO payments(store_id, debt_id, amount, method, received_by, created_at) VALUES(1,?,?,?,?,?)',
          h.id, part, pick(['Naqd', 'Naqd', 'Karta', 'Click', 'Payme']), pick([1, 2]), dt(`${ym}-${day}`, `1${Math.floor(rnd() * 8)}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`));
      }
    }

    // ---------- boshqa do'konlar uchun mijoz va qarzlar ----------
    for (const s of stores.slice(1)) {
      const [sid, , , , , , , , joined, count, turnover] = s;
      const weights = Array.from({ length: count }, () => 0.3 + rnd());
      const wsum = weights.reduce((a, b) => a + b, 0);
      const span = Math.max(1, Math.round((new Date(T) - new Date(joined)) / 86400000));
      let used = 0;
      const owner = users.find((u) => u[1] === sid)?.[0] ?? null;
      for (let i = 0; i < count; i++) {
        const amount = i === count - 1 ? turnover - used : round((weights[i] / wsum) * turnover, 10000);
        used += amount;
        const date = addDays(joined, Math.floor(rnd() * span));
        const c = run("INSERT INTO clients(store_id, name, phone, kind, created_at) VALUES(?,?,?,'customer',?)", sid, fakeName(), fakePhone(), dt(date, '09:00'));
        const d = run(`INSERT INTO debts(store_id, client_id, direction, amount, date, due_date, source, created_by, created_at)
                       VALUES(?,?,'give',?,?,?, 'Mahsulot', ?, ?)`, sid, Number(c.lastInsertRowid), amount, date, addDays(date, 30), owner, dt(date, '12:00'));
        const frac = rnd();
        const paid = frac < 0.35 ? amount : frac < 0.7 ? round(amount * rnd(), 10000) : 0;
        if (paid > 0 && paid <= amount) {
          run('INSERT INTO payments(store_id, debt_id, amount, method, received_by, created_at) VALUES(?,?,?,?,?,?)',
            sid, Number(d.lastInsertRowid), paid, pick(['Naqd', 'Karta', 'Click', 'Payme']), owner, dt(addDays(date, Math.min(Math.floor(rnd() * 25), Math.max(0, Math.round((new Date(T) - new Date(date)) / 86400000)))), '15:00'));
        }
      }
    }

    // ---------- bildirishnomalar (Baraka Savdo) ----------
    const notes = [
      ['pay', "To'lov qabul qilindi", "Jasur Aliyev 600 000 so'm to'ladi. Qarz to'liq yopildi.", dt(T, '14:32'), 0, null],
      ['late', "Muddat o'tdi", 'Dilnoza Rahimova qarzi 8 kundan beri kechikmoqda.', dt(T, '09:00'), 0, `late:1038:${T}`],
      ['late', "Muddat o'tdi", 'Malika Saidova qarzi 12 kundan beri kechikmoqda.', dt(T, '09:00'), 1, `late:1033:${T}`],
      ['sms', 'Eslatma yuborildi', "2 ta mijozga SMS eslatma jo'natildi.", dt(T, '09:00'), 1, null],
      ['due', 'Muddat yaqinlashmoqda', "Akmal Karimov — 25.10 gacha 2 500 000 so'm.", dt(addDays(T, -1), '18:00'), 1, 'due:1036'],
      ['pay', "To'lov qabul qilindi", "Akmal Karimov 1 000 000 so'm to'ladi.", dt('2026-10-18', '11:05'), 1, null],
      ['late', "Muddat o'tdi", 'Malika Saidova qarzi 8 kundan beri kechikmoqda.', dt('2026-10-16', '09:00'), 1, 'late:1033:2026-10-16'],
    ];
    for (const n of notes) run('INSERT INTO notifications(store_id, type, title, text, created_at, is_read, ref) VALUES(1,?,?,?,?,?,?)', ...n);

    // ---------- SMS jurnali ----------
    // So'nggi 14 kun bo'yicha platforma statistikasi
    const raw = [[620, 18], [540, 12], [710, 25], [880, 30], [760, 22], [430, 14], [390, 10], [690, 20], [920, 34], [1010, 28], [860, 24], [940, 31], [500, 15], [1120, 36]];
    const insSms = db.prepare('INSERT INTO sms_log(store_id, phone, type, kind, status, created_at) VALUES(?,?,?,?,?,?)');
    const types = [['Muddat eslatmasi', 'before'], ['Muddat eslatmasi', 'due'], ["Muddat o'tdi", 'after'], ["To'lov tasdig'i", 'payment']];
    raw.forEach(([ok, fail], i) => {
      const day = addDays(T, i - 13);
      const isToday = i === 13;
      // Bugungi xabarlarning bir qismi pastda aniq yoziladi
      const okN = isToday ? ok - 4 : ok;
      const failN = isToday ? fail - 1 : fail;
      for (let k = 0; k < okN + failN; k++) {
        const [type, kind] = pick(types);
        // Platforma statistikasi uchun: do'kon limitlariga ta'sir qilmasligi uchun store_id bo'sh
        const hour = isToday ? 6 + Math.floor(rnd() * 2) : 8 + Math.floor(rnd() * 11);
        const time = `${String(hour).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00`;
        insSms.run(null, fakePhone(), type, kind, k < okN ? 'sent' : 'fail', `${day} ${time}`);
      }
    });
    // Baraka Savdo: bu oy yuborilgan eslatmalar (46 ta, 44 tasi yetkazilgan)
    const baraka = [[1, 1036], [3, 1030], [5, 1033], [2, 1038], [7, 1027]];
    for (let k = 0; k < 42; k++) {
      const [c, d] = baraka[k % baraka.length];
      const day = addDays('2026-10-01', k % 19);
      run("INSERT INTO sms_log(store_id, client_id, debt_id, phone, type, kind, status, created_at) VALUES(1,?,?,?,?,?,?,?)",
        c, d, named[c - 1][2], 'Muddat eslatmasi', 'before', k === 17 ? 'fail' : 'sent', dt(day, '10:00'));
    }
    const exact = [
      [1, 7, 1027, '+998 99 888 11 22', "To'lov tasdig'i", 'payment', 'sent', dt(T, '14:35')],
      [2, null, null, '+998 90 412 18 41', 'Muddat eslatmasi', 'before', 'wait', dt(T, '14:02')],
      [1, 2, 1038, '+998 93 456 78 90', "Muddat o'tdi", 'after', 'sent', dt(T, '09:00')],
      [1, 5, 1033, '+998 94 333 55 66', "Muddat o'tdi", 'after', 'fail', dt(T, '09:00')],
      [3, null, null, '+998 97 515 70 13', 'Muddat eslatmasi', 'before', 'sent', dt(T, '08:45')],
    ];
    for (const e of exact) run('INSERT INTO sms_log(store_id, client_id, debt_id, phone, type, kind, status, created_at) VALUES(?,?,?,?,?,?,?,?)', ...e);

    // ---------- obuna to'lovlari ----------
    const inv = [
      [2236, 8, 2, '2026-10-08', '2026-11-08', 'Payme', 99000, 'ok'],
      [2237, 5, 2, '2026-10-10', '2026-11-10', 'Click', 99000, 'fail'],
      [2238, 3, 3, '2026-10-16', '2026-11-16', 'Payme', 199000, 'ok'],
      [2239, 4, 2, '2026-10-18', '2026-11-18', 'Click', 99000, 'ok'],
      [2240, 2, 3, '2026-10-19', '2026-11-19', "Bank o'tkazmasi", 199000, 'wait'],
      [2241, 1, 2, '2026-10-20', '2026-11-20', 'Payme', 99000, 'ok'],
    ];
    let invId = 2200;
    for (const [sid, plan, price, start] of [[1, 2, 99000, '2026-09-20'], [2, 3, 199000, '2026-09-19'], [3, 3, 199000, '2026-09-16'], [4, 2, 99000, '2026-09-18'], [8, 2, 99000, '2026-09-08'], [9, 2, 99000, '2026-09-28'], [5, 2, 99000, '2026-09-10']]) {
      run('INSERT INTO invoices(id, store_id, plan_id, period_from, period_to, gateway, amount, status, created_at) VALUES(?,?,?,?,?,?,?,?,?)',
        invId++, sid, plan, start, addDays(start, 30), pick(['Payme', 'Click']), price, 'ok', dt(start, '10:00'));
    }
    run('INSERT INTO invoices(id, store_id, plan_id, period_from, period_to, gateway, amount, status, created_at) VALUES(?,?,?,?,?,?,?,?,?)',
      2235, 9, 2, '2026-10-28', '2026-11-28', 'Payme', 99000, 'ok', dt('2026-10-02', '10:00'));
    for (const i of inv) {
      run('INSERT INTO invoices(id, store_id, plan_id, period_from, period_to, gateway, amount, status, created_at) VALUES(?,?,?,?,?,?,?,?,?)', ...i, dt(i[3], '10:00'));
    }

    // ---------- tizim jurnali ----------
    const logs = [
      [dt(T, '14:35:12'), 'ok', "To'lovlar", "To'lov qabul qilindi: #Q-1027", 'Aziza R. · Baraka Savdo', '10.0.12.41'],
      [dt(T, '14:02:47'), 'info', 'SMS', "Eslatma navbatga qo'shildi (24 ta)", 'Tizim', '—'],
      [dt(T, '13:58:03'), 'warn', 'Auth', "3 marta noto'g'ri SMS kod kiritildi", '+998 91 *** ** 99', '10.0.31.7'],
      [dt(T, '12:05:19'), 'info', 'Auth', 'Veb orqali tizimga kirish', 'Rustam Z. · Ziyo Qurilish', '10.0.8.112'],
      [dt(T, '11:41:55'), 'err', 'Obuna', 'Click to‘lovi rad etildi: #INV-2237', 'Kamola O. · Oqtepa Savdo', '10.0.44.3'],
      [dt(T, '11:20:30'), 'ok', "Do'konlar", "Yangi do'kon ro'yxatdan o'tdi: Nur Market", 'Otabek N.', '10.0.27.65'],
      [dt(T, '10:14:08'), 'info', 'Zaxira', 'Kunlik zaxira nusxa yaratildi (1.8 GB)', 'Tizim', '—'],
      [dt(T, '10:12:40'), 'ok', 'Obuna', "Obuna to'landi: Baraka Savdo · Biznes tarif", 'Abdulvoris H. · Baraka Savdo', '10.0.12.40'],
      [dt(T, '09:00:02'), 'err', 'SMS', 'Yetkazilmadi: abonent tarmoqda emas', 'Baraka Savdo', '—'],
      [dt(T, '08:47:36'), 'warn', 'API', "So'rovlar limiti 80% ga yetdi", 'Ziyo Qurilish', '10.0.8.112'],
      [dt(T, '08:30:00'), 'info', 'Admin', 'Tarif narxi yangilandi: Premium', 'Super admin', '10.0.1.2'],
      [dt(addDays(T, -1), '11:25:00'), 'err', "Do'konlar", "Bloklandi: Oqtepa Savdo · Obuna to'lanmagan", 'Tizim', '—'],
      [dt('2026-10-18', '16:00:00'), 'ok', 'SMS', "SMS paket to'ldirildi: 10 000 ta", 'Bobur T.', '10.0.1.5'],
      [dt('2026-10-16', '10:05:00'), 'ok', "Do'konlar", "Yangi do'kon ro'yxatdan o'tdi: Dehqon Bozori #4", 'Gulnora D.', '10.0.19.8'],
    ];
    for (const l of logs) run('INSERT INTO logs(created_at, level, module, message, user_label, ip) VALUES(?,?,?,?,?,?)', ...l);

    // ---------- platforma sozlamalari ----------
    setSetting('platform_name', 'Qarz Daftar');
    setSetting('support_phone', '');
    setSetting('support_email', 'support@qarzdaftar.uz');
    setSetting('trial_days', 14);
    setSetting('session_days', 30);
    setSetting('permissions', DEFAULT_PERMS);
    setSetting('security', { twoFactor: true, ipRestrict: false, suspiciousAlert: true });
    setSetting('integrations', { payme: true, click: true, sms: true, telegram: false });
    setSetting('sms_balance', 8420);
    setSetting('sms_capacity', 20000);
    setSetting('sms_provider', 'Test rejimi (konsol)');
    setSetting('sms_sender', 'QarzDaftar');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed();
  console.log("Demo ma'lumotlar yozildi.");
}
