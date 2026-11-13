-- ==============================================================================
-- AL-HAMD SHOP — STEP 8 DATABASE PERFORMANCE INDEXES MIGRATION
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

-- 1. Status and Activity Composite Index
-- Powers storefront product queries filtering by status and active flag
CREATE INDEX IF NOT EXISTS `idx_products_status_active`
  ON `products` (`status`, `is_active`);

-- 2. Category Slugs and Categories Filter Index
-- Speeds up category listing pages (/category/[slug] and /api/products?category=...)
CREATE INDEX IF NOT EXISTS `idx_products_category_slug`
  ON `products` (`category_slug`);

CREATE INDEX IF NOT EXISTS `idx_products_category`
  ON `products` (`category`);

-- 3. Brand Slugs and Brands Filter Index
-- Speeds up brand listing pages (/brand/[slug] and /api/products?brand=...)
CREATE INDEX IF NOT EXISTS `idx_products_brand`
  ON `products` (`brand`);

-- 4. Creation Date Sorting Index
-- Speeds up ORDER BY created_at DESC for New Arrivals and default catalog sorting
CREATE INDEX IF NOT EXISTS `idx_products_created_at`
  ON `products` (`created_at`);

-- 5. Product Slug Index
-- Ensures instant single-row lookups for product detail pages (/product/[slug])
CREATE INDEX IF NOT EXISTS `idx_products_slug`
  ON `products` (`slug`);

-- 6. Price Sorting Index
-- Speeds up ORDER BY price ASC / DESC on shop catalog and category filters
CREATE INDEX IF NOT EXISTS `idx_products_price`
  ON `products` (`price`);

-- 7. Badge Flags Composite Index
-- Speeds up homepage hero sections: Best Sellers, New Arrivals, Featured, Trending
CREATE INDEX IF NOT EXISTS `idx_products_badges`
  ON `products` (`is_new_arrival`, `is_best_seller`, `featured`, `trending`);

-- 8. Product Media Ordering Composite Index
-- Eliminates filesort when batch-loading gallery media for product cards and details
CREATE INDEX IF NOT EXISTS `idx_product_media_product_sort`
  ON `product_media` (`product_id`, `sort_order`);

-- 9. Product Models Ordering Composite Index
-- Eliminates filesort when batch-loading model variants
CREATE INDEX IF NOT EXISTS `idx_product_models_product_sort`
  ON `product_models` (`product_id`, `sort_order`);

-- 10. Product Colors Ordering Composite Index
-- Eliminates filesort when batch-loading color variants
CREATE INDEX IF NOT EXISTS `idx_product_colors_product_sort`
  ON `product_colors` (`product_id`, `sort_order`);

