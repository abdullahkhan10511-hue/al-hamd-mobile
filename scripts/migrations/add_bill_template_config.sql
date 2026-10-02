-- ==============================================================================
-- MIGRATION: Add template_config Column to bill_settings
-- Al-Hamd Mobile Accessories
-- Version: 2026-10-02
--
-- Safe, idempotent additive migration for bill_settings table.
-- Preserves all existing store and billing configuration data.
-- ==============================================================================

-- 1. Ensure schema_migrations table exists
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(100) NOT NULL PRIMARY KEY,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add template_config if not exists (using stored procedure for 100% idempotent execution on MySQL 5.7 / 8.0)
DROP PROCEDURE IF EXISTS `AddBillTemplateConfigColumn`;
DELIMITER $$
CREATE PROCEDURE `AddBillTemplateConfigColumn`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bill_settings'
      AND COLUMN_NAME = 'template_config'
  ) THEN
    ALTER TABLE `bill_settings` ADD COLUMN `template_config` LONGTEXT NULL;
  END IF;
END$$
DELIMITER ;

CALL `AddBillTemplateConfigColumn`();
DROP PROCEDURE IF EXISTS `AddBillTemplateConfigColumn`;

-- 3. Record migration execution in schema_migrations
INSERT IGNORE INTO `schema_migrations` (`version`, `executed_at`)
VALUES ('add_bill_template_config_2026_10_02', NOW());
