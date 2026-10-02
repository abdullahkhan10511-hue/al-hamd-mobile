-- ==============================================================================
-- AL-HAMD MOBILE ACCESSORIES - PRODUCTION MYSQL DATABASE SCHEMA
-- Compatible with MySQL 5.7+ / 8.0+ and MariaDB 10.3+
-- Character set: utf8mb4, Collation: utf8mb4_unicode_ci
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. CATEGORIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `image` VARCHAR(1000) NOT NULL,
  `description` TEXT NULL,
  `product_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_categories_slug` (`slug`),
  KEY `idx_categories_status` (`status`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. BRANDS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `brands` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `logo` VARCHAR(1000) NULL,
  `description` TEXT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `product_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_brands_slug` (`slug`),
  KEY `idx_brands_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. PRODUCTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `tagline` VARCHAR(500) NULL,
  `description` TEXT NOT NULL,
  `long_description` LONGTEXT NULL,
  `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `compare_at_price` DECIMAL(12, 2) NULL,
  `wholesale_price` DECIMAL(12, 2) NULL,
  `super_wholesale_price` DECIMAL(12, 2) NULL,
  `discount_percentage` INT NULL,
  `category` VARCHAR(150) NOT NULL,
  `category_slug` VARCHAR(150) NOT NULL,
  `brand` VARCHAR(100) NOT NULL,
  `origin` VARCHAR(100) NULL,
  `sku` VARCHAR(100) NULL,
  `stock` INT NOT NULL DEFAULT 0,
  `low_stock_threshold` INT NOT NULL DEFAULT 5,
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
  `review_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_new` TINYINT(1) NOT NULL DEFAULT 0,
  `is_new_arrival` TINYINT(1) NOT NULL DEFAULT 0,
  `is_best_seller` TINYINT(1) NOT NULL DEFAULT 0,
  `is_sale` TINYINT(1) NOT NULL DEFAULT 0,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `trending` TINYINT(1) NOT NULL DEFAULT 0,
  `enable_model_selection` TINYINT(1) NOT NULL DEFAULT 0,
  `enable_color_selection` TINYINT(1) NOT NULL DEFAULT 0,
  `specifications` JSON NULL,
  `features` JSON NULL,
  `tags` JSON NULL,
  `variants` JSON NULL,
  `shipping_info` TEXT NULL,
  `returns_info` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_products_slug` (`slug`),
  UNIQUE KEY `idx_products_sku` (`sku`),
  KEY `idx_products_category_slug` (`category_slug`),
  KEY `idx_products_brand` (`brand`),
  KEY `idx_products_status_active` (`status`, `is_active`),
  KEY `idx_products_price` (`price`),
  KEY `idx_products_badges` (`is_new_arrival`, `is_best_seller`, `featured`, `trending`),
  KEY `idx_products_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. PRODUCT MEDIA (Gallery Images, Videos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_media` (
  `id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `media_type` ENUM('image', 'video') NOT NULL DEFAULT 'image',
  `url` VARCHAR(1000) NOT NULL,
  `name` VARCHAR(255) NULL,
  `size` INT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_product` (`product_id`, `sort_order`),
  CONSTRAINT `fk_media_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. PRODUCT MODELS / VARIANTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_models` (
  `id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `compare_at_price` DECIMAL(12, 2) NULL,
  `wholesale_price` DECIMAL(12, 2) NULL,
  `super_wholesale_price` DECIMAL(12, 2) NULL,
  `stock` INT NOT NULL DEFAULT 0,
  `sku` VARCHAR(100) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `images` JSON NULL,
  `videos` JSON NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_models_product` (`product_id`, `sort_order`),
  KEY `idx_models_sku` (`sku`),
  CONSTRAINT `fk_models_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. PRODUCT COLORS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_colors` (
  `id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `hex` VARCHAR(20) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_colors_product` (`product_id`, `sort_order`),
  CONSTRAINT `fk_colors_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. PRODUCT BULK PRICING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_bulk_pricing` (
  `id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `min_qty` INT NOT NULL,
  `max_qty` INT NOT NULL,
  `discount_percentage` DECIMAL(5, 2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bulk_pricing_product` (`product_id`),
  CONSTRAINT `fk_bulk_pricing_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. PRODUCT REVIEWS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_reviews` (
  `id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `author` VARCHAR(150) NOT NULL,
  `author_email` VARCHAR(255) NULL,
  `rating` INT NOT NULL DEFAULT 5,
  `title` VARCHAR(255) NULL,
  `comment` TEXT NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reviews_product` (`product_id`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. CUSTOMERS & WHOLESALE ACCOUNTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` VARCHAR(100) NOT NULL,
  `customer_type` ENUM('RETAIL', 'WHOLESALE', 'SUPER_WHOLESALE') NOT NULL DEFAULT 'RETAIL',
  `shop_name` VARCHAR(255) NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(150) NOT NULL,
  `last_name` VARCHAR(150) NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `password_salt` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `city` VARCHAR(100) NULL,
  `province` VARCHAR(100) NULL,
  `postal_code` VARCHAR(50) NULL,
  `date_of_birth` VARCHAR(50) NULL,
  `total_orders` INT NOT NULL DEFAULT 0,
  `total_spent` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('active', 'suspended', 'deactivated', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_email` (`email`),
  KEY `idx_customers_shop_name` (`shop_name`),
  KEY `idx_customers_type_status` (`customer_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. STAFF / ADMIN USERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `staff_users` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `role` VARCHAR(100) NOT NULL DEFAULT 'Manager',
  `role_id` VARCHAR(100) NULL,
  `permissions` JSON NOT NULL,
  `avatar` VARCHAR(1000) NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `is_owner` TINYINT(1) NOT NULL DEFAULT 0,
  `password_hash` VARCHAR(255) NOT NULL,
  `salt` VARCHAR(255) NOT NULL,
  `last_login` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_staff_email` (`email`),
  KEY `idx_staff_status_role` (`status`, `role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 11. ORDERS (Online, Wholesale, POS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(100) NOT NULL,
  `invoice_number` VARCHAR(100) NOT NULL,
  `order_type` ENUM('wholesale', 'online', 'walk_in', 'super_wholesale') NOT NULL DEFAULT 'online',
  `customer_type` ENUM('RETAIL', 'WHOLESALE', 'SUPER_WHOLESALE') NOT NULL DEFAULT 'RETAIL',
  `shop_name` VARCHAR(255) NULL,
  `wholesale_account_id` VARCHAR(100) NULL,
  `customer_id` VARCHAR(100) NULL,
  `customer_first_name` VARCHAR(150) NOT NULL,
  `customer_last_name` VARCHAR(150) NULL,
  `customer_email` VARCHAR(255) NULL,
  `customer_phone` VARCHAR(50) NOT NULL,
  `shipping_street` TEXT NULL,
  `shipping_city` VARCHAR(100) NULL,
  `shipping_postal_code` VARCHAR(50) NULL,
  `shipping_country` VARCHAR(100) NULL DEFAULT 'Pakistan',
  `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `shipping` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'PKR',
  `delivery_method` VARCHAR(50) NOT NULL DEFAULT 'standard',
  `payment_method` VARCHAR(100) NOT NULL DEFAULT 'Cash on Delivery',
  `payment_method_id` VARCHAR(50) NULL,
  `payment_status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `payment_reference` VARCHAR(255) NULL,
  `payment_verification` JSON NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Confirmed',
  `notes` TEXT NULL,
  `order_source` ENUM('ONLINE', 'POS') NOT NULL DEFAULT 'ONLINE',
  `cashier_id` VARCHAR(100) NULL,
  `cashier_name` VARCHAR(150) NULL,
  `cashier_email` VARCHAR(255) NULL,
  `amount_paid` DECIMAL(12, 2) NULL,
  `change_given` DECIMAL(12, 2) NULL,
  `pos_discount_type` VARCHAR(20) NULL,
  `pos_discount_value` DECIMAL(12, 2) NULL,
  `pos_discount_reason` VARCHAR(255) NULL,
  `promo_code` VARCHAR(50) NULL,
  `promo_discount_type` VARCHAR(20) NULL,
  `promo_discount_value` DECIMAL(12, 2) NULL,
  `promo_discount_amount` DECIMAL(12, 2) NULL,
  `promo_details` JSON NULL,
  `voided_by` VARCHAR(150) NULL,
  `voided_at` DATETIME NULL,
  `void_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_orders_invoice` (`invoice_number`),
  KEY `idx_orders_source_status` (`order_source`, `status`),
  KEY `idx_orders_customer` (`customer_id`, `customer_email`),
  KEY `idx_orders_wholesale` (`wholesale_account_id`),
  KEY `idx_orders_payment_status` (`payment_status`),
  KEY `idx_orders_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 12. ORDER ITEMS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NULL,
  `sku` VARCHAR(100) NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL,
  `original_price` DECIMAL(12, 2) NULL,
  `discount_percentage` INT NULL,
  `quantity` INT NOT NULL,
  `selected_size` VARCHAR(50) NULL,
  `selected_color` VARCHAR(100) NULL,
  `selected_model` VARCHAR(150) NULL,
  `image` VARCHAR(1000) NULL,
  `total` DECIMAL(12, 2) NOT NULL,
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 13. PROMOTIONS / PROMO CODES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `promotions` (
  `id` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `description` TEXT NULL,
  `discount_type` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  `discount_value` DECIMAL(12, 2) NOT NULL,
  `maximum_discount` DECIMAL(12, 2) NULL,
  `minimum_order_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `start_date` DATETIME NULL,
  `expiry_date` DATETIME NULL,
  `usage_limit` INT NULL,
  `per_customer_limit` INT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `applicable_type` ENUM('all', 'products', 'categories') NOT NULL DEFAULT 'all',
  `applicable_products` JSON NULL,
  `applicable_categories` JSON NULL,
  `customer_restrictions` ENUM('all', 'specific', 'new', 'existing') NOT NULL DEFAULT 'all',
  `specific_customer_emails` JSON NULL,
  `pos_allowed` TINYINT(1) NOT NULL DEFAULT 1,
  `online_allowed` TINYINT(1) NOT NULL DEFAULT 1,
  `used_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_promotions_code` (`code`),
  KEY `idx_promotions_active` (`is_active`, `expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 14. PROMO CODE USAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `promo_code_usages` (
  `id` VARCHAR(100) NOT NULL,
  `promo_code_id` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `order_id` VARCHAR(100) NOT NULL,
  `invoice_number` VARCHAR(100) NOT NULL,
  `customer_id` VARCHAR(100) NULL,
  `customer_name` VARCHAR(150) NULL,
  `customer_email` VARCHAR(255) NULL,
  `customer_phone` VARCHAR(50) NULL,
  `discount_amount` DECIMAL(12, 2) NOT NULL,
  `order_total` DECIMAL(12, 2) NOT NULL,
  `channel` ENUM('ONLINE', 'POS') NOT NULL DEFAULT 'ONLINE',
  `used_by` VARCHAR(150) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_promo_usage_code` (`code`),
  KEY `idx_promo_usage_order` (`order_id`),
  KEY `idx_promo_usage_customer` (`customer_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 15. STORE SETTINGS & SEO METADATA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_settings` (
  `id` INT NOT NULL DEFAULT 1,
  `store_name` VARCHAR(255) NOT NULL,
  `store_tagline` VARCHAR(500) NULL,
  `logo_url` VARCHAR(1000) NULL,
  `favicon_url` VARCHAR(1000) NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `address` TEXT NOT NULL,
  `whatsapp` VARCHAR(50) NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'PKR',
  `currency_symbol` VARCHAR(10) NOT NULL DEFAULT 'Rs.',
  `free_shipping_threshold` DECIMAL(12, 2) NOT NULL DEFAULT 5000.00,
  `standard_shipping_fee` DECIMAL(12, 2) NOT NULL DEFAULT 200.00,
  `express_shipping_fee` DECIMAL(12, 2) NOT NULL DEFAULT 450.00,
  `delivery_message` VARCHAR(500) NULL,
  `estimated_delivery_text` VARCHAR(255) NULL,
  `pakistan_only` TINYINT(1) NOT NULL DEFAULT 1,
  `tax_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `social_links` JSON NULL,
  `seo_meta_title` VARCHAR(500) NULL,
  `seo_meta_description` TEXT NULL,
  `seo_keywords` JSON NULL,
  `seo_logo_url` VARCHAR(1000) NULL,
  `seo_favicon_url` VARCHAR(1000) NULL,
  `footer_description` TEXT NULL,
  `business_hours` VARCHAR(255) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 16. BILL SETTINGS (Thermal Invoices & POS Receipts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bill_settings` (
  `id` INT NOT NULL DEFAULT 1,
  `store_name` VARCHAR(255) NOT NULL,
  `store_logo` VARCHAR(1000) NULL,
  `store_address` TEXT NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `whatsapp` VARCHAR(50) NULL,
  `email` VARCHAR(255) NOT NULL,
  `website` VARCHAR(255) NULL,
  `invoice_header_text` TEXT NULL,
  `invoice_footer_text` TEXT NULL,
  `tax_number` VARCHAR(100) NULL,
  `thermal_footer_note` TEXT NULL,
  `template_config` LONGTEXT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 17. ACTIVITY LOGS (Admin / Staff audit trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` VARCHAR(100) NOT NULL,
  `admin_email` VARCHAR(255) NOT NULL,
  `action` VARCHAR(150) NOT NULL,
  `target` VARCHAR(255) NOT NULL,
  `details` TEXT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_admin` (`admin_email`),
  KEY `idx_activity_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 18. INVENTORY LOGS (Stock adjustments & audit history)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_logs` (
  `id` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(100) NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NULL,
  `change_amount` INT NOT NULL,
  `previous_stock` INT NOT NULL,
  `new_stock` INT NOT NULL,
  `reason` VARCHAR(500) NULL,
  `admin_email` VARCHAR(255) NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_product` (`product_id`),
  KEY `idx_inv_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 19. CUSTOM PAGES & LEGAL POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `custom_pages` (
  `id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `status` ENUM('Published', 'Draft', 'Hidden') NOT NULL DEFAULT 'Published',
  `show_in_header` TINYINT(1) NOT NULL DEFAULT 0,
  `show_in_footer` TINYINT(1) NOT NULL DEFAULT 1,
  `show_in_mobile` TINYINT(1) NOT NULL DEFAULT 0,
  `footer_category` VARCHAR(50) NULL,
  `seo_title` VARCHAR(255) NULL,
  `seo_description` TEXT NULL,
  `target_keywords` JSON NULL,
  `seo_image` VARCHAR(1000) NULL,
  `blocks` JSON NOT NULL,
  `page_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_custom_pages_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 20. HOMEPAGE VIDEOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `homepage_videos` (
  `id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `url` VARCHAR(1000) NOT NULL,
  `thumbnail_url` VARCHAR(1000) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `duration` INT NULL,
  `size` INT NULL,
  `mime_type` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 21. LOGIN PAGE MEDIA & SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_page_media` (
  `id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `type` ENUM('image', 'video') NOT NULL DEFAULT 'image',
  `url` VARCHAR(1000) NOT NULL,
  `thumbnail_url` VARCHAR(1000) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `size` INT NULL,
  `mime_type` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_page_settings` (
  `id` INT NOT NULL DEFAULT 1,
  `theme` VARCHAR(50) NOT NULL DEFAULT 'default',
  `overlay_opacity` DECIMAL(3, 2) NOT NULL DEFAULT 0.60,
  `headline` VARCHAR(255) NULL,
  `subheadline` TEXT NULL,
  `media_type` VARCHAR(50) NOT NULL DEFAULT 'mixed',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
