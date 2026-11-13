# AL-HAMD SHOP — STEP 15 IMPLEMENTATION REPORT
**Date:** November 13, 2026  
**System:** AL-HAMD SHOP (`al-hamd-app`)  
**Deployment Environment:** Hostinger Shared Hosting (Production) & Local Development  
**Status:** COMPLETE & 100% VERIFIED  

---

## Executive Summary

Step 15 introduces full administrator controls for storefront homepage marquee animations (Shop by Category, Shop by Brand) and the floating WhatsApp support button, with strict data safety, zero-downtime persistence, and graceful fallback handling:

1. **Storage Layer & MariaDB Compatibility:**
   - Additive SQL migration created at `scripts/migrations/add_site_ui_settings.sql`.
   - Table schema: `site_ui_settings` (`setting_key VARCHAR(100) PRIMARY KEY`, `setting_value TEXT NOT NULL`, `updated_by VARCHAR(255) NULL`, `updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).
   - If the database table is not yet installed, settings persist automatically in a local file fallback under `getDataDir()` (`data/site-ui-settings.json`).
   - The application functions seamlessly **before and after** running the migration.

2. **Access Control & Audit Logging:**
   - Added permission `settings.appearance` to `ALL_PERMISSIONS` in `lib/constants/permissions.ts`.
   - Accessible only to Owner and `SUPER_ADMIN` by default; custom staff require `settings.appearance`.
   - All settings updates are audited to `activity_logs` (`UPDATE_HOMEPAGE_ANIMATIONS`, `UPDATE_WHATSAPP_SETTINGS`).

3. **Homepage Marquee Animations (`/admin/homepage-animations`):**
   - Independent controls for **Shop by Category** and **Shop by Brand**.
   - **Styles:** `continuous` (infinite smooth marquee), `step` (card-by-card interval tick), `static` (clean horizontal row with desktop arrow buttons).
   - **Direction:** `ltr` (left-to-right) and `rtl` (right-to-left).
   - **Speed / Interval:** Slow (60s), Normal (40s/35s), Fast (20s/25s), or custom slider. Step intervals from 1.5s to 6s.
   - **Pause on Hover:** Interactive toggle.
   - **Edge Fade Mask:** Soft CSS gradient mask at left and right boundaries.
   - **Card Hover Effect:** `tilt` (interactive 3D perspective tilt via `<Tilt3D>`), `lift` (CSS `-translate-y-1` float with shadow), `none` (flat).
   - **Accessibility:** `prefers-reduced-motion` automatically disables continuous movement and renders a static, accessible scrollable row.
   - **Live Interactive Preview:** Real-time preview inside admin for both sections.

4. **Floating WhatsApp Button (`/admin/whatsapp`):**
   - **Master Toggle:** Enable / disable store-wide floating button.
   - **Phone Normalization:** Enforces 12-digit Pakistani mobile format `923XXXXXXXXX`. Accepts `0343 2200995`, `+92 343 2200995`, or `923432200995`. Rejects landlines and invalid network codes. Includes live "Test Link" button opening `https://wa.me/<number>`.
   - **Dynamic Tokens:** Default message supports `{page}` and `{url}` tokens, resolved dynamically to page titles and URLs (max 300 characters).
   - **Page Visibility Rules:** `all`, `except_checkout_cart` (hides on Cart & Checkout to prevent distraction), `homepage_only`.
   - **Homepage Hero Behavior:** `after_hero` (appears once hero section is scrolled past, `<25%` visible) vs `always` (visible from page load).
   - **Positioning:** `bottom_right` vs `bottom_left`.
   - **Label Text:** Optional label pill alongside the WhatsApp icon (e.g., "Chat with us").
   - **Storefront Clean-up:** Removed hardcoded instances of `923432200995` from `FloatingWhatsApp.tsx`, `app/checkout/page.tsx`, and `components/layout/Footer.tsx`.

---

## Modified & Created Files

| File | Status | Description |
|---|---|---|
| `scripts/migrations/add_site_ui_settings.sql` | Created | Additive `CREATE TABLE IF NOT EXISTS site_ui_settings` query |
| `lib/constants/permissions.ts` | Modified | Added `settings.appearance` permission |
| `lib/permissions.ts` | Modified | Added RBAC route checking for `/admin/homepage-animations` & `/admin/whatsapp` |
| `lib/db/siteUiSettings.ts` | Created | Isomorphic Zod schemas, defaults, Pakistani mobile normalizer & URL builder |
| `lib/db/repositories/siteUiSettings.ts` | Created | Server-only repository with MySQL & local fallback support, activity logging |
| `app/api/admin/ui-settings/route.ts` | Created | Admin GET/POST with CSRF check, rate limiting, and RBAC |
| `app/api/ui-settings/route.ts` | Created | Public GET with 60-second caching for client components |
| `app/admin/layout.tsx` | Modified | Added navigation items for Homepage Animations & WhatsApp Button |
| `app/admin/homepage-animations/page.tsx` | Created | Admin interface with live interactive preview for category & brand marquees |
| `app/admin/whatsapp/page.tsx` | Created | Admin interface with phone normalizer, live token preview & simulator |
| `components/ui/Marquee.tsx` | Modified | Added support for `style` (`continuous`, `step`, `static`), `edgeFade`, and arrow navigation |
| `components/ui/FloatingWhatsApp.tsx` | Modified | Accepts SSR `initialSettings`, dynamic URL builder, display rules, and position controls |
| `components/home/ShopByCategories.tsx` | Modified | Accepts `settings` prop, respects `cardHover` (`tilt`, `lift`, `none`), and passes animation rules |
| `components/home/ShopByBrands.tsx` | Modified | Accepts `settings` prop, respects `cardHover`, and passes animation rules |
| `app/page.tsx` | Modified | Server-side fetches animation settings and passes to categories & brands |
| `app/layout.tsx` | Modified | Server-side fetches WhatsApp settings and passes to `<FloatingWhatsApp>` |
| `app/checkout/page.tsx` | Modified | Replaced hardcoded WhatsApp number with dynamic settings integration |
| `components/layout/Footer.tsx` | Modified | Replaced hardcoded WhatsApp fallback with dynamic resolution |
| `scripts/verify-step15.mjs` | Created | 58 comprehensive automated tests covering all Step 15 requirements |
| `package.json` | Modified | Added `"verify:step15": "node scripts/verify-step15.mjs"` script |

---

## Security Backups

All modified files were safely backed up prior to edits in:
- `_security_backups/step15_20261113/`
  - `admin_layout/layout.tsx`
  - `checkout_page/page.tsx`
  - `contact_page/page.tsx`
  - `home_page/page.tsx`
  - `root_layout/layout.tsx`
  - `FloatingWhatsApp.tsx`
  - `Footer.tsx`
  - `Marquee.tsx`
  - `ShopByBrands.tsx`
  - `ShopByCategories.tsx`
  - `permissions.ts`
  - `lib_permissions.ts`

---

## Instructions for the Store Owner (Hostinger Deployment)

To enable MySQL/MariaDB database storage for UI settings across your production server:

1. Log into your **Hostinger Control Panel (cPanel)**.
2. Open **phpMyAdmin** and select your store's database.
3. Click the **SQL** tab.
4. Open [scripts/migrations/add_site_ui_settings.sql](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scripts/migrations/add_site_ui_settings.sql) and paste the SQL content:
   ```sql
   CREATE TABLE IF NOT EXISTS `site_ui_settings` (
     `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
     `setting_value` TEXT NOT NULL,
     `updated_by` VARCHAR(255) NULL,
     `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```
5. Click **Go**.
6. That's it! If you don't run the SQL immediately, the store will automatically continue saving and reading settings via its safe local fallback without any downtime or errors.

---

## Verification Results

| Test Suite | Command | Total Tests | Passed | Failed | Status |
|---|---|---|---|---|---|
| Step 15 Suite | `npm run verify:step15` | 58 | 58 | 0 | **PASS** |
| Animation & CLS Suite | `npm run verify:animation` | 16 | 16 | 0 | **PASS** (CLS: 0.0000) |
| Security & Hardening | `npm run verify:step14` | 20 | 20 | 0 | **PASS** |
| Step 7A Persistence Suite | `npm run verify:step7a` | 62 | 62 | 0 | **PASS** |
| TypeScript Compiler | `npx tsc --noEmit` | — | — | 0 | **PASS** |
| Production Webpack Build | `npm run build` | 109 Pages | 109 | 0 | **PASS** |

