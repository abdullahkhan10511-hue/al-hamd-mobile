-- ==============================================================================
-- MIGRATION: Customer Inquiries & Complaints System
-- Al-Hamd Mobile Accessories
-- Version: 2026-10-04
--
-- Safe, additive, idempotent migration for customer contact inquiries & support complaints.
-- Preserves all existing tables, products, orders, customers, and inventory data.
-- ==============================================================================

-- 1. Ensure schema_migrations tracking table exists
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(100) NOT NULL PRIMARY KEY,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create customer_inquiries table if it does not already exist
CREATE TABLE IF NOT EXISTS `customer_inquiries` (
  `id` VARCHAR(100) NOT NULL,
  `reference_no` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NOT NULL,
  `inquiry_type` VARCHAR(100) NOT NULL,
  `order_number` VARCHAR(100) NULL,
  `subject` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'NEW',
  `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
  `admin_notes` TEXT NULL,
  `resolved_at` DATETIME NULL,
  `resolved_by` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_inquiries_ref` (`reference_no`),
  KEY `idx_inquiries_status` (`status`),
  KEY `idx_inquiries_priority` (`priority`),
  KEY `idx_inquiries_type` (`inquiry_type`),
  KEY `idx_inquiries_order_number` (`order_number`),
  KEY `idx_inquiries_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Record migration execution in schema_migrations
INSERT IGNORE INTO `schema_migrations` (`version`, `executed_at`)
VALUES ('add_customer_inquiries_2026_10_04', NOW());
