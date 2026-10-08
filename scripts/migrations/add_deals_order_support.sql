-- ==============================================================================
-- MIGRATION: Add Deal Support to Order Items
-- Al-Hamd Mobile Accessories
-- Version: 2026-10-07
--
-- Safe, additive, idempotent migration.
-- Preserves all existing tables, products, orders, customers, and inventory data.
-- ==============================================================================

-- 1. Ensure schema_migrations tracking table exists
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(100) NOT NULL PRIMARY KEY,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add deal tracking columns to order_items if not already present
-- Stored procedure used for safe MySQL idempotent column addition
DROP PROCEDURE IF EXISTS `AddDealsOrderItemsSupport`;
DELIMITER $$
CREATE PROCEDURE `AddDealsOrderItemsSupport`()
BEGIN
  -- Check and add item_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'item_type'
  ) THEN
    ALTER TABLE `order_items`
      ADD COLUMN `item_type` VARCHAR(20) NOT NULL DEFAULT 'PRODUCT' AFTER `total`;
  END IF;

  -- Check and add deal_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'deal_id'
  ) THEN
    ALTER TABLE `order_items`
      ADD COLUMN `deal_id` VARCHAR(100) NULL AFTER `item_type`;
  END IF;

  -- Check and add deal_details column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'deal_details'
  ) THEN
    ALTER TABLE `order_items`
      ADD COLUMN `deal_details` LONGTEXT NULL AFTER `deal_id`;
  END IF;

  -- Add index on deal_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND INDEX_NAME = 'idx_order_items_deal_id'
  ) THEN
    ALTER TABLE `order_items` ADD INDEX `idx_order_items_deal_id` (`deal_id`);
  END IF;
END$$
DELIMITER ;

CALL `AddDealsOrderItemsSupport`();
DROP PROCEDURE IF EXISTS `AddDealsOrderItemsSupport`;

-- 3. Record migration execution in schema_migrations
INSERT IGNORE INTO `schema_migrations` (`version`, `executed_at`)
VALUES ('add_deals_order_support_2026_10_07', NOW());
