import express from 'express';
import cors from 'cors';
import { isEmpty } from './db.js';
import { seed } from './seed.js';
import { runJobs } from './jobs.js';
import authRoutes from './routes/auth.js';
import storeRoutes from './routes/store.js';
import adminRoutes from './routes/admin.js';

if (isEmpty()) {
  seed();
  console.log('Bazaga demo ma\'lumotlar yozildi');
}

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim());

app.set('trust proxy', true);
app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Serverless muhitda setInterval ishlamaydi: eslatmalar so'rovlar orasida ko'pi bilan 10 daqiqada bir bajariladi
const JOBS_EVERY = 10 * 60 * 1000;
let lastJobs = 0;
if (process.env.VERCEL) {
  app.use((_req, _res, next) => {
    if (Date.now() - lastJobs > JOBS_EVERY) {
      lastJobs = Date.now();
      try {
        runJobs();
      } catch (err) {
        console.error(err);
      }
    }
    next();
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', storeRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Topilmadi' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Serverda xatolik yuz berdi' : err.message });
});

if (!process.env.VERCEL) {
  runJobs();
  setInterval(runJobs, JOBS_EVERY);

  app.listen(PORT, () => {
    console.log(`Qarz Daftar API: http://localhost:${PORT}/api`);
  });
}

export default app;
