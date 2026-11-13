# AL-HAMD SHOP — Technical Changelog

All notable technical updates, performance optimizations, bug fixes, trust corrections, and UX enhancements applied to the AL-HAMD SHOP project (`alhamdshop.com`).

---

## Phase 1: Technical Audit & Baseline Verification
- **Baseline Mobile Lighthouse Audit:** Executed full mobile audit via headless Chrome. Recorded baseline scores: Performance 78 (cold start 59), Accessibility 92, Best Practices 96, SEO 100, LCP 1.1s–6.0s, TBT 820ms, Speed Index 4.4s.
- **Route-by-Route HTTP Audit:** Automated test across 19 storefront routes. Found 1 broken 404 route (`/product/anker-20000mah-power-bank`), 7 routes with missing `<h1>` tags, and recurring 401 & 404 network errors in the browser console.
- **Deliverable:** Created [`AUDIT.md`](./AUDIT.md) with comprehensive findings, performance breakdown, and phased remediation plan.

---

## Phase 2: Functionality & Interactive Elements
- **Resolved 401 Console Error on Storefront Mount:**
  - *File modified:* `lib/db/pages.ts`
  - Fixed `syncPagesFromApi()` which was unconditionally pinging `/api/admin/pages` without admin credentials. Added check for stored admin tokens before requesting admin endpoints; regular visitors now cleanly query the public `/api/pages` endpoint.
- **Fixed Product Purging Bug (Restored 200 OK on Valid Accessories):**
  - *Files modified:* `lib/db/products.ts`, `lib/db/storage.ts`
  - Removed hardcoded purge filters that were deleting valid mobile accessory products (`prod-15` Apple AirPods Pro 2 and `prod-16` Anker 20,000mAh Power Bank).
- **Fixed Branding Logo 404 Error:**
  - *File modified:* `data/store-settings.json`
  - Removed references to non-existent uploads (`logo_1791481512938_111.png` and `favicon_1791481518108_111.png`), restoring reliable SVG and system favicon (`/favicon.ico`).
- **Enhanced Checkout Validation & Double-Submission Guard:**
  - *File modified:* `app/checkout/page.tsx`
  - Added strict Pakistani mobile phone format validation (`/^(\+92|0)?3[0-9]{9}$/`) with helpful inline user prompts.
  - Added 'Mandi Bahauddin' to the quick-select city suggestions.
  - Added direct "Confirm on WhatsApp" instant action button on the order success screen.

---

## Phase 3: Speed & Performance Optimization
- **Eliminated Global Forced Dynamic Rendering:**
  - *File modified:* `app/layout.tsx`
  - Removed top-level `export const dynamic = 'force-dynamic'` and `revalidate = 0` from the root layout, enabling Next.js App Router to generate static pages and apply Incremental Static Regeneration (ISR).
- **Policy Pages Server-Side Rendering (Zero Skeleton FOUC):**
  - *File modified:* `components/ui/PolicyPageLayout.tsx`
  - Initialized policy state with server seed data, eliminating initial empty skeleton states during SSR and ensuring full HTML text is delivered to search crawlers and mobile users immediately.

---

## Phase 4: Content & Trust Cleanup
- **Replaced External Unsplash Stock Photography:**
  - *Files modified:* `data/products.ts`, `data/categories.ts`, `app/layout.tsx`, `components/home/ShopByCategories.tsx`, `app/categories/page.tsx`, `data/homepage-settings.json`
  - Generated dedicated branded vector placeholders in `public/placeholders/` (`earbuds.svg`, `powerbank.svg`, `charger.svg`, `case.svg`, `cable.svg`, `general.svg`).
  - Swapped out all external `images.unsplash.com` links for self-hosted local placeholders.
- **Removed Exaggerated / Artificial Claims:**
  - *File modified:* `components/home/FinalTrustBar.tsx`
  - Removed *"Rated 4.9/5 by 50,000+ discerning customers"*. Replaced with authentic copy: *"Serving Mandi Bahauddin locally and satisfied smartphone owners across Pakistan"*.
- **Removed Fake "Verified Partner" Badges:**
  - *File modified:* `components/home/ShopByBrands.tsx`
  - Removed artificial "Verified" pill and "Verified Partners" heading; replaced with "Popular Brands" and dynamic item counts.
  - Filtered out brands that have 0 products in stock.
- **Honest Star Ratings for Unreviewed Products:**
  - *File modified:* `components/ui/StarRating.tsx`
  - If a product has 0 verified customer reviews, it now cleanly displays *"No reviews yet"* with subtle neutral stars rather than deceptive 5-star badges.

---

## Phase 5: SEO & Discoverability Hierarchy
- **Single Semantic `<h1>` on Every Page:**
  - *Homepage (`components/home/HeroSection.tsx`):* Added screen-reader accessible primary `<h1>` describing store and location.
  - *Checkout (`app/checkout/page.tsx`):* Added prominent `<h1>Secure Checkout</h1>`.
  - *Login (`components/login/CustomerLoginView.tsx`):* Upgraded main heading from `<h2>` to `<h1>`.
  - *Policy Pages (`components/ui/PolicyPageLayout.tsx`):* Server-rendered `<h1>` with exact policy titles.
- **Structured Data (JSON-LD):**
  - Verified `WebSite` and `Organization` / `Store` schemas on root layout.
  - Verified `Product` JSON-LD on `/product/[slug]`.

---

## Phase 6: WhatsApp Integration & Conversion
- **Floating WhatsApp Assistance Widget:**
  - *File created:* `components/ui/FloatingWhatsApp.tsx`
  - *File modified:* `app/layout.tsx`
  - Added floating green WhatsApp icon (`+92 343 2200995`) with interactive hint badge *"Need help? Chat with us"*.
  - Configured safe mobile positioning (`bottom-20 sm:bottom-6 right-4 sm:right-6`) with high z-index to avoid collisions with sticky mobile bars.
- **"Order on WhatsApp" Button on Product Pages:**
  - *File modified:* `components/products/ProductDetailClient.tsx`
  - Added full-width green WhatsApp direct ordering button on product detail pages.
  - Automatically encodes product name, selected price, and URL into the pre-filled message:
    `Salam, I want to order this product from AL-HAMD SHOP: Product: [Name], Price: [Price], Link: [URL]. Please confirm availability and delivery charges to my city.`

---

## Phase 7: Polish & Documentation
- **Deliverables Created:**
  - `AUDIT.md`: Complete baseline technical audit.
  - `TODO-OWNER.md`: Owner manual for genuine product photography, review management, and social accounts.
  - `CHANGELOG.md`: Detailed record of all technical modifications.

