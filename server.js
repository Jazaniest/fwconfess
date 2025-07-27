import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { startBot } from './src/bot.js';
import { supabase } from './src/supabaseClient.js';

dotenv.config();

const app = express();

// Setup EJS dengan express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'keyboard cat', resave: false, saveUninitialized: true }));

// Keep-alive endpoint
app.get('/', (req, res) => res.send('✅ Bot is alive!'));

// Redirect /admin ke /admin/users
app.get('/admin', (req, res) => res.redirect('/admin/users'));

// --- Admin Panel Routes ---
app.get('/admin/users', async (req, res) => {
  const { data: users } = await supabase.from('users').select('*');
  res.render('users', { title: 'User Management', users });
});

app.post('/admin/users/:telegram_id/suspend', async (req, res) => {
  const telegram_id = req.params.telegram_id;
  await supabase.from('users').update({ is_active: false }).eq('telegram_id', telegram_id);
  await supabase.from('admin_logs').insert([{ admin_action: 'user_suspend', target: telegram_id.toString() }]);
  res.redirect('/admin/users');
});

app.post('/admin/users/:telegram_id/activate', async (req, res) => {
  const telegram_id = req.params.telegram_id;
  await supabase.from('users').update({ is_active: true }).eq('telegram_id', telegram_id);
  await supabase.from('admin_logs').insert([{ admin_action: 'user_activate', target: telegram_id.toString() }]);
  res.redirect('/admin/users');
});

app.get('/admin/broadcast', (req, res) => res.render('broadcast', { title: 'Broadcast Message' }));
app.post('/admin/broadcast', async (req, res) => {
  const { message_text } = req.body;
  await supabase.from('broadcasts').insert([{ message_text }]);
  await supabase.from('admin_logs').insert([{ admin_action: 'broadcast_send', target: 'all' }]);
  res.redirect('/admin/broadcast');
});

app.get('/admin/statistics', async (req, res) => {
  const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact' });
  const { count: totalMessages } = await supabase.from('anonymous_messages').select('*', { count: 'exact' });
  res.render('statistics', { title: 'Statistics', totalUsers, totalMessages });
});

app.get('/admin/logs', async (req, res) => {
  const { data: logs } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false });
  res.render('logs', { title: 'Admin Logs', logs });
});

app.get('/admin/blacklist', async (req, res) => {
  const { data: words } = await supabase.from('blacklist_words').select('*');
  res.render('blacklist', { title: 'Blacklist Words', words });
});
app.post('/admin/blacklist', async (req, res) => {
  const { word } = req.body;
  await supabase.from('blacklist_words').insert([{ word }]);
  await supabase.from('admin_logs').insert([{ admin_action: 'blacklist_add', target: word }]);
  res.redirect('/admin/blacklist');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Admin panel & keep-alive server running on port ${PORT}`));

// Jalankan bot setelah Express siap
startBot().catch(err => {
  console.error('Gagal memulai bot:', err);
  process.exit(1);
});