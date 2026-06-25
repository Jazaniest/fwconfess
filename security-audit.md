# Security Audit Log

Ini adalah log dari semua temuan, perubahan, dan observasi selama audit keamanan proyek FWB-CONFESS.

## Fase 1: Investigasi Awal (25 Juni 2026)

Berdasarkan analisis `package.json` dan `server.js`.

### Temuan Awal:

1.  **Session Secret Lemah (Risiko Tinggi):**
    - **Lokasi:** `server.js:23`
    - **Deskripsi:** `express-session` menggunakan `process.env.SESSION_SECRET` atau fallback ke nilai default yang diketahui publik, `'keyboard cat'`. Jika `SESSION_SECRET` tidak diatur di lingkungan produksi, penyerang dapat dengan mudah membajak sesi pengguna, terutama sesi admin.
    - **Rekomendasi:** Pastikan `SESSION_SECRET` selalu diatur dengan nilai acak yang kuat di lingkungan produksi. Berikan peringatan saat startup jika variabel ini tidak diatur.

2.  **Keamanan Panel Admin Tidak Terverifikasi (Risiko Potensial Tinggi):**
    - **Lokasi:** `server.js:29`, `src/routes/admin.js`
    - **Deskripsi:** Ada rute `/admin` yang kemungkinan memberikan akses ke fungsionalitas sensitif. Keamanan rute ini (otentikasi dan otorisasi) perlu diaudit secara menyeluruh.
    - **Langkah Selanjutnya:** Audit `src/routes/admin.js` dan middleware yang terkait.

3.  **Keamanan Webhook Tidak Terverifikasi (Risiko Potensial Sedang):**
    - **Lokasi:** `server.js:39`, `src/routes/donation.js`
    - **Deskripsi:** Webhook donasi terekspos di `/donation`. Meskipun ada `webhookSecret`, implementasi verifikasi perlu diperiksa untuk memastikan hanya permintaan yang sah dari Trakteer yang diproses.
    - **Langkah Selanjutnya:** Audit `src/routes/donation.js`.

4.  **Global Bot Instance (Risiko Potensial Rendah):**
    - **Lokasi:** `server.js:35`
    - **Deskripsi:** Instance bot Telegraf disimpan di `app.locals.bot`. Jika ada kerentanan lain (misalnya, di salah satu route), ini bisa disalahgunakan untuk mengontrol bot.
    - **Rekomendasi:** Ini adalah pola umum, tetapi risikonya perlu diingat. Pastikan semua route lain aman.

5.  **Tidak Ada Framework Pengujian (Praktik Buruk):**
    - **Lokasi:** `package.json`
    - **Deskripsi:** Skrip `test` tidak dikonfigurasi. Kurangnya pengujian otomatis meningkatkan kemungkinan bug dan regresi saat kode berubah.
    - **Rekomendasi:** Implementasikan framework pengujian seperti Jest atau Mocha untuk menguji logika bisnis, endpoint, dan penanganan bot.

### Temuan Kritis dari `src/routes/admin.js`:

6.  **Mekanisme Otentikasi Admin yang Sangat Tidak Aman (Risiko Kritis):**
    -   **Lokasi:** `src/routes/admin.js:39-53`
    -   **Deskripsi:** Middleware `requireAdmin` memiliki logika yang sangat berbahaya:
        -   `if (!adminId ...)`: **Jika `ADMIN_ID` tidak diatur, akses diberikan secara otomatis!** Ini berarti di lingkungan pengembangan atau jika ada kesalahan konfigurasi, panel admin terbuka untuk siapa saja.
        -   `... || req.query.admin === adminId)`: **ID admin dikirimkan sebagai *query parameter*!** Contoh: `https://.../admin?admin=ID_ADMIN_DI_SINI`. Ini sangat tidak aman karena ID admin akan terekam di log server, log proxy, dan riwayat browser. Ini adalah *credential exposure*.
    -   **Dampak:** Siapapun dapat memperoleh akses admin penuh dengan mudah.
    -   **Rekomendasi:**
        1.  Hapus total mekanisme *bypass* `!adminId` dan *query parameter*.
        2.  Otentikasi hanya boleh melalui `POST` request dan harus selalu menggunakan session.
        3.  Aplikasi harus gagal startup jika `ADMIN_ID` tidak diatur di lingkungan produksi.

