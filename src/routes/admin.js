/**
 * Admin panel Express routes — web interface untuk manajemen.
 * Phase 6: extracted from server.js. Refactored with auth, nav, repo.
 */
import { Router } from 'express';
import { db } from '../services/db.js';
import * as UserRepo from '../repositories/user.repo.js';
import * as ConfessionRepo from '../repositories/confession.repo.js';
import * as ReportRepo from '../repositories/report.repo.js';
import * as BanRepo from '../repositories/ban.repo.js';
import * as ConfigRepo from '../repositories/config.repo.js';
import * as ChatRepo from '../repositories/chat.repo.js';
import { isAdmin } from '../middleware/admin-auth.js';
import { configService } from '../services/config.service.js';

const router = Router();
const PER_PAGE = 20;

// ─── Nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  { url: '/admin',            label: 'Dashboard',   icon: 'grid-outline' },
  { url: '/admin/users',      label: 'Users',       icon: 'people-outline' },
  { url: '/admin/confessions', label: 'Confessions', icon: 'chatbox-ellipses-outline' },
  { url: '/admin/reports',    label: 'Reports',     icon: 'shield-checkmark-outline' },
  { url: '/admin/chat',       label: 'Chat Sessions', icon: 'chatbubbles-outline' },
  { url: '/admin/donations',  label: 'Donations',   icon: 'wallet-outline' },
  { url: '/admin/statistics', label: 'Statistics',  icon: 'stats-chart-outline' },
  { url: '/admin/broadcast',  label: 'Broadcast',   icon: 'megaphone-outline' },
  { url: '/admin/blacklist',  label: 'Blacklist',   icon: 'ban-outline' },
  { url: '/admin/logs',       label: 'Logs',        icon: 'document-text-outline' },
  { url: '/admin/settings',   label: 'Settings',    icon: 'options-outline' },
];


function activeNav(url) {
  return NAV.map(n => ({ ...n, active: n.url === url }));
}

// ─── Auth middleware ───────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (req.session?.adminAuthed) {
    return next();
  }

  // Jika belum terotentikasi, tampilkan form login.
  // Pastikan ada rute POST untuk menangani form ini.
  const csrfToken = req.csrfToken();
  res.status(401).send(`
    <form method="POST" action="/admin/login" class="max-w-sm mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 class="text-xl font-bold mb-4">🔐 Admin Login</h1>
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <input name="username" type="text" class="w-full border rounded p-2 mb-3" placeholder="Username" />
      <input name="password" type="password" class="w-full border rounded p-2 mb-3" placeholder="Password" />
      <button class="w-full px-4 py-2 bg-blue-600 text-white rounded">Login</button>
    </form>
  `);
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.error('FATAL: ADMIN_USERNAME or ADMIN_PASSWORD is not set in environment variables.');
    return res.status(500).send('Server configuration error.');
  }

  if (username === adminUsername && password === adminPassword) {
    req.session.adminAuthed = true;
    return res.redirect('/admin');
  }
  res.status(401).send('Invalid username or password.');
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/', requireAdmin, async (req, res) => {
  try {
    // Terapkan pola safeQuery untuk memastikan tidak ada error render
    const [
      totalUsers,
      totalConfessions,
      recentConfessions,
      recentDonations,
    ] = await Promise.all([
      safeQuery(UserRepo.countAllUsers(), 0, 'countAllUsers-dashboard'),
      safeQuery(ConfessionRepo.getTotalConfessions(), 0, 'getTotalConfessions-dashboard'),
      safeQuery(db.query('SELECT * FROM confessions ORDER BY created_at DESC LIMIT 5').then(r => r[0]), [], 'recentConfessions-dashboard'),
      safeQuery(db.query('SELECT * FROM donations ORDER BY created_at DESC LIMIT 5').then(r => r[0]), [], 'recentDonations-dashboard'),
    ]);

    // Pastikan variabel yang dikirim ke template selalu terdefinisi
    res.render('index', {
      nav: activeNav('/admin'),
      title: 'Dashboard',
      sum: {
        totalUsers: totalUsers || 0,
        totalConfessions: totalConfessions || 0,
      },
      recentConfessions: recentConfessions || [],
      recentDonations: recentDonations || [],
    });
  } catch (error) {
    // Blok catch ini hanya untuk error tak terduga, bukan error query
    console.error('Unexpected error loading dashboard:', error);
    res.status(500).send('Gagal memuat dashboard karena kesalahan server.');
  }
});

