# 🤖 FWB Confess Bot

Bot Telegram multifungsi untuk mengirim *anonymous confession* (menfess) yang dilengkapi dengan berbagai fitur interaktif seperti sistem chat, rank, ekonomi, dan gamifikasi.

---

## 📋 Daftar Isi

- [Fitur](#-fitur)
- [Struktur Proyek](#-struktur-proyek)
- [Prasyarat](#-prasyarat)
- [Instalasi](#-instalasi)
- [Konfigurasi Environment](#-konfigurasi-environment)
- [Struktur Database](#-struktur-database)
- [Menjalankan Bot](#-menjalankan-bot)
- [Perintah Bot](#-perintah-bot)

---

## ✨ Fitur

| Fitur | Deskripsi |
|---|---|
| 📣 **Anonymous Confession** | Kirim menfess secara anonim. Identitas pengirim (gender, rank) dapat ditampilkan secara selektif. |
| 💬 **Anonymous Chat** | Pengguna dapat memulai obrolan anonim 1-lawan-1 dengan pembuat menfess melalui tombol "Hit Me". |
| 👑 **Sistem Rank & Subscription** | Sistem rank berbasis pencapaian atau langganan berbayar yang memberikan keuntungan. |
| 💰 **Ekonomi (Koin)** | Mata uang virtual (koin) yang dapat digunakan untuk fitur premium seperti "Super Hit". |
| 🏆 **Leaderboard** | Papan peringkat mingguan untuk berbagai aktivitas seperti jumlah menfess dan donasi. |
| 🎮 **Gamifikasi** | Sistem *achievement* yang memberikan penghargaan kepada pengguna atas pencapaian tertentu. |
| 👥 **Sistem  referral** | Dapatkan hadiah dengan mengundang teman untuk bergabung. |
| 👁️ **Show Me & Reveal** | Fitur untuk meminta pengungkapan identitas dengan persetujuan kedua belah pihak. |
| ✍️ **Sistem Komentar** | Terintegrasi dengan grup diskusi Telegram untuk memungkinkan komentar pada setiap menfess. |
| 🛡️ **Moderasi** | Fitur report, ban/unban, dan blacklist kata untuk menjaga kualitas konten. |
| ⚙️ **Admin Panel** | Panel admin via perintah Telegram untuk mengelola pengguna, siaran, dan statistik. |

---

## 📁 Struktur Proyek

```
.
├── server.js               # Entry point utama aplikasi (Express + Bot)
├── .env.example            # Contoh file konfigurasi environment
├── package.json
└── src/
    ├── bot.js              # Inisialisasi Telegraf, registrasi middleware dan command
    ├── commands/           # Definisi perintah bot (/start, /profile, dll.)
    ├── handlers/           # Logika bisnis untuk fitur kompleks (chat, menfess, dll.)
    ├── middleware/         # Middleware untuk Telegraf (auth, ban, membership)
    ├── repositories/       # Abstraksi query database (semua logika SQL ada di sini)
    ├── services/           # Layanan pendukung (koneksi DB, manajemen config)
    ├── jobs/               # Tugas terjadwal (cron jobs)
    ├── routes/             # Rute untuk web server (jika ada, misal: webhook)
    └── utils/              # Fungsi utilitas (formatter, dll.)
```

---

## 🛠 Prasyarat

- **Node.js** v18 atau lebih baru
- **MySQL** 8.0+ atau MariaDB 10.5+
- **Akun Telegram** dengan bot yang sudah dibuat via [@BotFather](https://t.me/BotFather)
- Channel Telegram publik sebagai tujuan publish menfess.
- Grup diskusi Telegram (opsional, untuk fitur komentar).

---

## 🚀 Instalasi

1.  **Clone repositori**
    ```bash
    git clone <url-repo>
    cd <nama-folder>
    ```

2.  **Install dependensi**
    ```bash
    npm install
    ```

3.  **Setup Database**
    Buat database MySQL, contoh: `menfess_bot`.

4.  **Buat file `.env`**
    Salin `.env.example` menjadi `.env` dan isi semua variabel yang diperlukan.
    ```bash
    cp .env.example .env
    ```

5.  **Jalankan Migrasi Database**
    Eksekusi semua file `.sql` di dalam folder `migrations` atau jalankan SQL dari [Struktur Database](#-struktur-database) di bawah ini pada *database client* Anda.

6.  **Jalankan bot**
    ```bash
    npm start
    ```

---

## ⚙️ Konfigurasi Environment

Isi file `.env` dengan konfigurasi berikut:

```env
# ── Telegram Bot ─────────────────────────────────────────
BOT_TOKEN=...
ADMIN_ID=...

# Channel tujuan publish confession (contoh: -1001234567890)
TARGET_CHANNEL_ID=...

# Grup diskusi untuk fitur komentar (opsional)
DISCUSSION_GROUP_ID=...

# ── Database MySQL ────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=menfess_bot

# ── Konfigurasi Lainnya ───────────────────────────────────
# URL Trakteer (jika menggunakan fitur donasi)
TRAKTEER_URL=...
```

---

## 🗄️ Struktur Database

Berikut adalah skema lengkap untuk semua tabel yang digunakan dalam proyek.

<details>
<summary><strong>Klik untuk melihat skema CREATE TABLE</strong></summary>

\`\`\`sql
--
-- Tabel: achievements
--
CREATE TABLE \`achievements\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`title\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`description\` text COLLATE utf8mb4_unicode_ci,
  \`icon\` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`name\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: action_rate_limits
--
CREATE TABLE \`action_rate_limits\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`telegram_id\` bigint NOT NULL,
  \`action_type\` enum('confess','hitme','showme') COLLATE utf8mb4_unicode_ci NOT NULL,
  \`sent_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_user_action_time\` (\`telegram_id\`,\`action_type\`,\`sent_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: ad_view_history
--
CREATE TABLE \`ad_view_history\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint NOT NULL,
  \`viewed_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`user_id_viewed_at_idx\` (\`user_id\`,\`viewed_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: ad_view_tokens
--
CREATE TABLE \`ad_view_tokens\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`token\` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`user_id\` bigint NOT NULL,
  \`status\` enum('pending','claimed','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\` timestamp NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`token_UNIQUE\` (\`token\`),
  KEY \`user_id_idx\` (\`user_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: admin_logs
--
CREATE TABLE \`admin_logs\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`admin_action\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`target\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`note\` text COLLATE utf8mb4_unicode_ci,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_admin_action\` (\`admin_action\`),
  KEY \`idx_created_at\` (\`created_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: anonymous_chats
--
CREATE TABLE \`anonymous_chats\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`confession_id\` bigint unsigned NOT NULL,
  \`confessor_id\` bigint NOT NULL,
  \`hitter_id\` bigint NOT NULL,
  \`status\` enum('active','ended','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  \`ended_at\` timestamp NULL DEFAULT NULL,
  \`last_message_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`confession_id\` (\`confession_id\`),
  KEY \`confessor_id\` (\`confessor_id\`,\`status\`),
  KEY \`hitter_id\` (\`hitter_id\`,\`status\`),
  CONSTRAINT \`anonymous_chats_ibfk_1\` FOREIGN KEY (\`confession_id\`) REFERENCES \`confessions\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: bot_config
--
CREATE TABLE \`bot_config\` (
  \`key\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`value\` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: coin_transactions
--
CREATE TABLE \`coin_transactions\` (
  \`id\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`user_id\` bigint NOT NULL,
  \`type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`amount\` decimal(10,2) DEFAULT NULL,
  \`description\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`user_id\` (\`user_id\`),
  CONSTRAINT \`coin_transactions_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`telegram_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: confessions
--
CREATE TABLE \`confessions\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`telegram_id\` bigint NOT NULL,
  \`message_text\` text COLLATE utf8mb4_unicode_ci NOT NULL,
  \`channel_message_id\` bigint DEFAULT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`tags\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`status\` enum('pending','published','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  PRIMARY KEY (\`id\`),
  KEY \`idx_telegram_id\` (\`telegram_id\`),
  KEY \`idx_channel_message_id\` (\`channel_message_id\`),
  CONSTRAINT \`fk_confessions_user\` FOREIGN KEY (\`telegram_id\`) REFERENCES \`users\` (\`telegram_id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: hitme_requests
--
CREATE TABLE \`hitme_requests\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`confession_author_id\` bigint NOT NULL,
  \`hitter_id\` bigint NOT NULL,
  \`confession_id\` bigint unsigned NOT NULL,
  \`status\` enum('pending','approved','declined','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  \`is_super_hit\` tinyint(1) NOT NULL DEFAULT '0',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`confession_author_id\` (\`confession_author_id\`,\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: leaderboards
--
CREATE TABLE \`leaderboards\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint NOT NULL,
  \`type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`score\` int DEFAULT '0',
  \`week_of_year\` int NOT NULL,
  \`year\` int NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`user_leaderboard_unique\` (\`user_id\`,\`type\`,\`week_of_year\`,\`year\`),
  CONSTRAINT \`leaderboards_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`telegram_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: ranks
--
CREATE TABLE \`ranks\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`type\` enum('permanent','subscription') COLLATE utf8mb4_unicode_ci NOT NULL,
  \`duration_days\` int DEFAULT NULL,
  \`price_coins\` int NOT NULL DEFAULT '0',
  \`price_currency\` decimal(10,2) NOT NULL DEFAULT '0.00',
  \`confession_limit\` int NOT NULL DEFAULT '5',
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`),
  UNIQUE KEY \`name\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: reports
--
CREATE TABLE \`reports\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`reporter_id\` bigint NOT NULL,
  \`target_message_id\` int NOT NULL,
  \`reason\` text COLLATE utf8mb4_unicode_ci NOT NULL,
  \`status\` enum('pending','handled','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`fk_reports_reporter\` (\`reporter_id\`),
  CONSTRAINT \`fk_reports_reporter\` FOREIGN KEY (\`reporter_id\`) REFERENCES \`users\` (\`telegram_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: user_achievements
--
CREATE TABLE \`user_achievements\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint NOT NULL,
  \`achievement_id\` int NOT NULL,
  \`unlocked_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`user_achievement_unique\` (\`user_id\`,\`achievement_id\`),
  KEY \`achievement_id\` (\`achievement_id\`),
  CONSTRAINT \`user_achievements_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`telegram_id\`) ON DELETE CASCADE,
  CONSTRAINT \`user_achievements_ibfk_2\` FOREIGN KEY (\`achievement_id\`) REFERENCES \`achievements\` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: user_bans
--
CREATE TABLE \`user_bans\` (
  \`id\` int unsigned NOT NULL AUTO_INCREMENT,
  \`telegram_id\` bigint NOT NULL,
  \`ban_type\` enum('permanent','temporary') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'permanent',
  \`reason\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`banned_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\` datetime DEFAULT NULL,
  \`banned_by\` bigint NOT NULL,
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`unbanned_at\` datetime DEFAULT NULL,
  \`unbanned_by\` bigint DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_telegram_id\` (`telegram_id`),
  KEY \`idx_active_expires\` (\`is_active\`,\`expires_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: user_wallets
--
CREATE TABLE \`user_wallets\` (
  \`user_id\` bigint NOT NULL,
  \`balance\` decimal(10,2) DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`user_id\`),
  CONSTRAINT \`user_wallets_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`telegram_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel: users
--
CREATE TABLE \`users\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`telegram_id\` bigint NOT NULL,
  \`username\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`hide_username\` tinyint(1) NOT NULL DEFAULT '0',
  \`hide_gender\` tinyint(1) NOT NULL DEFAULT '0',
  \`hide_origin\` tinyint(1) NOT NULL DEFAULT '0',
  \`gender\` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`origin\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`free_menfess_balance\` int NOT NULL DEFAULT '0',
  \`referrer_id\` bigint DEFAULT NULL,
  \`is_cofounder\` tinyint(1) NOT NULL DEFAULT '0',
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
  \`registered_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`rank_id\` bigint unsigned DEFAULT NULL,
  \`rank_expires_at\` timestamp NULL DEFAULT NULL,
  \`confession_count\` int NOT NULL DEFAULT '0',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_telegram_id\` (\`telegram_id\`),
  KEY \`idx_is_active\` (\`is_active\`),
  KEY \`idx_referrer_id\` (\`referrer_id\`),
  KEY \`fk_users_rank\` (\`rank_id\`),
  CONSTRAINT \`fk_users_rank\` FOREIGN KEY (\`rank_id\`) REFERENCES \`ranks\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

</details>

---

## ▶️ Menjalankan Bot

**Mode development (dengan auto-restart):**
\`\`\`bash
npm run dev
\`\`\`

**Mode production:**
\`\`\`bash
npm start
\`\`\`

---

## 🤖 Perintah Bot

### Perintah Utama
- \`/start\` - Tampilkan menu utama.
- \`/menfess\` - Mulai proses pengiriman menfess.
- \`/profile\` - Lihat profil, rank, dan statistik Anda.
- \`/leaderboard\` - Tampilkan papan peringkat mingguan.
- \`/rank\` - Lihat dan beli rank.
- \`/donasi\` - Tampilkan informasi untuk donasi.
- \`/tontoniklan\` - Tonton iklan untuk mendapatkan menfess gratis.

### Perintah dalam Chat
- \`/endchat\` - Mengakhiri sesi obrolan anonim.

*(Catatan: daftar perintah admin dapat dilihat oleh admin melalui menu bantuan khusus admin)*.
