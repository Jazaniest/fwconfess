# Fitur Tonton Iklan

Dokumen ini menjelaskan arsitektur dan alur kerja dari fitur "Tonton Iklan untuk Menfess Gratis".

## 1. Tujuan

Memberikan pengguna cara untuk mendapatkan kuota menfess tambahan (gratis) dengan menonton iklan atau konten dari situs web eksternal, dengan batasan harian yang dapat dikelola oleh admin.

## 2. Perubahan Database

Fitur ini memperkenalkan skema database berikut (didefinisikan dalam `migrations/001_add_watch_ad_feature.sql`):

### Kolom Baru di Tabel `users`
- **`free_menfess_balance` (INT, DEFAULT 0):** Menyimpan jumlah "saldo" menfess gratis yang dimiliki pengguna. Saldo ini akan digunakan terlebih dahulu sebelum rate limit reguler.

### Tabel Baru: `ad_view_tokens`
Tabel ini digunakan untuk mengamankan proses pemberian hadiah.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INT (PK) | ID unik. |
| `token` | VARCHAR(64) | Token acak yang unik dan sekali pakai. |
| `user_id` | BIGINT | Pengguna yang meminta untuk menonton iklan. |
| `status` | ENUM | Status token: `pending`, `claimed`, `expired`. |
| `created_at` | TIMESTAMP | Waktu token dibuat. |
| `expires_at` | TIMESTAMP | Waktu kedaluwarsa token (biasanya 10 menit). |

### Tabel Baru: `ad_view_history`
Tabel ini digunakan untuk melacak riwayat tontonan untuk keperluan batas harian.

| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | INT (PK) | ID unik. |
| `user_id` | BIGINT | Pengguna yang menonton. |
| `viewed_at`| TIMESTAMP | Waktu tontonan dicatat. |

## 3. Alur Kerja

### A. Meminta Link Iklan
1.  **Perintah:** Pengguna menjalankan `/tontoniklan`. Kode ada di `src/commands/watchAd.js`.
2.  **Validasi:** Bot memeriksa apakah fitur diaktifkan (`feature_watch_ad_enabled`) dan apakah pengguna sudah mencapai batas harian (`ads_watch_daily_limit`) dengan memeriksa tabel `ad_view_history`.
3.  **Pembuatan Token:** Jika validasi berhasil, bot akan:
    - Membuat token kriptografis yang aman dan acak.
    - Menyimpan token tersebut ke tabel `ad_view_tokens` dengan status `pending` dan waktu kedaluwarsa 10 menit.
4.  **Pengiriman URL:** Bot menggabungkan URL dasar dari `.env` (`AD_WEBSITE_URL`) dengan token, dan mengirimkannya ke pengguna dalam bentuk tombol.
    - Contoh: `https://website-iklan-anda.com/tonton?token=...`

### B. Proses di Website & Callback
1.  **Website Menerima Token:** Website iklan Anda menerima `token` dari parameter URL.
2.  **Sinyal Selesai:** Setelah iklan selesai, website Anda **harus** mengirimkan request `POST` ke webhook bot.
    - **Endpoint:** `<SERVER_URL>/webhook/iklan-selesai`
    - **Body:** `{ "token": "...", "secret": "..." }`
    - **Keamanan:** Request ini sangat disarankan dilakukan dari backend website Anda untuk melindungi `secret`.

### C. Validasi Webhook & Pemberian Hadiah
1.  **Penerimaan:** Endpoint di `src/routes/adWebhook.js` menerima request.
2.  **Validasi:** Bot melakukan serangkaian pemeriksaan dalam sebuah transaksi database:
    - Memverifikasi `secret` dari `.env` (`AD_CALLBACK_SECRET`).
    - Mencari `token` di `ad_view_tokens` yang berstatus `pending` dan belum kedaluwarsa.
3.  **Pemberian Hadiah:** Jika semua valid:
    - Status token diubah menjadi `claimed`.
    - Saldo `free_menfess_balance` pengguna di-increment (+1) melalui `UserRepo.incrementFreeMenfessBalance`.
    - Sebuah entri baru ditambahkan ke `ad_view_history`.
    - Transaksi di-commit.
    - Bot mengirim notifikasi keberhasilan kepada pengguna.

### D. Penggunaan Saldo Menfess Gratis
1.  **Lokasi Kode:** `src/handlers/confession.handler.js`.
2.  **Alur:** Saat pengguna mengirim menfess:
    - Sistem akan memeriksa `free_menfess_balance` terlebih dahulu.
    - **Jika > 0:** Saldo dikurangi satu, menfess dikirim, dan proses rate limit reguler **dilewati**.
    - **Jika = 0:** Proses dilanjutkan dengan pengecekan rate limit seperti biasa.

## 4. Konfigurasi

### File `.env`
Dua variabel lingkungan baru diperlukan:
- `AD_WEBSITE_URL`: URL dasar situs iklan Anda.
- `AD_CALLBACK_SECRET`: Kunci rahasia bersama antara bot dan situs web Anda.

### Panel Admin
- **Lokasi:** `/admin` -> `Pengaturan Bot` -> `🎬 Tonton Iklan`
- **Fitur:**
    - Mengaktifkan/menonaktifkan fitur (`feature_watch_ad_enabled`).
    - Mengatur batas tontonan harian per pengguna (`ads_watch_daily_limit`).
