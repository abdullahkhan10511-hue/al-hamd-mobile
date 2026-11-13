-- ==============================================================================
-- AL-HAMD SHOP — STEP 14 PERFORMANCE & HARDENING DATABASE INDEXES
-- Single Source of Truth: MariaDB 10.5+ / MySQL 8.0+ Compatible
--
-- DATA SAFETY GUARANTEE:
-- - 100% ADDITIVE: ONLY CREATE INDEX IF NOT EXISTS statements.
-- - ZERO destructive actions (NO DROP, NO TRUNCATE, NO ALTER TABLE DROP).
-- - ZERO table locks or data modifications.
--
-- INSTRUCTIONS FOR STORE OWNER:
-- 1. Create a full database backup in cPanel / phpMyAdmin -> Export -> Quick -> SQL.
-- 2. Open phpMyAdmin on Hostinger.
-- 3. Select your database (e.g., `u123456789_alhamd`).
-- 4. Open the SQL tab, paste the contents of this file, and click 'Go'.
-- ==============================================================================

-- 1. Staff Authentication & Session Versioning Indexes
CREATE INDEX IF NOT EXISTS `idx_staff_email_status`
  ON `staff_users` (`email`, `status`);

CREATE INDEX IF NOT EXISTS `idx_staff_id_session_version`
  ON `staff_users` (`id`, `session_version`);

-- 2. Order Performance & Filtering Indexes
CREATE INDEX IF NOT EXISTS `idx_orders_customer_type_created`
  ON `orders` (`customer_type`, `created_at`);

CREATE INDEX IF NOT EXISTS `idx_orders_order_source_created`
  ON `orders` (`order_source`, `created_at`);

CREATE INDEX IF NOT EXISTS `idx_orders_payment_status`
  ON `orders` (`payment_status`);

CREATE INDEX IF NOT EXISTS `idx_orders_customer_id`
  ON `orders` (`customer_id`);

-- 3. Audit & Inventory Log Query Acceleration
CREATE INDEX IF NOT EXISTS `idx_activity_admin_timestamp`
  ON `activity_logs` (`admin_email`, `timestamp`);

CREATE INDEX IF NOT EXISTS `idx_inventory_product_timestamp`
  ON `inventory_logs` (`product_id`, `timestamp`);

