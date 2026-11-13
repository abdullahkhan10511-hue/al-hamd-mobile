-- ==============================================================================
-- AL-HAMD SHOP: Widen Password Hash Columns for scrypt Support (~170 chars)
-- Safe, idempotent column modification for existing production databases.
-- ==============================================================================

-- 1. Customers and Wholesale Accounts
ALTER TABLE `customers` 
  MODIFY COLUMN `password_hash` VARCHAR(255) NULL,
  MODIFY COLUMN `password_salt` VARCHAR(255) NULL;

-- 2. Staff and Administrative Accounts
ALTER TABLE `staff_users` 
  MODIFY COLUMN `password_hash` VARCHAR(255) NOT NULL,
  MODIFY COLUMN `salt` VARCHAR(255) NOT NULL;

