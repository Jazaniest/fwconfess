-- Tabel-tabel asli dari README.md
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `telegram_id`   BIGINT NOT NULL UNIQUE,
  `username`      VARCHAR(255),
  `gender`        VARCHAR(20),
  `origin`        VARCHAR(100),
  `rank`          VARCHAR(20) DEFAULT 'bronze',
  `is_active`     TINYINT(1) DEFAULT 1,
  `registered_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `hide_username` BOOLEAN DEFAULT FALSE,
  `hide_gender` BOOLEAN DEFAULT FALSE,
  `hide_origin` BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS `confessions` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `telegram_id`        BIGINT NOT NULL,
  `message_text`       TEXT NOT NULL,
  `channel_message_id` BIGINT,
  `created_at`         DATETIME DEFAULT CURRENT_TIMESTAMP,
  `tags` VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS `chat_sessions` (
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

CREATE TABLE IF NOT EXISTS `anonymous_messages` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `session_id`   INT NOT NULL,
  `sender_id`    BIGINT NOT NULL,
  `message_text` TEXT NOT NULL,
  `message_type` VARCHAR(20) DEFAULT 'text',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `reveal_status` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `session_id` INT NOT NULL,
  `user_id`    BIGINT NOT NULL,
  `revealed`   TINYINT(1) DEFAULT 0,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_session_user` (`session_id`, `user_id`)
);

CREATE TABLE IF NOT EXISTS `reports` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `reporter_id`       BIGINT NOT NULL,
  `target_message_id` BIGINT,
  `reason`            TEXT,
  `status`            VARCHAR(20) DEFAULT 'pending',
  `created_at`        DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `broadcasts` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `message_text` TEXT NOT NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `blacklist_words` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `word`       VARCHAR(100) NOT NULL UNIQUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `admin_action` VARCHAR(100) NOT NULL,
  `target`       VARCHAR(100),
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `bot_config` (
    `key` VARCHAR(50) PRIMARY KEY,
    `value` TEXT
);

CREATE TABLE IF NOT EXISTS `donations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `transaction_id` VARCHAR(255) NOT NULL UNIQUE,
    `supporter_name` VARCHAR(255),
    `supporter_message` TEXT,
    `unit` VARCHAR(50),
    `quantity` INT,
    `price` INT,
    `total_amount` INT,
    `user_id` BIGINT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (user_id)
);

CREATE TABLE IF NOT EXISTS `rank_confession_limits` (
    `rank` VARCHAR(50) PRIMARY KEY,
    `max_count` INT,
    `is_active` BOOLEAN,
    `updated_at` TIMESTAMP,
    `hitme_max_count` INT,
    `showme_max_count` INT,
    `price_coins` INT DEFAULT 0,
    `price_idr` INT DEFAULT 0
);

-- Tabel-tabel baru
CREATE TABLE IF NOT EXISTS achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    achievement_id INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE KEY user_achievement_unique (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS leaderboards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    score INT DEFAULT 0,
    week_of_year INT NOT NULL,
    year INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
    UNIQUE KEY user_leaderboard_unique (user_id, type, week_of_year, year)
);

CREATE TABLE IF NOT EXISTS user_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    badge_title VARCHAR(100) NOT NULL,
    badge_icon VARCHAR(10),
    source_description VARCHAR(255),
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_wallets (
    user_id BIGINT NOT NULL PRIMARY KEY,
    balance INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coin_transactions (
    id VARCHAR(50) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount INT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Tabel yang mungkin terlewat
CREATE TABLE IF NOT EXISTS `dagetan` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message_id` bigint(20) NOT NULL,
  `creator_id` bigint(20) NOT NULL,
  `amount` int(11) NOT NULL,
  `winner_count` int(11) NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'waiting',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `draw_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `daget_winners` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `daget_id` int(11) NOT NULL,
  `winner_id` bigint(20) NOT NULL,
  `amount` int(11) NOT NULL,
  `win_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `daget_id` (`daget_id`),
  CONSTRAINT `daget_winners_ibfk_1` FOREIGN KEY (`daget_id`) REFERENCES `dagetan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
