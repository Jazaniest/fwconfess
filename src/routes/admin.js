/**
 * Admin panel Express routes — web interface untuk manajemen.
 * Extracted from server.js (Phase 6).
 */
import { Router } from 'express';
import { db } from '../services/db.js';

const router = Router();

// ─── Dashboard / redirect ───────────────────────────────────────────────────

router.get('/', (req, res) => res.redirect('/admin/users'));

// ─── Users ──────────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users');
    res.render('users', { title: 'User Management', users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Gagal memuat data users.');
  }
});

router.post('/users/:telegram_id/suspend', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    await db.query('UPDATE users SET is_active = 0 WHERE telegram_id = ?', [telegram_id]);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['user_suspend', telegram_id]);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).send('Gagal suspend user.');
  }
});

router.post('/users/:telegram_id/activate', async (req, res) => {
  try {
    const { telegram_id } = req.params;
    await db.query('UPDATE users SET is_active = 1 WHERE telegram_id = ?', [telegram_id]);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['user_activate', telegram_id]);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).send('Gagal aktivasi user.');
  }
});

// ─── Broadcast ──────────────────────────────────────────────────────────────

router.get('/broadcast', (req, res) => {
  res.render('broadcast', { title: 'Broadcast Message' });
});

router.post('/broadcast', async (req, res) => {
  try {
    const { message_text } = req.body;
    await db.query('INSERT INTO broadcasts (message_text) VALUES (?)', [message_text]);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['broadcast_send', 'all']);
    res.redirect('/admin/broadcast');
  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).send('Gagal mengirim broadcast.');
  }
});

// ─── Statistics ─────────────────────────────────────────────────────────────

router.get('/statistics', async (req, res) => {
  try {
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ totalMessages }]] = await db.query('SELECT COUNT(*) AS totalMessages FROM anonymous_messages');
    res.render('statistics', { title: 'Statistics', totalUsers, totalMessages });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).send('Gagal memuat statistik.');
  }
});

// ─── Logs ───────────────────────────────────────────────────────────────────

router.get('/logs', async (req, res) => {
  try {
    const [logs] = await db.query('SELECT * FROM admin_logs ORDER BY created_at DESC');
    res.render('logs', { title: 'Admin Logs', logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).send('Gagal memuat logs.');
  }
});

// ─── Blacklist ──────────────────────────────────────────────────────────────

router.get('/blacklist', async (req, res) => {
  try {
    const [words] = await db.query('SELECT * FROM blacklist_words');
    res.render('blacklist', { title: 'Blacklist Words', words });
  } catch (error) {
    console.error('Error fetching blacklist:', error);
    res.status(500).send('Gagal memuat blacklist.');
  }
});

router.post('/blacklist', async (req, res) => {
  try {
    const { word } = req.body;
    await db.query('INSERT INTO blacklist_words (word) VALUES (?)', [word]);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['blacklist_add', word]);
    res.redirect('/admin/blacklist');
  } catch (error) {
    console.error('Error adding blacklist word:', error);
    res.status(500).send('Gagal menambah kata blacklist.');
  }
});

export default router;
