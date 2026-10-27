-- ==============================================================================
-- AL-HAMD MOBILE ACCESSORIES - NON-DESTRUCTIVE DATABASE MIGRATION
-- Migration: Add password_reset_tokens table
-- Compatible with MySQL 5.7+ / 8.0+ and MariaDB 10.3+
-- Character set: utf8mb4, Collation: utf8mb4_unicode_ci
--
-- Security:
-- 1. Only cryptographic SHA-256 hashes of reset tokens are stored (never raw tokens).
-- 2. Single-use enforcement via is_used flag and used_at timestamp.
-- 3. Automatic expiration tracking via expires_at.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` VARCHAR(100) NOT NULL,
  `user_type` ENUM('customer', 'staff') NOT NULL DEFAULT 'customer',
  `user_id` VARCHAR(100) NULL,
  `email` VARCHAR(255) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `is_used` TINYINT(1) NOT NULL DEFAULT 0,
  `used_at` DATETIME NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_prt_token_hash` (`token_hash`),
  KEY `idx_prt_email_type` (`email`, `user_type`),
  KEY `idx_prt_status_expires` (`is_used`, `expires_at`),
  KEY `idx_prt_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