7.  **Potensi SQL Injection (Risiko Tinggi):**
    -   **Lokasi:** Berpotensi di seluruh aplikasi, terutama di file-file `repositories/*.repo.js`.
    -   **Deskripsi:** Meskipun beberapa query sudah menggunakan *parameterized queries*, perlu ada audit menyeluruh untuk memastikan semua input pengguna yang masuk ke database di-sanitize dengan benar untuk mencegah SQL Injection.
    -   **Dampak:** Eksekusi kode SQL arbitrer, pencurian data, modifikasi, atau penghapusan.
    -   **Langkah Selanjutnya:** Audit semua file di direktori `repositories` dan `services`.

8.  **Tidak Ada Perlindungan CSRF (Cross-Site Request Forgery) (Risiko Sedang):**
    -   **Lokasi:** Semua rute `POST` di `admin.js`.
    -   **Deskripsi:** Form dan aksi `POST` tidak menggunakan token CSRF. Penyerang dapat menipu admin yang sedang login untuk melakukan tindakan tanpa sepengetahuan mereka.
    -   **Dampak:** Pengambilalihan tindakan admin.
    -   **Rekomendasi:** Implementasikan middleware CSRF (misalnya, `csurf` atau token manual) untuk semua rute yang mengubah state.
    -   **Status:** **[SELESAI]** Diimplementasikan menggunakan `csurf` dan `cookie-parser`. Token CSRF ditambahkan ke semua form admin.

9.  **Potensi SQL Injection pada Kolom Dinamis (Risiko Sedang):**
    -   **Lokasi:** `src/repositories/user.repo.js:160-167`
    -   **Deskripsi:** Fungsi `setPrivacyField` menggunakan *template literal* untuk menyisipkan nama kolom secara dinamis ke dalam query UPDATE. Meskipun saat ini aman karena adanya *whitelist* yang ketat (`allowed.includes(field)`), pola ini berbahaya jika diterapkan di tempat lain tanpa validasi yang kuat.
    -   **Dampak:** Jika validasi gagal atau dihilangkan, ini bisa membuka celah SQL Injection.
    -   **Rekomendasi:** Pertahankan *whitelist* dengan ketat. Hindari pola ini jika memungkinkan.
10. **Verifikasi Webhook Donasi Dinonaktifkan (Risiko Kritis):**
    -   **Lokasi:** `src/routes/donation.js:19-23`
    -   **Deskripsi:** Kode yang seharusnya memvalidasi `x-trakteer-token` dari webhook donasi sengaja dinonaktifkan (dikomentari). Ini memungkinkan siapa saja untuk mengirim request palsu ke endpoint donasi.
    -   **Dampak:** Memungkinkan notifikasi donasi palsu, spam ke channel/admin, dan potensi DoS.
    -   **Status:** **[SELESAI]** Blok kode verifikasi telah diaktifkan kembali.
11. **Potensi Kebocoran Konteks Balasan (Risiko Rendah):**
    -   **Lokasi:** Berbagai handler perintah seperti `/menfess` di `start.js`.
    -   **Deskripsi:** Banyak perintah membalas menggunakan `ctx.reply` tanpa memeriksa tipe chat. Jika perintah personal seperti `/menfess` dijalankan di grup, balasannya akan muncul di grup, menciptakan "noise" dan pengalaman pengguna yang buruk.
    -   **Dampak:** Fungsionalitas bot yang tidak rapi di lingkungan grup.
    -   **Rekomendasi:** Tambahkan middleware untuk memeriksa `ctx.chat.type === 'private'` pada perintah yang bersifat personal. Alihkan pengguna ke chat pribadi jika perlu.

12. **Kebocoran Riwayat Menfess ke Grup (Risiko Sedang):**
    -   **Lokasi:** `start.js:98` (handler untuk `btn_view`).
    -   **Deskripsi:** Tombol untuk melihat riwayat menfess tidak memeriksa tipe chat. Jika tombol ini diklik dari dalam grup, daftar menfess yang pernah dikirim oleh pengguna akan diposting ke grup tersebut. Ini membocorkan riwayat aktivitas pengguna.
    -   **Dampak:** Pelanggaran privasi pengguna dengan mengekspos aktivitas mereka ke audiens yang tidak diinginkan.
    -   **Rekomendasi:** **Kritis.** Tambahkan pemeriksaan `ctx.chat.type === 'private'` di awal handler `btn_view`. Abaikan permintaan jika tidak berasal dari chat pribadi.
---
