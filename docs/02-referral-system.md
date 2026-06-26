# Sistem Referral Unilevel

Dokumen ini menjelaskan arsitektur dan alur kerja dari sistem referral unilevel yang diimplementasikan pada bot.

## 1. Perubahan Database

Fitur ini memperkenalkan skema database baru untuk melacak hubungan referral dan mengelola reward.

### Kolom Baru di Tabel `users`

- **`referrer_id` (BIGINT, NULLABLE):** Menyimpan `telegram_id` dari pengguna yang memberikan referensi (upline). Bernilai `NULL` jika pengguna mendaftar tanpa kode referral.
- **`is_cofounder` (BOOLEAN, DEFAULT 0):** Sebuah flag untuk menandai pengguna sebagai "co-founder". Pengguna dengan status ini mendapatkan skema reward khusus.
- **`idx_referrer_id`:** Index ditambahkan pada kolom `referrer_id` untuk mempercepat query pencarian upline.

### Tabel Baru: `referral_rewards`

Tabel ini berfungsi sebagai pusat konfigurasi untuk reward referral publik.

| Kolom         | Tipe | Deskripsi                               | Contoh Nilai |
|---------------|------|-----------------------------------------|--------------|
| `level`       | INT  | Level kedalaman referral (1-5).         | 1            |
| `reward_amount`| INT  | Jumlah reward dalam **koin** (bukan Rupiah). | 0.5          |

### Tabel Baru: `referral_payouts`

Tabel ini berfungsi sebagai log audit untuk setiap transaksi reward referral yang berhasil.

| Kolom           | Tipe      | Deskripsi                                    |
|-----------------|-----------|----------------------------------------------|
| `id`            | INT (PK)  | ID unik untuk setiap payout.                  |
| `recipient_id`  | BIGINT    | User yang menerima reward.                   |
| `new_user_id`   | BIGINT    | User baru yang memicu reward.                |
| `level`         | INT       | Level kedalaman (-1 untuk co-founder).     |
| `reward_amount` | INT       | Jumlah koin yang diberikan.                  |
| `created_at`    | TIMESTAMP | Waktu transaksi.                             |

## 2. Alur Kerja Referral

### Pendaftaran

1.  **Link Referral:** Pengguna membagikan link referral dalam format `https://t.me/YourBotName?start=<TELEGRAM_ID>`.
2.  **Deteksi Kode:** Saat pengguna baru menekan link tersebut, bot di `src/commands/start.js` akan mendeteksi `startPayload` (ID Telegram) dan menyimpannya sementara di `ctx.session.referrerId`.
3.  **Proses Registrasi:** Saat pengguna menyelesaikan pendaftaran di `src/commands/register.js`, `referrer_id` dari session akan disimpan ke dalam profil pengguna baru di database.

### Distribusi Reward

Logika utama berada di `src/services/referral.service.js`.

1.  **Pemicu:** Fungsi `processReferralRewards` dipanggil secara asinkron setelah pengguna baru berhasil disimpan ke database.
2.  **Reward Publik (5 Level):** Sistem akan melakukan loop ke atas dari pengguna baru, mencari `referrer_id` hingga 5 level. Untuk setiap level, sistem akan memberikan reward koin sesuai konfigurasi di tabel `referral_rewards`.
3.  **Reward Co-founder (Tak Terbatas):** Setelah 5 level, sistem akan terus mencari ke atas. Jika ditemukan upline dengan flag `is_cofounder = 1`, upline tersebut akan menerima reward khusus (dikonfigurasi di `bot_config`) dan pencarian berhenti.
4.  **Pencatatan:** Setiap koin yang berhasil diberikan akan dicatat di tabel `referral_payouts`.

## 3. Integrasi Pembayaran Trakteer

Alur pembayaran untuk donasi dan rank diubah untuk kompatibilitas dengan Trakteer.

- **Format URL:** URL yang benar adalah `https://trakteer.id/jzxyzx/tip?quantity=X&step=2&supporter_message=Y`.
- **Pembelian Rank:** Untuk membedakan pembelian rank dari donasi biasa, data disematkan di dalam `supporter_message` dengan format: `UPGRADE;<NAMA_RANK>;<USER_ID>`.
- **Logika Webhook:** File `src/routes/payment.js` diubah untuk mem-parsing `supporter_message`. Jika pesan diawali dengan `UPGRADE;`, maka itu akan diproses sebagai pembelian rank. Jika tidak, akan dianggap sebagai donasi biasa.

## 4. Panel Admin

Fitur referral dapat dikelola sepenuhnya melalui panel admin (`/admin`).

- **Lokasi Kode:** `src/handlers/admin/admin-settings.js` (UI) dan `src/commands/admin.js` (logika).
- **Fitur yang Tersedia:**
    - **Mengaktifkan/Menonaktifkan:** Mengubah flag `feature_referral_enabled` di `bot_config`.
    - **Ubah Reward Publik:** Mengubah nilai `reward_amount` di tabel `referral_rewards` untuk level 1-5.
    - **Ubah Reward Co-founder:** Mengubah nilai `referral_cofounder_reward` di `bot_config`.
    - **Kelola Co-founder:** Menambah atau menghapus status co-founder (flag `is_cofounder`) dari seorang pengguna berdasarkan ID Telegram.
