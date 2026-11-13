# AL-HAMD SHOP — Development Data Directory

## Overview
The files in this directory (`/data/*.json`) serve **exclusively** as local development and offline mock fallbacks when developing without a live database.

## Strict Production Policy
1. **Zero JSON Fallbacks in Production**:
   When running in production (`NODE_ENV === 'production'`), MySQL/MariaDB is mandatory. All business entities (products, categories, brands, orders, customer records, staff users, settings) are loaded strictly and authoritatively from the database.
2. **Fail Closed**:
   If the database connection fails in production, the application will fail closed (returning appropriate HTTP 503 / 500 error responses) and will **NEVER** silently fall back to reading from local JSON files.
3. **Data Integrity & Security**:
   - Never commit sensitive production customer data, staff credentials, or production database dumps into this directory.
   - All `data/*.json` files are excluded by `.gitignore` to prevent inadvertent tracking.
   - Do NOT delete files in this directory during security hardening; instead, ignore them so local dev environments remain operational without crashing.

## Production Startup Warning
When starting in production, ensure:
- `SESSION_SECRET` is set with at least 32 cryptographically random characters.
- `ADMIN_EMAIL` and database connection credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) are properly configured in `.env.production`.
- `ALLOW_DATA_MIGRATION` must remain unset or `false`.

