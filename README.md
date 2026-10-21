# Qarz Daftar

Qarz daftari: do'kon uchun mobil ilova, CRM, boshqaruv paneli va platforma admin paneli.

- `Backend/` — REST API (Node.js 22.13+, Express 5, o'rnatilgan `node:sqlite`)
- `frontend/` — Next.js 16 (App Router)

## Ishga tushirish

```bash
# 1) Backend  →  http://localhost:4000/api
cd Backend
npm install
npm run dev          # birinchi ishga tushishda demo ma'lumotlar avtomatik yoziladi
# npm run seed       # bazani tozalab, demo ma'lumotlarni qayta yozish

# 2) Frontend  →  http://localhost:3000
cd frontend
npm install
npm run dev
```

## Kirish

Do'kon xodimlari faqat **super admin yaratgan** telefon raqam + parol bilan kiradi. O'zi ro'yxatdan o'tish yo'q.

| Bo'lim | Manzil | Demo login |
|---|---|---|
| Mobil ilova | `/m` | `/login`: `90 111 22 33` / `123456` (do'kon egasi) |
| Boshqaruv paneli / CRM | `/dashboard`, `/crm/...` | xuddi shu login |
| Admin panel | `/admin` | `/admin/login`: `admin@qarzdaftar.uz` / `admin123` |

Demo bazadagi barcha do'kon loginlarining paroli `123456`. Kassir sifatida sinash uchun: `93 444 55 66`.

Loginlarni super admin boshqaradi:
- **Do'konlar → Do'kon qo'shish**: egasining telefon raqami va paroli bilan birga yaratiladi.
- **Foydalanuvchilar → Login yaratish**: istalgan do'kon uchun egasi, menejer yoki kassir logini.
- **Foydalanuvchilar → (qatorni bosish)**: parolni almashtirish, bloklash yoki loginni o'chirish.

Bloklangan foydalanuvchi yoki bloklangan do'kon xodimi kira olmaydi.

## Muhit o'zgaruvchilari

Backend: `PORT` (4000), `JWT_SECRET`, `CORS_ORIGIN` (`http://localhost:3000`), `DB_PATH`, `USD_RATE` (12800), `NODE_ENV=production` (SMS kodni javobda qaytarmaydi).
Frontend: `NEXT_PUBLIC_API_URL` (`http://localhost:4000/api`).

## Eslatmalar

- SMS provayder ulanmagan: xabarlar backend konsoliga yoziladi va jurnalda "yetkazildi" deb belgilanadi. Haqiqiy provayder (Eskiz, Playmobile) `Backend/src/sms.js` dagi `sendSms` ichiga ulanadi.
- Avtomatik eslatmalar va bildirishnomalar `Backend/src/jobs.js` da har 10 daqiqada ishlaydi.
