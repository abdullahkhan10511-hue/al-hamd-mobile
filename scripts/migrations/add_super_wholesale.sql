-- ==============================================================================
-- MIGRATION: Add Super Wholesale Tier Support
-- Al-Hamd Mobile Accessories
-- ==============================================================================

-- 1. Add super_wholesale_price to products
ALTER TABLE `products`
  ADD COLUMN `super_wholesale_price` DECIMAL(12, 2) NULL AFTER `wholesale_price`;

-- 2. Add super_wholesale_price to product_models
ALTER TABLE `product_models`
  ADD COLUMN `super_wholesale_price` DECIMAL(12, 2) NULL AFTER `wholesale_price`;

-- 3. Update customer_type ENUM in customers
ALTER TABLE `customers`
  MODIFY COLUMN `customer_type` ENUM('RETAIL', 'WHOLESALE', 'SUPER_WHOLESALE') NOT NULL DEFAULT 'RETAIL';

-- 4. Update order_type and customer_type ENUMs in orders
ALTER TABLE `orders`
  MODIFY COLUMN `order_type` ENUM('wholesale', 'online', 'walk_in', 'super_wholesale') NOT NULL DEFAULT 'online',
  MODIFY COLUMN `customer_type` ENUM('RETAIL', 'WHOLESALE', 'SUPER_WHOLESALE') NOT NULL DEFAULT 'RETAIL';