// ─── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const offset = page * PER_PAGE;
    const [users, total] = await Promise.all([
      UserRepo.getUsersPaginated(PER_PAGE, offset),
      UserRepo.countAllUsers(),
    ]);
    res.render('users', {
      nav: activeNav('/admin/users'),
      title: 'User Management',
      users,
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Gagal memuat data users.');
  }
});

router.post('/users/:telegram_id/suspend', requireAdmin, async (req, res) => {
  try {
    const { telegram_id } = req.params;
    await UserRepo.banUser(telegram_id);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['user_suspend', telegram_id]);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).send('Gagal suspend user.');
  }
});

router.post('/users/:telegram_id/activate', requireAdmin, async (req, res) => {
  try {
    const { telegram_id } = req.params;
    await UserRepo.unbanUser(telegram_id);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['user_activate', telegram_id]);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).send('Gagal aktivasi user.');
  }
});

// ─── Confessions ───────────────────────────────────────────────────────────────

router.get('/confessions', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const offset = page * PER_PAGE;
    const [confessions, [[{ total }]]] = await Promise.all([
      db.query('SELECT * FROM confessions ORDER BY created_at DESC LIMIT ? OFFSET ?', [PER_PAGE, offset]).then(r => r[0]),
      db.query('SELECT COUNT(*) AS total FROM confessions'),
    ]);
    res.render('confessions', {
      nav: activeNav('/admin/confessions'),
      title: 'Confessions',
      confessions,
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
    });
  } catch (error) {
    console.error('Error fetching confessions:', error);
    res.status(500).send('Gagal memuat confessions.');
  }
});

// ─── Reports ───────────────────────────────────────────────────────────────────

router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const offset = page * PER_PAGE;
    const [reports, stats] = await Promise.all([
      ReportRepo.getReportsPaginated(null, PER_PAGE, offset),
      ReportRepo.getReportStats(),
    ]);
    res.render('reports', {
      nav: activeNav('/admin/reports'),
      title: 'Reports',
      reports,
      stats,
      page,
      totalPages: Math.ceil(stats.total / PER_PAGE),
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).send('Gagal memuat laporan.');
  }
});

// ─── Chat Sessions ─────────────────────────────────────────────────────────────

router.get('/chat', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const offset = page * PER_PAGE;

    const totalResult = await safeQuery(db.query('SELECT COUNT(*) AS total FROM chat_sessions'), [{ total: 0 }], 'countChatSessions');
    const total = totalResult[0]?.total || 0;
    const sessions = await safeQuery(db.query('SELECT * FROM chat_sessions ORDER BY created_at DESC LIMIT ? OFFSET ?', [PER_PAGE, offset]).then(r => r[0]), [], 'getChatSessions');

    res.render('chat', {
      nav: activeNav('/admin/chat'),
      title: 'Chat Sessions',
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).send('Gagal memuat chat sessions.');
  }
});

// ─── Donations ─────────────────────────────────────────────────────────────────

router.get('/donations', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const offset = page * PER_PAGE;

    const totalCount = await safeQuery(ConfigRepo.getTotalDonationCount(), 0, 'getTotalDonationCount');
    const rows = await safeQuery(db.query(
      'SELECT * FROM donations ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [PER_PAGE, offset]
    ).then(r => r[0]), [], 'getDonationsPaginated');

    res.render('donations', {
      nav: activeNav('/admin/donations'),
      title: 'Donations',
      donations: rows,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / PER_PAGE),
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).send('Gagal memuat donasi.');
  }
});

// ─── Statistics ────────────────────────────────────────────────────────────────

