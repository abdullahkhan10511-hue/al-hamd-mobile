-- ==============================================================================
-- MIGRATION: Add Brand Ordering & Featured Support
-- Al-Hamd Mobile Accessories
-- Version: 2026-10-02
--
-- Safe, idempotent additive migration for the brands table.
-- Preserves all existing brand rows, products, and relationships.
-- ==============================================================================

-- 1. Ensure schema_migrations exists
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(100) NOT NULL PRIMARY KEY,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add sort_order to brands (using stored procedure for 100% idempotent execution on MySQL 5.7/8.0)
DROP PROCEDURE IF EXISTS `AddBrandOrderingColumns`;
DELIMITER $$
CREATE PROCEDURE `AddBrandOrderingColumns`()
BEGIN
  -- Add sort_order if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'brands'
      AND COLUMN_NAME = 'sort_order'
  ) THEN
    ALTER TABLE `brands` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0;
  END IF;

  -- Add is_featured if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'brands'
      AND COLUMN_NAME = 'is_featured'
  ) THEN
    ALTER TABLE `brands` ADD COLUMN `is_featured` TINYINT(1) NOT NULL DEFAULT 0;
  END IF;
END$$
DELIMITER ;

CALL `AddBrandOrderingColumns`();
DROP PROCEDURE IF EXISTS `AddBrandOrderingColumns`;

-- 3. Record migration execution in schema_migrations
INSERT IGNORE INTO `schema_migrations` (`version`, `executed_at`)
VALUES ('add_brand_ordering_2026_10_02', NOW());
