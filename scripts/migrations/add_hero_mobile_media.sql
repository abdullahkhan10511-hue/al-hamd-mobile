-- Migration: Add optional mobile media columns to homepage_videos
-- MariaDB / MySQL compatible, idempotent (safe to run more than once).
-- Run manually on production after taking a database backup.

ALTER TABLE homepage_videos
  ADD COLUMN IF NOT EXISTS mobile_url VARCHAR(500) NULL AFTER thumbnail_url,
  ADD COLUMN IF NOT EXISTS mobile_thumbnail_url VARCHAR(500) NULL AFTER mobile_url,
  ADD COLUMN IF NOT EXISTS mobile_mime_type VARCHAR(100) NULL AFTER mobile_thumbnail_url;

