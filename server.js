import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { startBot } from './src/bot.js';
import { createDonationRouter } from './src/routes/donation.js';
import adminRouter from './src/routes/admin.js';
import donasiCommand from './src/handlers/donasi/donasi.js';

dotenv.config();

const app = express();

// Setup EJS dengan express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'keyboard cat', resave: false, saveUninitialized: true }));

// Keep-alive endpoint
app.get('/', (req, res) => res.send('✅ Bot is alive!'));

// Admin panel routes
app.use('/admin', adminRouter);

async function main() {
  const bot = await startBot();

  // Simpan bot instance agar bisa diakses oleh express routes
  app.locals.bot = bot;

  // Mount webhook donasi — harus sebelum app.listen
  const webhookSecret = process.env.TRAKTEER_WEBHOOK_SECRET || '';
  app.use('/donation', createDonationRouter(bot, process.env.TARGET_CHANNEL_ID, webhookSecret));
  donasiCommand(bot, process.env.TRAKTEER_URL || 'https://trakteer.id/jzxyzx/tip');

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🔗 Webhook donasi aktif di /donation/donation`);
  });
}

main().catch(err => {
  console.error('Gagal memulai server:', err);
  process.exit(1);
});
