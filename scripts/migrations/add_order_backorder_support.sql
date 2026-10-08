-- ==============================================================================
-- MIGRATION: Add Backorder and Stock Shortage Support to Orders & Order Items
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

-- 2. Add backorder tracking columns to orders and order_items if not already present
DROP PROCEDURE IF EXISTS `AddBackorderSupport`;
DELIMITER $$
CREATE PROCEDURE `AddBackorderSupport`()
BEGIN
  -- Add has_backorder column to orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'has_backorder'
  ) THEN
    ALTER TABLE `orders`
      ADD COLUMN `has_backorder` TINYINT(1) NOT NULL DEFAULT 0 AFTER `promo_details`;
  END IF;

  -- Add stock_status column to orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'stock_status'
  ) THEN
    ALTER TABLE `orders`
      ADD COLUMN `stock_status` VARCHAR(50) NOT NULL DEFAULT 'IN_STOCK' AFTER `has_backorder`;
  END IF;

  -- Add fulfilled_quantity column to order_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'fulfilled_quantity'
  ) THEN
    ALTER TABLE `order_items`
      ADD COLUMN `fulfilled_quantity` INT NULL AFTER `deal_details`;
  END IF;

  -- Add backordered_quantity column to order_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'backordered_quantity'
  ) THEN
    ALTER TABLE `order_items`
      ADD COLUMN `backordered_quantity` INT NULL AFTER `fulfilled_quantity`;
  END IF;
END$$
DELIMITER ;

CALL `AddBackorderSupport`();
DROP PROCEDURE IF EXISTS `AddBackorderSupport`;

-- 3. Record migration execution in schema_migrations
INSERT IGNORE INTO `schema_migrations` (`version`, `executed_at`)
VALUES ('add_order_backorder_support_2026_10_07', NOW());