// Helper untuk menjalankan query dengan aman dan memberikan nilai default jika gagal.
async function safeQuery(promise, defaultValue = 0, name = 'Unnamed Query') {
  try {
    const result = await promise;
    // Handle kasus di mana query berhasil tapi tidak mengembalikan apa-apa
    return result === undefined || result === null ? defaultValue : result;
  } catch (error) {
    console.error(`Error in safeQuery for [${name}]:`, error.message);
    return defaultValue;
  }
}

router.get('/statistics', requireAdmin, async (req, res) => {
  try {
    // Menggunakan safeQuery untuk setiap pengambilan data.
    const [
      totalUsers, totalConfessions, bannedUsers,
      reportsCount, chatStats, totalDonations, activeDaget,
      newUsers, reportStats,
    ] = await Promise.all([
      safeQuery(UserRepo.countAllUsers(), 0, 'countAllUsers'),
      safeQuery(ConfessionRepo.getTotalConfessions(), 0, 'getTotalConfessions'),
      safeQuery(UserRepo.getBannedUsersCount(), 0, 'getBannedUsersCount'),
      safeQuery(ReportRepo.getTotalReports(), 0, 'getTotalReports'),
      safeQuery(ChatRepo.getSessionStats(), { active: 0, messages: 0 }, 'getSessionStats'),
      safeQuery(ConfigRepo.getTotalDonations(), 0, 'getTotalDonations'),
      safeQuery(db.query("SELECT COUNT(*) AS total FROM dagetan WHERE status = 'waiting'").then(r => r[0][0].total), 0, 'getActiveDaget'),
      safeQuery(UserRepo.countNewUsers(), { day1: 0 }, 'countNewUsers'),
      safeQuery(ReportRepo.getReportStats(), { pending: 0 }, 'getReportStats'),
    ]);

    // Sekarang, 'stats' dijamin memiliki semua properti yang dibutuhkan oleh EJS.
    res.render('statistics', {
      nav: activeNav('/admin/statistics'),
      title: 'Statistics',
      stats: {
        totalUsers,
        totalConfessions,
        bannedUsers,
        reportsCount,
        activeChatSessions: chatStats.active,
        totalMessages: chatStats.messages,
        totalDonations,
        activeDaget,
        newUsersToday: newUsers.day1,
        pendingReports: reportStats.pending,
      },
    });
  } catch (error) {
    // Blok catch ini sekarang hanya akan menangani error yang sangat tidak terduga,
    // bukan error dari query database.
    console.error('Unexpected error in /statistics route:', error);
    res.status(500).send('Gagal memuat statistik karena kesalahan server yang tidak terduga.');
  }
});

// ─── Broadcast ─────────────────────────────────────────────────────────────────

router.get('/broadcast', requireAdmin, async (req, res) => {
  try {
    const [lastBroadcasts] = await db.query(
      'SELECT * FROM broadcasts ORDER BY sent_at DESC LIMIT 3'
    );
    res.render('broadcast', {
      nav: activeNav('/admin/broadcast'),
      title: 'Broadcast Message',
      lastBroadcasts,
    });
  } catch (error) {
    console.error('Error loading broadcast page:', error);
    res.status(500).send('Gagal memuat halaman broadcast.');
  }
});

router.post('/broadcast/send', requireAdmin, async (req, res) => {
  try {
    const { message_text, target_type, preview } = req.body;
    if (!message_text || !message_text.trim()) {
      return res.status(400).send('Pesan tidak boleh kosong.');
    }

    // Simpan ke DB
    await db.query('INSERT INTO broadcasts (message_text) VALUES (?)', [message_text]);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['broadcast_send', target_type || 'all']);

    // If preview, send to admin first
    const adminId = process.env.ADMIN_ID;
    if (preview && adminId) {
      const bot = req.app.locals.bot;
      if (bot) {
        try {
          await bot.telegram.sendMessage(adminId, `📢 *[PREVIEW]*\n\n${message_text}`, { parse_mode: 'Markdown' });
        } catch (e) {
          console.error('Preview send error:', e.message);
        }
      }
    }

    res.redirect('/admin/broadcast');
  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).send('Gagal mengirim broadcast.');
  }
});

