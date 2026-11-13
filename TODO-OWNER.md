# AL-HAMD SHOP — Store Owner Action Items (TODO-OWNER)

This document lists all action items where real physical data, original store photography, verified social media accounts, or actual customer reviews should be provided by the store owner (**AL-HAMD SHOP**, Mandi Bahauddin, Pakistan).

---

## 1. Product Photography (High Priority)

The template originally used generic external Unsplash stock images. All products have now been safely migrated to branded local SVGs (`/placeholders/...`). Please capture real, clean, white-background or shop-counter photos of your inventory and upload them via the Admin Panel (`/admin/products`):

| Product ID | Product Name | Brand | Recommended Photos to Take | Current Placeholder |
|---|---|---|---|---|
| `prod-15` | Apple AirPods Pro (2nd Gen) | Apple | Retail box front, charging case open showing earbuds, USB-C port | `/placeholders/earbuds.svg` |
| `prod-16` | Anker 20,000mAh Power Bank | Anker | Front face showing LED indicators, top ports (USB-C & USB-A) | `/placeholders/powerbank.svg` |
| `prod-chg-01` | Anker 65W GaN Fast Charger | Anker | Prongs / plug, multi-port face, packaging | `/placeholders/charger.svg` |
| `prod-cbl-01` | Braided USB-C to USB-C Fast Cable | Anker / UGREEN | Coiled cable, metal connectors close-up | `/placeholders/cable.svg` |
| `prod-case-01` | MagSafe Armor Shockproof Case (iPhone 15 Pro) | Spigen / ESR | Back case showing camera protection ring, side tactile buttons | `/placeholders/case.svg` |
| `prod-case-02` | Tough Armor Kickstand Case (Galaxy S24 Ultra) | Spigen | Kickstand extended on desk, corner shock absorber cushions | `/placeholders/case.svg` |
| `prod-screen-01` | ESR 9H Tempered Glass Screen Protector | ESR | Retail 2-pack kit showing alignment frame and cleaning wipes | `/placeholders/general.svg` |

> **Photo Tips for Mobile Accessories:**
> - Take pictures under bright natural light or a ring light.
> - Take at least 2 angles per product: 1 frontal overview and 1 close-up of ports/connectors/features.
> - Recommended image size: 800 x 800 px (square aspect ratio) or 1000 x 1000 px in JPG or WebP format.

---

## 2. Category Banners & Icons

Category cards on `/categories` and homepage sliders have been transitioned to local vector placeholders. Update category images in Admin Panel (`/admin/categories`):
- [ ] **TWS & Bluetooth Earbuds:** Real photo of earbud cases on your shop display shelf.
- [ ] **Power Banks:** High-capacity power banks display.
- [ ] **Fast Chargers & Adapters:** Wall chargers and travel adapters.
- [ ] **Cables & Converters:** Fast charging Type-C, Lightning, and OTG adapters.
- [ ] **Cases & Covers:** Clear cases, silicone cases, and rugged protective covers.
- [ ] **Screen Protectors:** 9H tempered glass, privacy matte glass, UV curved glass.

---

## 3. Brand Partner Logos & Relationships

In accordance with truth-in-advertising guidelines, all fake "Verified Partner" badges have been removed from brand displays.
- [ ] Review your brand list (`/admin/brands`) and disable or delete any brands you do not currently keep in stock in Mandi Bahauddin.
- [ ] Upload official high-resolution transparent PNG logos for brands you actively stock (e.g., Anker, Baseus, UGREEN, Spigen, Faster, Ronin, Audionic).

---

## 4. Official Social Media Profiles

In Store Settings (`/admin/settings` -> Social Links), update the destination URLs for the store's social channels:
- [x] **WhatsApp:** Configured to `+92 343 2200995` with pre-filled order and chat assistance templates.
- [ ] **Facebook Page:** Provide real Facebook page URL (e.g. `https://facebook.com/alhamdshopmbdin`) or leave disabled.
- [ ] **Instagram Account:** Provide real Instagram profile handle (e.g. `https://instagram.com/alhamdshop.pk`) or leave disabled.
- [ ] **TikTok:** Provide real TikTok business handle or leave disabled.

