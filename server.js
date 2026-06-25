import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { startBot } from './src/bot.js';
import { createPaymentRouter } from './src/routes/payment.js';
import adminRouter from './src/routes/admin.js';
import donasiCommand from './src/handlers/donasi/donasi.js';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';

dotenv.config();

// Ekspor app agar bisa diimpor oleh file tes
export const app = express();

// Setup EJS dengan express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'test-secret', resave: false, saveUninitialized: true }));
app.use(cookieParser());

// Keep-alive endpoint
app.get('/', (req, res) => res.send('✅ Bot is alive!'));

// CSRF protection setup
const csrfProtection = csrf({ cookie: true });

app.use((req, res, next) => {
  if (req.path.startsWith('/payment')) { // Disesuaikan dengan router pembayaran baru
    return next();
  }
  csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});

// Admin panel routes
app.use('/admin', adminRouter);

// Error handler untuk CSRF
app.use((err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  res.status(403).send('form tampered with');
});

export async function main() {
  const bot = await startBot();
  app.locals.bot = bot;

  const webhookSecret = process.env.TRAKTEER_WEBHOOK_SECRET || '';
  app.use('/payment', createPaymentRouter(bot, webhookSecret));
  donasiCommand(bot, process.env.TRAKTEER_URL || 'https://trakteer.id/jzxyzx/tip');

  // Hanya jalankan server jika tidak dalam mode tes
  if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`🔗 Webhook pembayaran aktif di /payment/webhook`);
    });
  }
}

// Cek apakah file ini dijalankan langsung oleh Node
// Ini mencegah server berjalan otomatis saat di-impor oleh file tes
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  main().catch(err => {
    console.error('Gagal memulai server:', err);
    process.exit(1);
  });
}
