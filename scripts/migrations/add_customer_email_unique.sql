-- ==============================================================================
-- MIGRATION: Customer Email Uniqueness Constraint
-- Al-Hamd Mobile Accessories
-- Version: 2026-10-17
--
-- Safe, backward-compatible migration ensuring customer email uniqueness
-- while preserving multiple NULL values for wholesale accounts and guest POS.
-- Preserves all existing tables, products, orders, customers, and inventory data.
-- ==============================================================================

-- 1. Ensure schema_migrations tracking table exists
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(100) NOT NULL PRIMARY KEY,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Normalize any empty-string emails to NULL so they do not collide under UNIQUE index
UPDATE `customers` SET `email` = NULL WHERE `email` IS NOT NULL AND TRIM(`email`) = '';

-- 3. Add UNIQUE index on email (if not already existing)
-- Note: MySQL InnoDB permits multiple NULL values in a UNIQUE index (NULL != NULL).
SET @index_exists = (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND INDEX_NAME = 'idx_customers_email_unique'
);

SET @sql_stmt = IF(@index_exists = 0,
  'ALTER TABLE `customers` ADD UNIQUE KEY `idx_customers_email_unique` (`email`)',
  'SELECT "Index idx_customers_email_unique already exists" AS notice'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Record migration execution in schema_migrations
INSERT IGNORE INTO `schema_migrations` (`version`, `executed_at`)
VALUES ('add_customer_email_unique_2026_10_17', NOW());
