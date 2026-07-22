-- 1. Create a new, more comprehensive 'ranks' table.
CREATE TABLE IF NOT EXISTS `ranks` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL UNIQUE,
    `type` ENUM('permanent', 'subscription') NOT NULL,
    `duration_days` INTEGER, -- NULL for 'permanent' ranks
    `price_coins` INTEGER NOT NULL DEFAULT 0,
    `price_currency` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `confession_limit` INTEGER NOT NULL DEFAULT 5, -- Perk example
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE, -- To toggle ranks from admin panel
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Modify the 'users' table to integrate with the new rank system.
ALTER TABLE `users`
    ADD COLUMN `rank_id` BIGINT UNSIGNED,
    ADD COLUMN `rank_expires_at` TIMESTAMP NULL,
    ADD CONSTRAINT `fk_users_rank` FOREIGN KEY (`rank_id`) REFERENCES `ranks`(`id`) ON DELETE SET NULL;



-- The following commands are for reference and should be run manually after verifying the old system's data.
-- 3. (Optional but Recommended) Data Migration from the old system.
-- INSERT INTO ranks (name, `type`, confession_limit, price_coins, price_currency)
-- SELECT rank_name, 'permanent', `limit`, 0, 0
-- FROM rank_confession_limits
-- ON DUPLICATE KEY UPDATE name=name;

-- UPDATE users u JOIN ranks r ON u.rank = r.name SET u.rank_id = r.id;

-- 4. (Optional) Drop the old table and column after successful migration.
-- DROP TABLE IF EXISTS rank_confession_limits;
-- ALTER TABLE users DROP COLUMN IF EXISTS rank;
