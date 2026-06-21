# Refactor Phase 1: Foundation

**Date:** 2026-06-21
**Project:** FWB Confess Telegram Bot
**Status:** Approved

## Goal

Membangun fondasi folder structure dan mengekstrak kode yang bersifat lintas-domain (utilitas, middleware) dari file-file besar ke modul-modul kecil yang independen. Fase ini **tidak mengubah logic** — hanya memindahkan kode yang sudah ada.

## Scope

### 1. Folder Structure

```
src/
├── middleware/     ← (dulu kosong, sekarang diisi)
│   ├── ban.js
│   ├── membership.js
│   └── admin-auth.js
├── repositories/  ← (masih kosong, siap untuk Fase 2)
├── handlers/      ← (masih kosong, siap untuk Fase 3+)
├── services/
│   └── db.js      ← (tidak disentuh)
└── utils/         ← (dulu kosong, sekarang diisi)
    ├── formatters.js
    └── keyboard.js
```

### 2. utils/formatters.js — Fungsi yang dipindah

| Fungsi | Asal | Dipakai oleh |
|--------|------|-------------|
| `formatConfessionMessage(text, user)` | confess.js:334-358 | confess.js |
| `getGenderEmoji(gender)` | confess.js:361-369 | confess.js |
| `getRankEmoji(rank)` | confess.js:371-382 | confess.js |
| `renderMsg(template, vars)` | confess.js:46-51 | confess.js |
| `formatRupiah(amount)` | routes/donation.js:7-11 | donation route |
| `formatDate(date)` | daget.js:44-50 | daget.js |
| `escMd(text)` | daget.js:52-55 | daget.js |
| `ranksLabel(ranks)` | daget.js:57-59 | daget.js |

### 3. utils/keyboard.js — Fungsi yang dipindah

Menyediakan helper untuk membuat inline keyboard yang konsisten:

- `backToMainButton()` — tombol "🏠 Menu Utama"
- `backToAdminButton()` — tombol "👑 Admin Panel"
- `inlineUrl(label, url)` — tombol URL inline
- `inlineCb(label, data)` — tombol callback inline
- Fungsi-fungsi keyboard umum lainnya yang saat ini di-define inline di start.js

### 4. middleware/ban.js — Yang dipindah

Dari `bot.js:39-93`:
- Middleware pengecekan ban global
- Logic: cek user di DB, jika kena ban maka tolak dengan pesan
- Export sebagai fungsi default `createBanMiddleware(bot)`

### 5. middleware/admin-auth.js — Yang dipindah

Dari `admin.js:17-38`:
- Fungsi `isAdmin(userId)` — cek apakah user admin
- Middleware `adminMiddleware(ctx, next)` — proteksi handler admin
- Export `{ isAdmin, adminMiddleware }`

### 6. middleware/membership.js — Yang dipindah

Dari `start.js:92-109`:
- Fungsi `checkMembership(ctx, userId)` — cek keanggotaan channel/grup
- Fungsi `showJoinRequirement(ctx, membershipStatus)` — tampilkan pesan join
- Export `{ checkMembership, showJoinRequirement }`

### 7. Update Impor

Setelah ekstraksi, file-file berikut perlu di-update:
- `bot.js` — impor `createBanMiddleware` dari `middleware/ban.js`
- `start.js` — impor `checkMembership`, `showJoinRequirement` dari `middleware/membership.js`
- `admin.js` — impor `isAdmin`, `adminMiddleware` dari `middleware/admin-auth.js`
- `confess.js` — impor `formatConfessionMessage`, `getGenderEmoji`, `getRankEmoji`, `renderMsg` dari `utils/formatters.js`
- `daget.js` — impor `formatDate`, `escMd`, `ranksLabel` dari `utils/formatters.js`
- `routes/donation.js` — impor `formatRupiah` dari `utils/formatters.js`

## Non-Goals

- Tidak mengubah logic bisnis
- Tidak memecah `database.js` (itu untuk Fase 2)
- Tidak membuat handler baru (itu untuk Fase 3+)
- Tidak mengubah server.js atau views/

## Rollback Plan

Setiap file yang diubah memiliki backup implisit via git. Seluruh perubahan Fase 1 bisa di-revert dengan:
```bash
git reset --hard HEAD
```

## Success Criteria

- [ ] `npm start` berjalan tanpa error impor
- [ ] Bot connect ke Telegram tanpa error
- [ ] Semua command (/start, /menfess, /profile, /register) berfungsi
- [ ] Semua middleware (ban, admin-auth, membership) berfungsi
- [ ] Tidak ada kode duplikat yang tertinggal di file asal
