-- ==============================================================================
-- AL-HAMD SHOP — SITE UI SETTINGS TABLE MIGRATION (STEP 15)
-- Compatible with MySQL 8.0+ and MariaDB 10.5+
--
-- DATA SAFETY GUARANTEE:
-- - 100% ADDITIVE: ONLY CREATE TABLE IF NOT EXISTS.
-- - ZERO destructive actions (NO DROP, NO TRUNCATE, NO DELETE).
-- - Safe to run multiple times without error.
--
-- INSTRUCTIONS FOR STORE OWNER:
-- 1. In Hostinger cPanel / phpMyAdmin, select your database.
-- 2. Open the SQL tab, paste the query below, and click 'Go'.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS `site_ui_settings` (
  `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `updated_by` VARCHAR(255) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

