-- ==============================================================================
-- ADD TWO-FACTOR AUTHENTICATION (TOTP) TO STAFF ACCOUNTS
-- Schema update for AL-HAMD SHOP Admin Security Hardening (Step 14 Phase 1)
-- Safe, additive migration: adds ONLY nullable columns.
-- App operates safely both BEFORE and AFTER this migration.
-- ==============================================================================

ALTER TABLE `staff_users`
  ADD COLUMN IF NOT EXISTS `totp_secret_enc` TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `totp_enabled` TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `totp_recovery_hashes` TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `totp_enrolled_at` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `session_version` INT DEFAULT 1;