---

## 5. Authentic Customer Reviews & Testimonials

All artificial ratings (such as *"Rated 4.9/5 by 50,000+ customers"*) and fake 5-star badges on unreviewed items have been removed. Products with 0 reviews now cleanly display *"No reviews yet"*.
- [ ] Encourage satisfied local walk-in customers and WhatsApp buyers to leave verified reviews on product detail pages.
- [ ] Approve submitted authentic customer reviews in Admin Panel (`/admin/reviews`).

---

## 6. Official Bank Account Information (for Direct Bank Transfer)

If accepting Direct Bank Transfer during checkout, verify the bank details shown in the payment gateway configuration (`/admin/settings/payment-methods`):
- [ ] **Bank Name:** (e.g., Habib Bank Limited / Meezan Bank / Bank Alfalah)
- [ ] **Account Title:** (e.g., AL HAMD MOBILE or Proprietor Name)
- [ ] **Account Number / IBAN:** (e.g., PK...HABB...)
- [ ] **Branch Code & City:** Mandi Bahauddin

---

## 7. Security Hardening Step 2 Deployment Actions

When deploying Security Hardening Step 2 to the live production server (`alhamdshop.com`):
- [ ] **Active Sessions Notice:**
  Customer sessions have migrated from unsigned JSON cookies to cryptographically signed tokens (`c1.*`), and the legacy cookie name `admin_session` has been retired. Existing logged-in customers and staff will simply need to log in again once after deployment.
- [ ] **Verify Production Secret:**
  Ensure that `SESSION_SECRET` in `.env.local` is set to a cryptographically strong string of at least 32 characters (`openssl rand -hex 32`).
- [ ] **Verify Allowed Origins (Optional):**
  If managing the site through additional custom domains or CDNs, add them to `ALLOWED_ORIGINS` in `.env.local` (e.g. `ALLOWED_ORIGINS=https://alhamdshop.com,https://www.alhamdshop.com`).
- [ ] **Run Automated Post-Deployment Verification:**
  Run `npm run verify:step2` (or `node scripts/verify-step2.mjs`) on the server to verify all 36 security checks pass.

---

## 8. Security Hardening Step 3 Deployment Actions

When deploying Security Hardening Step 3 to the live production server (`alhamdshop.com`):

- [ ] **Run Database Migrations (Required):**
  Apply the two safe, idempotent migration files to your MySQL database:
  ```bash
  mysql -u <db_user> -p <db_name> < scripts/migrations/widen_password_hash_columns.sql
  mysql -u <db_user> -p <db_name> < scripts/migrations/add_rate_limits.sql
  ```
  *(Or execute them through phpMyAdmin / MySQL Workbench / Cloud hosting SQL console).*

- [ ] **Configure Reverse Proxy Settings (if applicable):**
  If `alhamdshop.com` is hosted behind a reverse proxy (e.g., Cloudflare, Nginx, LiteSpeed, or Caddy):
  Add to `.env.local`:
  ```bash
  TRUST_PROXY=true
  TRUSTED_PROXY_HOPS=1
  ```
  If hosting directly on Node without an external reverse proxy, leave `TRUST_PROXY=false` (the default) so client-supplied `X-Forwarded-For` headers are safely ignored.

- [ ] **Password Security & Transparent Migration:**
  - **No user action needed:** All existing customers, wholesale shops, and staff accounts can log in using their existing passwords.
  - Upon first successful sign in, the system automatically and silently upgrades their stored hash to GPU-resistant `scrypt` ($N=32768, r=8, p=1$).
  - Any new customer registration, password change, or admin staff setup will now require a strong password (minimum 10 characters, at least 3 character classes: uppercase, lowercase, numbers, symbols, and not present in the common password denylist).

- [ ] **Run Automated Post-Deployment Verification:**
  Run the complete test suite on the server to verify all checks pass:
  ```bash
  npm run verify:step1
  npm run verify:step2
  npm run verify:step3
  ```



