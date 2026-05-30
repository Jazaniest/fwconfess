import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { startBot } from './src/bot.js';
import { db } from './src/services/db.js';
import { createDonationRouter } from './src/routes/donation.js';
import donasiCommand from './src/commands/donasi.js';

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

// Redirect /admin ke /admin/users
app.get('/admin', (req, res) => res.redirect('/admin/users'));

// --- Admin Panel Routes ---

app.get('/admin/users', async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users');
    res.render('users', { title: 'User Management', users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Gagal memuat data users.');
  }
});

app.post('/admin/users/:telegram_id/suspend', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    await db.query(
      'UPDATE users SET is_active = 0 WHERE telegram_id = ?',
      [telegram_id]
    );
    await db.query(
      'INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)',
      ['user_suspend', telegram_id]
    );
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).send('Gagal suspend user.');
  }
});

app.post('/admin/users/:telegram_id/activate', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    await db.query(
      'UPDATE users SET is_active = 1 WHERE telegram_id = ?',
      [telegram_id]
    );
    await db.query(
      'INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)',
      ['user_activate', telegram_id]
    );
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).send('Gagal aktivasi user.');
  }
});

app.get('/admin/broadcast', (req, res) => {
  res.render('broadcast', { title: 'Broadcast Message' });
});

app.post('/admin/broadcast', async (req, res) => {
  try {
    const { message_text } = req.body;
    await db.query(
      'INSERT INTO broadcasts (message_text) VALUES (?)',
      [message_text]
    );
    await db.query(
      'INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)',
      ['broadcast_send', 'all']
    );
    res.redirect('/admin/broadcast');
  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).send('Gagal mengirim broadcast.');
  }
});

app.get('/admin/statistics', async (req, res) => {
  try {
    const [[{ totalUsers }]] = await db.query(
      'SELECT COUNT(*) AS totalUsers FROM users'
    );
    const [[{ totalMessages }]] = await db.query(
      'SELECT COUNT(*) AS totalMessages FROM anonymous_messages'
    );
    res.render('statistics', { title: 'Statistics', totalUsers, totalMessages });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).send('Gagal memuat statistik.');
  }
});

app.get('/admin/logs', async (req, res) => {
  try {
    const [logs] = await db.query(
      'SELECT * FROM admin_logs ORDER BY created_at DESC'
    );
    res.render('logs', { title: 'Admin Logs', logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).send('Gagal memuat logs.');
  }
});

app.get('/admin/blacklist', async (req, res) => {
  try {
    const [words] = await db.query('SELECT * FROM blacklist_words');
    res.render('blacklist', { title: 'Blacklist Words', words });
  } catch (error) {
    console.error('Error fetching blacklist:', error);
    res.status(500).send('Gagal memuat blacklist.');
  }
});

app.post('/admin/blacklist', async (req, res) => {
  try {
    const { word } = req.body;
    await db.query(
      'INSERT INTO blacklist_words (word) VALUES (?)',
      [word]
    );
    await db.query(
      'INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)',
      ['blacklist_add', word]
    );
    res.redirect('/admin/blacklist');
  } catch (error) {
    console.error('Error adding blacklist word:', error);
    res.status(500).send('Gagal menambah kata blacklist.');
  }
});

async function main() {
  const bot = await startBot();

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