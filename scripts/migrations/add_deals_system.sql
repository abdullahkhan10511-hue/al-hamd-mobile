-- ==============================================================================
-- MIGRATION: Promotional Deals System
-- Al-Hamd Mobile Accessories
-- Version: 2026-10-06
--
-- Safe, additive, idempotent migration for the database-backed Deals system.
-- Preserves all existing tables, products, orders, customers, and inventory data.
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure schema_migrations tracking table exists
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(100) NOT NULL PRIMARY KEY,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Safely clean up any legacy banner table if it ever existed
DROP TABLE IF EXISTS `banners`;

-- 3. Create deals table
CREATE TABLE IF NOT EXISTS `deals` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `image` VARCHAR(1000) NULL,
  `deal_price` DECIMAL(12, 2) NULL DEFAULT 0.00,
  `original_price` DECIMAL(12, 2) NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
  `discount_percentage` INT NULL DEFAULT 0,
  `start_date` DATETIME NULL,
  `end_date` DATETIME NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `show_on_homepage` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_deals_slug` (`slug`),
  KEY `idx_deals_status` (`status`, `show_on_homepage`),
  KEY `idx_deals_order` (`display_order`),
  KEY `idx_deals_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create deal_products table (Promotional grouping of shop inventory items)
CREATE TABLE IF NOT EXISTS `deal_products` (
  `id` VARCHAR(100) NOT NULL,
  `deal_id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `model_id` VARCHAR(100) NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `model_name` VARCHAR(255) NULL,
  `sku` VARCHAR(100) NULL,
  `image` VARCHAR(1000) NULL,
  `category` VARCHAR(150) NULL,
  `brand` VARCHAR(100) NULL,
  `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `shop_stock` INT NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dp_deal` (`deal_id`, `sort_order`),
  KEY `idx_dp_product` (`product_id`),
  CONSTRAINT `fk_dp_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- 5. Record migration execution in schema_migrations
INSERT IGNORE INTO `schema_migrations` (`version`, `executed_at`)
VALUES ('add_deals_system_2026_10_06', NOW());
