import { Router } from 'express';
import bcrypt from 'bcrypt';
import * as UserRepo from '../repositories/user.repo.js';
import * as ConfessionRepo from '../repositories/confession.repo.js';
import * as ReportRepo from '../repositories/report.repo.js';
import * as BanRepo from '../repositories/ban.repo.js';
import * as ConfigRepo from '../repositories/config.repo.js';
import * as ChatRepo from '../repositories/chat.repo.js';
import { db } from '../services/db.js';
import { configService } from '../services/config.service.js';

const router = Router();
const PER_PAGE = 20;

// --- Navigasi ---
// (Anda bisa memindahkan ini ke partial EJS jika Anda mau)
const NAV = [
  { url: '/admin',            label: 'Dashboard',   icon: 'grid-outline' },
  { url: '/admin/users',      label: 'Users',       icon: 'people-outline' },
  // ... (item nav lainnya)
];

function activeNav(url) {
  return NAV.map(n => ({ ...n, active: n.url === url }));
}


// --- Middleware Autentikasi ---

function isAuthenticated(req, res, next) {
  if (req.session.adminAuthed) {
    res.locals.admin = { username: req.session.adminUsername };
    return next();
  }
  res.redirect('/admin/login');
}

// --- Route Login & Logout ---

router.get('/login', (req, res) => {
    if (req.session.adminAuthed) {
        return res.redirect('/admin');
    }
    res.render('login', { layout: false, error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminUsername || !adminPasswordHash) {
        console.error('FATAL: ADMIN_USERNAME or ADMIN_PASSWORD_HASH is not set.');
        return res.status(500).render('login', { layout: false, error: 'Server configuration error.' });
    }

    const isPasswordMatch = await bcrypt.compare(password, adminPasswordHash);

    if (username === adminUsername && isPasswordMatch) {
        req.session.adminAuthed = true;
        req.session.adminUsername = username;
        return res.redirect('/admin');
    }

    res.status(401).render('login', { layout: false, error: 'Invalid username or password.' });
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
});


// --- Lindungi semua route di bawah ini ---

router.use(isAuthenticated);


// --- Route yang Dilindungi ---

router.get('/', async (req, res) => {
    // ... (logika dashboard Anda)
    res.render('index', {
        nav: activeNav('/admin'),
        title: 'Dashboard',
        // ... data lainnya
    });
});

router.get('/users', async (req, res) => {
  // ... (logika user list Anda)
});

// ... (semua route admin lainnya)


export default router;
