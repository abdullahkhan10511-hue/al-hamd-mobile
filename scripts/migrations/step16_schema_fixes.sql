-- =====================================================================
-- STEP 16 MIGRATION: STOREFRONT CATALOG AND PRODUCT VISIBILITY RECOVERY
-- Safe additive schema fixes and data healing for storefront visibility
-- =====================================================================

-- 1. Ensure `is_active` column exists on `products`
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'is_active';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname OR (TABLE_SCHEMA IS NULL AND @dbname IS NULL))
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE products ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER status;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Heal NULL or uninitialized `is_active` values in `products` (safe additive update)
UPDATE products SET is_active = 1 WHERE is_active IS NULL;

-- 3. Heal NULL or empty `status` values in `products`
UPDATE products SET status = 'active' WHERE status IS NULL OR TRIM(status) = '';

-- 4. Ensure `is_active` on `product_models`
SET @tablename = 'product_models';
SET @columnname = 'is_active';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname OR (TABLE_SCHEMA IS NULL AND @dbname IS NULL))
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE product_models ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER sku;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

UPDATE product_models SET is_active = 1 WHERE is_active IS NULL;

-- 5. Ensure `is_active` on `product_colors`
SET @tablename = 'product_colors';
SET @columnname = 'is_active';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname OR (TABLE_SCHEMA IS NULL AND @dbname IS NULL))
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE product_colors ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER hex;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

UPDATE product_colors SET is_active = 1 WHERE is_active IS NULL;

-- 6. Add composite index for storefront visibility filtering if not exists
SET @indexname = 'idx_products_storefront_visibility';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname OR (TABLE_SCHEMA IS NULL AND @dbname IS NULL))
      AND (TABLE_NAME = 'products')
      AND (INDEX_NAME = @indexname)
  ) > 0,
  "SELECT 1",
  "CREATE INDEX idx_products_storefront_visibility ON products (status, is_active, price);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