router.get('/broadcast/history', requireAdmin, async (req, res) => {
  try {
    const [broadcasts] = await db.query(
      'SELECT * FROM broadcasts ORDER BY sent_at DESC'
    );
    res.render('broadcast-history', {
      nav: activeNav('/admin/broadcast'),
      title: 'Broadcast History',
      broadcasts,
    });
  } catch (error) {
    console.error('Error fetching broadcast history:', error);
    res.status(500).send('Gagal memuat riwayat broadcast.');
  }
});

// ─── Logs ──────────────────────────────────────────────────────────────────────

router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const offset = page * PER_PAGE;

    const totalResult = await safeQuery(db.query('SELECT COUNT(*) AS total FROM admin_logs'), [{ total: 0 }], 'countAdminLogs');
    const total = totalResult[0]?.total || 0;
    const logs = await safeQuery(db.query('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [PER_PAGE, offset]).then(r => r[0]), [], 'getAdminLogs');

    res.render('logs', {
      nav: activeNav('/admin/logs'),
      title: 'Admin Logs',
      logs,
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).send('Gagal memuat logs.');
  }
});

// ─── Blacklist ─────────────────────────────────────────────────────────────────

router.get('/blacklist', requireAdmin, async (req, res) => {
  try {
    const [words] = await db.query('SELECT * FROM blacklist_words ORDER BY created_at DESC');
    res.render('blacklist', {
      nav: activeNav('/admin/blacklist'),
      title: 'Blacklist Words',
      words,
    });
  } catch (error) {
    console.error('Error fetching blacklist:', error);
    res.status(500).send('Gagal memuat blacklist.');
  }
});

router.post('/blacklist', requireAdmin, async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || !word.trim()) return res.redirect('/admin/blacklist');
    await db.query('INSERT INTO blacklist_words (word) VALUES (?)', [word]);
    await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['blacklist_add', word]);
    res.redirect('/admin/blacklist');
  } catch (error) {
    console.error('Error adding blacklist word:', error);
    res.status(500).send('Gagal menambah kata blacklist.');
  }
});

router.post('/blacklist/:id/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT word FROM blacklist_words WHERE id = ?', [id]);
    await db.query('DELETE FROM blacklist_words WHERE id = ?', [id]);
    if (rows[0]) {
      await db.query('INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)', ['blacklist_delete', rows[0].word]);
    }
    res.redirect('/admin/blacklist');
  } catch (error) {
    console.error('Error deleting blacklist word:', error);
    res.status(500).send('Gagal menghapus kata blacklist.');
  }
});

// ─── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings', requireAdmin, async (req, res) => {
    const keys = [
        'maintenance_mode_enabled', 'maintenance_mode_message',
        'feature_leaderboard_enabled', 'feature_achievements_enabled',
        'feature_superhit_enabled', 'feature_rank_purchase_enabled', 'feature_tagging_enabled'
    ];
    const configs = await ConfigRepo.getConfigs(keys);
    res.render('settings', {
        nav: activeNav('/admin/settings'),
        title: 'Bot Settings',
        configs
    });
});

router.post('/settings', requireAdmin, async (req, res) => {
    try {
        const { maintenance_mode_message, all_features } = req.body;

        // Update maintenance message
        await configService.set('maintenance_mode_message', maintenance_mode_message);

        // Update maintenance mode status
        const maintenanceEnabled = req.body.maintenance_mode_enabled ? '1' : '0';
        await configService.set('maintenance_mode_enabled', maintenanceEnabled);

        // Update feature flags
        if (all_features && Array.isArray(all_features)) {
            for (const key of all_features) {
                const isEnabled = req.body[key] ? '1' : '0';
                await configService.set(key, isEnabled);
            }
        }

        res.redirect('/admin/settings');
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).send('Gagal menyimpan pengaturan.');
    }
});

export default router;
