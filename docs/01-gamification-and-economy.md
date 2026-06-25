# Dokumentasi Sistem Gamifikasi & Ekonomi

Dokumen ini menjelaskan arsitektur dan alur kerja untuk semua fitur terkait gamifikasi (Papan Peringkat, Achievement, Badge) dan ekonomi (Koin, Top Up, Pembelian Rank) yang telah diimplementasikan.

## 1. Konsep Inti

Sistem ini dirancang untuk meningkatkan keterlibatan pengguna dan membuka peluang monetisasi melalui tiga pilar utama:

1.  **Pengakuan Sosial (Social Recognition):** Pengguna yang aktif dan berkontribusi dihargai dengan status yang terlihat oleh komunitas (Papan Peringkat & Badge).
2.  **Pencapaian Pribadi (Personal Accomplishment):** Pengguna mendapatkan penghargaan permanen atas tonggak sejarah mereka dalam menggunakan bot (Achievements).
3.  **Ekonomi Virtual (Virtual Economy):** Pengguna dapat membeli "Koin" (mata uang virtual) untuk ditukarkan dengan fitur premium yang memberikan nilai tambah.

---

## 2. Sistem Papan Peringkat & Badge Mingguan

### Alur Kerja

1.  **Pelacakan Aksi:**
    -   Setiap kali pengguna melakukan aksi yang relevan (mengirim menfess, di-"hit", atau melakukan top up koin), sebuah entri ditambahkan/diperbarui di tabel `leaderboards`.
    -   Logika ini berada di:
        -   `src/handlers/confession.handler.js` untuk `weekly_confessions`.
        -   `src/commands/hitme.js` untuk `weekly_hitme_received`.
        -   (Pelacakan donasi untuk leaderboard saat ini dinonaktifkan karena tidak ada `user_id` yang pasti, namun `weekly_donations` ada sebagai tipe).

2.  **Reset Mingguan:**
    -   Sebuah *cron job* yang dijadwalkan di `src/bot.js` (menggunakan `node-schedule`) berjalan setiap Senin pukul 00:01.
    -   Job ini memanggil fungsi `runWeeklyReset` dari `src/jobs/weekly-reset.js`.

3.  **Proses `runWeeklyReset`:**
    -   Menghapus semua *badge* yang sudah kedaluwarsa dari tabel `user_badges`.
    -   Mengambil data pemenang dari tabel `leaderboards` untuk minggu **sebelumnya**.
    -   Memberikan *badge* kepada para pemenang dengan menyisipkan data ke `user_badges` dengan `expires_at` diatur 7 hari ke depan.
    -   Mengirim pesan pengumuman pemenang ke grup diskusi utama.

4.  **Penampilan Badge:**
    -   *Middleware* `src/middleware/badge-enforcer.js` berjalan untuk setiap pesan di grup.
    -   Ia memeriksa apakah pengirim pesan memiliki *badge* aktif di `user_badges`.
    -   Jika ya, ia menggunakan `ctx.setChatAdministratorCustomTitle()` untuk menampilkan *badge* tersebut sebagai "jabatan kustom" di samping nama pengguna di grup. **Penting:** Bot harus menjadi admin di grup dengan izin "Change Info" agar ini berfungsi.

---

## 3. Sistem Achievement

-   **Tujuan:** Memberikan penghargaan permanen.
-   **Definisi:** Semua *achievement* yang mungkin didefinisikan di tabel `achievements`. Untuk menambah *achievement* baru, cukup tambahkan baris baru ke tabel ini.
-   **Logika Inti:** Berada di `src/repositories/achievement.repo.js`. Fungsi `unlockAchievement(userId, achievementName)` secara aman (menggunakan transaksi) memeriksa dan memberikan *achievement* jika pengguna belum memilikinya.
-   **Integrasi:** Pemanggilan `unlockAchievement` tersebar di berbagai bagian kode:
    -   `confession.handler.js`: Memberikan `FIRST_CONFESSION` dan `TEN_CONFESSIONS`.
    -   `routes/payment.js`: Memberikan `FIRST_DONATION`. (Catatan: ini seharusnya `FIRST_TOPUP`, perlu diperbaiki).
    -   `commands/hitme.js`: Memberikan `FIRST_HIT`.
-   **Tampilan:** Perintah `/profile` mengambil dan menampilkan semua *achievement* yang dimiliki pengguna dari tabel `user_achievements`.

---

## 4. Sistem Koin Virtual & Monetisasi

### Alur Kerja Donasi vs. Top Up

Penting untuk membedakan keduanya:
-   **Donasi:** Dukungan sukarela. Menghasilkan notifikasi publik, masuk ke leaderboard donatur (jika nama diberikan), **TIDAK** menambah koin.
-   **Top Up:** Pembelian produk (koin). **TIDAK** menghasilkan notifikasi publik, **TIDAK** masuk leaderboard donatur, tetapi **MENAMBAH** koin ke dompet pengguna.

Pemisahan ini dicapai melalui URL Trakteer yang berbeda:
-   **`/donasi`** menggunakan URL Trakteer biasa.
-   **`/topup`** (`src/commands/economy.js`) membuat URL dengan parameter kustom: `.../tip?type=topup&tid={...}`.

*Handler* webhook di `src/routes/payment.js` memeriksa keberadaan `query.type === 'topup'` untuk memutuskan alur mana yang harus dijalankan.

### Alur Pembelian Rank/VIP

-   Perintah `/rank` (`src/commands/rank.js`) menampilkan rank yang tersedia dari `rank_confession_limits` beserta harganya.
-   **Beli dengan Koin:** Langsung memanggil `EconomyRepo.spendCoins()` dan kemudian `UserRepo.updateUserRank()`.
-   **Beli dengan Rupiah:** Membuat URL Trakteer khusus (`.../tip?type=rank_purchase&rank={...}`), yang kemudian ditangani oleh *case* khusus di `payment.js`.

---

## 5. Sistem Kontrol (Feature Flags & Maintenance)

-   **Konsep:** Semua "saklar" disimpan di tabel `bot_config`.
-   **Layanan Terpusat:** `src/services/config.service.js` bertanggung jawab untuk:
    -   Memuat semua konfigurasi ke *cache* saat bot dimulai.
    -   Menyediakan fungsi `isFeatureEnabled()` dan `isMaintenanceMode()` yang membaca dari *cache* (sangat cepat).
    -   Menyediakan fungsi `set()` yang memperbarui database dan *cache* secara bersamaan.
-   **Mode Pemeliharaan:** Dikendalikan oleh *middleware* `src/middleware/maintenance.js` yang berjalan paling awal.
-   **Kontrol Admin:** Admin dapat mengubah semua saklar ini melalui:
    -   **Panel Web:** Di halaman `/admin/settings`.
    -   **Panel Bot:** Di menu "Pengaturan Bot" -> "Toggle Fitur".
