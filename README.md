# AutoServis CRM

Avtoservis uchun boshqaruv tizimi: buyurtmalar (zakaz-naryad), mijozlar va avtomobillar, navbat va onlayn yozilish, ombor (ehtiyot qismlar), to'lovlar, SMS xabarnomalar va hisobotlar.

**Texnologiyalar:** Python 3.12+ · FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL · React 19 · Ant Design 6 · React Query · Recharts

## Imkoniyatlar

| Bo'lim | Nima qiladi |
|---|---|
| **Buyurtmalar** | Zakaz-naryad ochish, xizmat va ehtiyot qismlar qo'shish, usta biriktirish, chegirma, statuslar (Yangi → Jarayonda → Zapchast kutilmoqda → Tayyor → Topshirildi), chop etish (A4) |
| **To'lovlar** | Naqd, karta, o'tkazma, Click, Payme; qisman to'lov va qarzdorlik nazorati |
| **Navbat** | Kunlik jadval, postlar (ko'targichlar) soni bo'yicha bo'sh vaqtlar, "Keldi → buyurtma" (mijoz va mashina avtomatik yaratiladi) |
| **Onlayn yozilish** | `/booking` — mijozlar uchun ochiq sahifa; administrator tasdiqlagach SMS boradi |
| **Mijozlar** | Mijoz kartasi, avtomobillari, tashriflar tarixi, jami to'lovlar va qarz |
| **Ombor** | Qoldiqlar, kirim, inventarizatsiya, kam qolganlar ogohlantirishi, kirim-chiqim tarixi. Buyurtmaga qo'shilgan qism ombordan avtomatik yechiladi, bekor qilinsa qaytadi |
| **SMS** | Navbat tasdig'i, "mashina tayyor", keyingi xizmat eslatmasi (masalan, moy almashtirish: 6 oy / 8000 km), ommaviy SMS. Eskiz.uz orqali |
| **Hisobotlar** | Tushum, kassaga tushgan pul, o'rtacha chek, yalpi va sof foyda, ustalar ish haqi (foizda), xizmatlar va zapchastlar statistikasi, **Excel eksport** |
| **Xarajatlar** | Ijara, kommunal, ish haqi va h.k. — sof foyda hisobiga kiradi |
| **Xodimlar** | Rollar: Rahbar (admin), Administrator, Usta |

### Rollar

| | Rahbar | Administrator | Usta |
|---|:-:|:-:|:-:|
| Buyurtmalarni ko'rish, statusni o'zgartirish | ✅ | ✅ | ✅ (yopish/bekor qilishdan tashqari) |
| Buyurtma ochish, xizmat/zapchast/to'lov qo'shish | ✅ | ✅ | — |
| Mijozlar, ombor, xizmatlar katalogini tahrirlash | ✅ | ✅ | — |
| Hisobotlar, xarajatlar, SMS tarixi | ✅ | ✅ | — |
| Xodimlar, sozlamalar, ommaviy SMS, to'lovni o'chirish | ✅ | — | — |

## Kompyuterda ishga tushirish (ishlab chiqish)

**Backend** (`backend/` papkasida):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # kerak bo'lsa DATABASE_URL ni PostgreSQL'ga o'zgartiring
.venv/bin/alembic upgrade head  # jadvallarni yaratadi
.venv/bin/python seed.py --demo # admin + xizmatlar katalogi + namunaviy ma'lumotlar
.venv/bin/uvicorn app.main:app --reload
```

API hujjatlari: http://localhost:8000/docs

**Frontend** (`frontend/` papkasida):

```bash
npm install
npm run dev
```

Brauzerda: http://localhost:5173 — onlayn yozilish sahifasi: http://localhost:5173/booking

**Demo loginlar** (`seed.py --demo` yaratadi): `admin` / `admin123` (rahbar), `dilnoza` / `admin123` (administrator), `rustam` va `jasur` / `usta123` (ustalar).
Haqiqiy ishga tushirishda `--demo` ishlatmang va admin parolini darhol almashtiring.

**Testlar:**

```bash
cd backend && .venv/bin/pytest
# PostgreSQL'da: TEST_DATABASE_URL=postgresql+psycopg:///autoservis_test .venv/bin/pytest
```

## Serverga joylash (Docker)

```bash
cp .env.example .env   # POSTGRES_PASSWORD, SECRET_KEY, ADMIN_PASSWORD ni to'ldiring
docker compose up -d --build
```

Tizim 80-portda ochiladi. Birinchi ishga tushirishda `admin` foydalanuvchisi `ADMIN_PASSWORD` paroli bilan yaratiladi va xizmatlar katalogi to'ldiriladi.
Domen va HTTPS uchun oldiga Caddy yoki Nginx + Let's Encrypt qo'ying hamda `.env` dagi `PUBLIC_URL` ni domeningizga o'zgartiring.

**Zaxira nusxa (backup)** — har kuni cron orqali:

```bash
docker compose exec -T db pg_dump -U autoservis autoservis | gzip > backup_$(date +%F).sql.gz
```

## SMS (Eskiz.uz)

1. [eskiz.uz](https://eskiz.uz) da ro'yxatdan o'ting va balansni to'ldiring.
2. `.env` da: `SMS_PROVIDER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` (test uchun `4546`, keyin o'z nomingiz).
3. **Muhim:** Eskiz har bir SMS matnini oldindan moderatsiya qiladi. *Sozlamalar → SMS shablonlari* dagi matnlarni Eskiz kabinetida tasdiqlatib oling.

`SMS_PROVIDER=console` bo'lsa SMS yuborilmaydi, faqat server logiga yoziladi (sinov uchun).
Eslatma SMS'lari ish vaqtida (09:00–20:00) har soatda avtomatik tekshiriladi; *SMS → Eslatmalar → Hozir yuborish* tugmasi bilan qo'lda ham yuborish mumkin.

## Loyiha tuzilmasi

```
backend/
  app/
    models.py          # ma'lumotlar bazasi jadvallari
    schemas/           # API kirish/chiqish sxemalari (Pydantic)
    routers/           # API endpointlar
    services/          # biznes-logika: buyurtmalar, SMS, eslatmalar, sozlamalar
  alembic/             # migratsiyalar
  seed.py              # boshlang'ich ma'lumotlar
  tests/
frontend/
  src/
    pages/             # sahifalar
    components/        # umumiy komponentlar
    api.js, auth.jsx, utils.js
docker-compose.yml
```

Model o'zgarsa yangi migratsiya: `.venv/bin/alembic revision --autogenerate -m "tavsif"` → `.venv/bin/alembic upgrade head`.

## Keyingi qadamlar

- **Mobil ilova** — mavjud API'dan foydalanadi (React Native / Expo): ustalar uchun buyurtmalar va statuslar, mijozlar uchun yozilish.
- Telegram bot orqali yozilish va xabarnomalar.
- Payme / Click onlayn to'lov integratsiyasi.
