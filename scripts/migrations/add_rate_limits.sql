-- ==============================================================================
-- AL-HAMD SHOP: Persistent Rate Limiting Table
-- Stores SHA-256 hashed keys for shared, distributed rate limiting.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS `rate_limits` (
  `key_hash` CHAR(64) NOT NULL,
  `count` INT NOT NULL DEFAULT 1,
  `reset_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`key_hash`),
  KEY `idx_rate_limits_reset` (`reset_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

