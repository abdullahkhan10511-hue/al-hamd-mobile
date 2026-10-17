-- ==============================================================================
-- ROLLBACK: Customer Email Uniqueness Constraint
-- Al-Hamd Mobile Accessories
-- Version: 2026-10-17
--
-- Rollback migration for customer email uniqueness constraint.
-- Drops idx_customers_email_unique index if present.
-- ==============================================================================

SET @index_exists = (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND INDEX_NAME = 'idx_customers_email_unique'
);

SET @sql_stmt = IF(@index_exists > 0,
  'ALTER TABLE `customers` DROP INDEX `idx_customers_email_unique`',
  'SELECT "Index idx_customers_email_unique does not exist" AS notice'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE FROM `schema_migrations` WHERE `version` = 'add_customer_email_unique_2026_10_17';
