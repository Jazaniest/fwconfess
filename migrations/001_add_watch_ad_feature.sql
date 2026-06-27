-- Bagian 1: Menambah saldo menfess gratis ke tabel pengguna
ALTER TABLE `users`
ADD COLUMN `free_menfess_balance` INT NOT NULL DEFAULT 0 AFTER `rank`;

-- Bagian 2: Tabel baru untuk melacak token tontonan iklan
CREATE TABLE `ad_view_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `token` VARCHAR(64) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `status` ENUM('pending', 'claimed', 'expired') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `token_UNIQUE` (`token` ASC),
  INDEX `user_id_idx` (`user_id` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Bagian 3: Tabel baru untuk mencatat riwayat tontonan (untuk batas harian)
CREATE TABLE `ad_view_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `viewed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `user_id_viewed_at_idx` (`user_id` ASC, `viewed_at` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Bagian 4: Menambah konfigurasi baru ke bot_config
-- (Ini akan ditambahkan melalui kode, tetapi dicatat di sini untuk kelengkapan)
-- INSERT INTO `bot_config` (`key`, `value`) VALUES ('ads_watch_daily_limit', '3');
-- INSERT INTO `bot_config` (`key`, `value`) VALUES ('feature_watch_ad_enabled', '1');
