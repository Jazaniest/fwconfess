# 🤖 FWB Confess Bot

Bot Telegram untuk mengirim *anonymous confession* (menfess) dengan fitur anonymous chat, sistem Hit Me, Show Me, dan komentar terintegrasi.

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
- [Alur Kerja Fitur](#-alur-kerja-fitur)
- [Admin Panel Web](#-admin-panel-web)
- [Catatan Penting](#-catatan-penting)

---

## ✨ Fitur

| Fitur | Deskripsi |
|---|---|
| 📣 **Anonymous Confession** | Kirim menfess secara anonim dengan tag `#fwconfess`, ditampilkan beserta gender dan rank |
| 💝 **Hit Me** | User lain bisa request chat anonymous dengan pembuat menfess |
| 👁️ **Show Me** | Request melihat identitas (username) pembuat menfess dengan persetujuan |
| 🎭 **Reveal Identity** | Di dalam anonymous chat, kedua pihak bisa saling request reveal identitas |
| 💬 **Sistem Komentar** | Confession diteruskan ke grup diskusi sehingga bisa dikomentari |
| ⏰ **Rate Limit** | Pembatasan 1 confession per 8 jam per user |
| 👑 **Admin Panel** | Panel admin via Telegram dan antarmuka web berbasis Express + EJS |
| 📊 **Statistik** | Data pengguna, confession, laporan, dan sesi chat |
| 🚫 **Ban/Unban** | Admin bisa suspend atau mengaktifkan kembali akun user |

---

## 📁 Struktur Proyek

```
├── server.js                   # Entry point: Express server + jalankan bot
├── .env                        # Environment variables (buat sendiri)
├── views/                      # Template EJS untuk admin panel web
│   └── layout.ejs
└── src/
    ├── bot.js                  # Inisialisasi Telegraf, routing pesan
    ├── commands/
    │   ├── admin.js            # Handler admin panel Telegram
    │   ├── chat-manager.js     # Manajemen sesi anonymous chat
    │   ├── comment.js          # Sistem komentar via grup diskusi
    │   ├── confess.js          # Logika kirim & publish menfess
    │   ├── database.js         # Helper query database (static class)
    │   ├── hitme.js            # Handler tombol Hit Me & admin chat
    │   ├── profile.js          # Tampilkan & edit profil user
    │   ├── register.js         # Registrasi user baru
    │   ├── report.js           # (Placeholder) Sistem laporan
    │   ├── request-manager.js  # Manajemen request Hit Me (approve/decline)
    │   ├── reveal-manager.js   # Manajemen reveal identitas
    │   ├── showme.js           # Handler fitur Show Me
    │   └── start.js            # Menu utama, cek keanggotaan, admin detect
    └── services/
        └── db.js               # Koneksi MySQL pool
```

---

## 🛠 Prasyarat

- **Node.js** v18 atau lebih baru
- **MySQL** 5.7 / 8.0 atau MariaDB 10.x
- **Akun Telegram** dengan bot yang sudah dibuat via [@BotFather](https://t.me/BotFather)
- Channel Telegram sebagai tujuan publish confession
- Grup diskusi Telegram untuk fitur komentar (opsional)

---

## 🚀 Instalasi

**1. Clone repositori**
```bash
git clone <url-repo>
cd fwb-confess-bot
```

**2. Install dependensi**
```bash
npm install
```

**3. Buat file `.env`** (lihat bagian [Konfigurasi Environment](#-konfigurasi-environment))

**4. Buat tabel database** (lihat bagian [Struktur Database](#-struktur-database))

**5. Jalankan bot**
```bash
node server.js
```

---

## ⚙️ Konfigurasi Environment

Buat file `.env` di root proyek dengan isi berikut:

```env
# ── Telegram Bot ─────────────────────────────────────────
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
ADMIN_ID=123456789

# Channel tujuan publish confession (gunakan ID numerik, contoh: -1001234567890)
TARGET_CHANNEL_ID=-1001234567890

# Grup diskusi untuk fitur komentar (opsional, isi jika ingin aktifkan komentar)
DISCUSSION_GROUP_ID=-1009876543210

# ── Database MySQL ────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_kamu
DB_NAME=fwb_confess

# ── Express Server ────────────────────────────────────────
PORT=3000
SESSION_SECRET=ganti_dengan_string_acak_yang_panjang
```

> **Cara mendapatkan ID channel/grup:** Forward pesan dari channel/grup ke [@userinfobot](https://t.me/userinfobot) atau gunakan [@getidsbot](https://t.me/getidsbot).

---

## 🗄️ Struktur Database

Jalankan SQL berikut untuk membuat semua tabel yang dibutuhkan:

```sql
CREATE DATABASE IF NOT EXISTS fwb_confess CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fwb_confess;

-- Tabel users
CREATE TABLE `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `telegram_id`   BIGINT NOT NULL UNIQUE,
  `gender`        VARCHAR(20),
  `origin`        VARCHAR(100),
  `rank`          VARCHAR(20) DEFAULT 'bronze',
  `is_active`     TINYINT(1) DEFAULT 1,
  `registered_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel confessions
CREATE TABLE `confessions` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `telegram_id`        BIGINT NOT NULL,
  `message_text`       TEXT NOT NULL,
  `channel_message_id` BIGINT,
  `created_at`         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel chat_sessions (anonymous chat)
CREATE TABLE `chat_sessions` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `confession_id` INT NOT NULL,
  `confessor_id`  BIGINT NOT NULL,
  `hitter_id`     BIGINT NOT NULL,
  `session_code`  VARCHAR(50) UNIQUE,
  `is_active`     TINYINT(1) DEFAULT 1,
  `ended_at`      DATETIME,
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel anonymous_messages
CREATE TABLE `anonymous_messages` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `session_id`   INT NOT NULL,
  `sender_id`    BIGINT NOT NULL,
  `message_text` TEXT NOT NULL,
  `message_type` VARCHAR(20) DEFAULT 'text',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel reveal_status
CREATE TABLE `reveal_status` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `session_id` INT NOT NULL,
  `user_id`    BIGINT NOT NULL,
  `revealed`   TINYINT(1) DEFAULT 0,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_session_user` (`session_id`, `user_id`)
);

-- Tabel reports
CREATE TABLE `reports` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `reporter_id`       BIGINT NOT NULL,
  `target_message_id` BIGINT,
  `reason`            TEXT,
  `status`            VARCHAR(20) DEFAULT 'pending',
  `created_at`        DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel broadcasts (untuk admin panel web)
CREATE TABLE `broadcasts` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `message_text` TEXT NOT NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel blacklist_words
CREATE TABLE `blacklist_words` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `word`       VARCHAR(100) NOT NULL UNIQUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel admin_logs
CREATE TABLE `admin_logs` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `admin_action` VARCHAR(100) NOT NULL,
  `target`       VARCHAR(100),
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## ▶️ Menjalankan Bot

**Mode development (dengan auto-restart):**
```bash
npm install -g nodemon
nodemon server.js
```

**Mode production:**
```bash
node server.js
```

**Menggunakan PM2 (direkomendasikan untuk production):**
```bash
npm install -g pm2
pm2 start server.js --name fwb-confess-bot
pm2 save
pm2 startup
```

Setelah berjalan, dua layanan aktif sekaligus:
- **Bot Telegram** — berjalan via long polling
- **Admin panel web** — tersedia di `http://localhost:3000`

---

## 🤖 Perintah Bot

### Perintah User

| Perintah | Deskripsi |
|---|---|
| `/start` | Tampilkan menu utama |
| `/register` | Daftar sebagai user baru |
| `/profile` | Lihat profil kamu |
| `/cancel` | Batalkan confession yang sedang dibuat |

### Tombol Inline

| Tombol | Deskripsi |
|---|---|
| 📣 Kirim Menfess | Mulai proses kirim confession |
| 💝 Hit Me | Kirim request chat anonymous ke pembuat menfess |
| 👁️ Show Me | Request melihat identitas pembuat menfess |
| 💬 Comment | Buka thread komentar di grup diskusi |

### Perintah dalam Anonymous Chat

| Perintah | Deskripsi |
|---|---|
| `/reveal` | Request reveal identitas ke lawan chat |
| `/endchat` | Akhiri sesi anonymous chat |

### Perintah Admin (hanya `ADMIN_ID`)

| Perintah | Deskripsi |
|---|---|
| `/chatstatus` | Lihat semua sesi chat yang aktif |
| `/forceend <user_id>` | Paksa akhiri sesi chat user tertentu |
| `/forceuser <user_id>` | Force cleanup sesi bermasalah milik user |
| `/syncsessions` | Sinkronisasi data sesi memory dengan database |
| `/debugchat` | Print debug info sesi aktif ke console |
| `/debug_pending` | Lihat daftar user yang sedang pending confession |
| `/debug_ratelimit` | Lihat data rate limit confession |
| `/debug_showme` | Lihat daftar pending request Show Me |
| `/debug_comments` | Lihat status sistem komentar |

---

## 🔄 Alur Kerja Fitur

### Kirim Confession
```
User klik "Kirim Menfess"
  → Cek registrasi & rate limit
  → User ketik teks dengan #fwconfess
  → Publish ke channel + grup diskusi (jika ada)
  → Tambah tombol Hit Me, Show Me, Comment
  → Simpan ke database
```

### Hit Me → Anonymous Chat
```
User B klik "Hit Me" di confession User A
  → Validasi (registered, tidak sedang chat lain)
  → Kirim notifikasi ke User A (dengan info gender/rank User B)
  → User A klik Terima / Tolak
  → Jika Terima: buat chat session, kedua user masuk mode chat
  → Pesan diteruskan via bot secara anonim
  → Bisa request /reveal atau /endchat
```

### Show Me
```
User B klik "Show Me" di confession User A
  → Kirim notifikasi ke User A (dengan info gender/rank User B)
  → User A klik Setuju / Tolak
  → Jika Setuju: kirim username & data profil User A ke User B
```

---

## 🌐 Admin Panel Web

Tersedia di `http://localhost:{PORT}/admin` setelah server berjalan.

| Route | Deskripsi |
|---|---|
| `GET /admin/users` | Daftar semua user terdaftar |
| `POST /admin/users/:id/suspend` | Suspend (ban) user |
| `POST /admin/users/:id/activate` | Aktifkan kembali user |
| `GET /admin/broadcast` | Form broadcast pesan |
| `POST /admin/broadcast` | Kirim broadcast |
| `GET /admin/statistics` | Statistik total user & pesan |
| `GET /admin/logs` | Log aktivitas admin |
| `GET /admin/blacklist` | Manajemen kata blacklist |
| `POST /admin/blacklist` | Tambah kata blacklist |

> ⚠️ **Penting:** Admin panel web saat ini tidak memiliki autentikasi. Pastikan tidak diekspos ke internet secara langsung, atau tambahkan proteksi (basic auth / firewall) sebelum deploy ke production.

---

## ⚠️ Catatan Penting

**Konfigurasi bot di channel/grup:**
- Bot harus dijadikan **Admin** di channel target agar bisa mengirim pesan
- Bot harus dijadikan **Admin** di grup diskusi jika fitur komentar diaktifkan
- User harus sudah join channel dan grup sebelum bisa menggunakan bot (dicek otomatis saat `/start`)

**Batasan:**
- Satu confession per 8 jam per user
- Maksimal 4000 karakter per confession
- Confession harus mengandung tag `#fwconfess`

**Perilaku saat restart:**
- Sesi anonymous chat yang aktif di memory akan hilang saat bot restart
- Jalankan `/syncsessions` setelah restart untuk membersihkan sesi orphaned di database, atau tambahkan panggilan otomatis saat startup di `bot.js`

---

## 📦 Dependensi Utama

| Package | Kegunaan |
|---|---|
| `telegraf` | Framework bot Telegram |
| `mysql2` | Koneksi ke database MySQL |
| `express` | Web server untuk admin panel |
| `express-ejs-layouts` | Layout template EJS |
| `express-session` | Session management Express |
| `dotenv` | Load environment variables |