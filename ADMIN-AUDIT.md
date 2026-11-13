# AL-HAMD SHOP — Admin Panel Technical & UX Audit

- **Project Checked**: `al-hamd-app` (`e:\Antigravity\codes\Al Hamd FINAL`)
- **Audit Mode**: Strictly Read-Only (source code inspection + local dev headless browser audit; zero source/data/DB modifications)
- **Live Browser Environment**: Next.js local dev server (`npm run dev` with `.env.local` `ADMIN_EMAIL` / `ADMIN_PASSWORD`, no MySQL database configured)

---

## 1. OVERVIEW

### Route & API Totals
- **Total Admin Pages (`app/admin/**/page.tsx`)**: **42** pages
  - **31** pages linked in the main left sidebar (`app/admin/layout.tsx`)
  - **11** pages not in the sidebar: `/admin/login`, `/admin/dashboard`, `/admin/orders/[id]`, `/admin/products/new`, `/admin/products/[id]`, `/admin/inquiries/[id]`, `/admin/shop-bills`, `/admin/shop-bills/new`, `/admin/login-page`, `/admin/media`, `/admin/blog`
- **Total Admin API Routes (`app/api/admin/**/route.ts`)**: **49** route files
- **Admin-Protected API Routes Outside `app/api/admin/`**: **9** route files (public `GET` on catalog/categories/brands/reviews, admin-protected writes and/or full reads):
  1. `app/api/brands/route.ts` (`POST`, `PUT` require admin)
  2. `app/api/brands/[id]/route.ts` (`PUT`, `PATCH`, `DELETE` require admin)
  3. `app/api/categories/route.ts` (`POST` requires admin)
  4. `app/api/categories/[id]/route.ts` (`PUT`, `PATCH`, `DELETE` require admin)
  5. `app/api/orders/route.ts` (`GET` requires admin or logged-in customer; `POST` is public checkout + also called by POS)
  6. `app/api/orders/[id]/route.ts` (`GET` requires admin or owning customer; `PATCH` requires admin)
  7. `app/api/products/route.ts` (`GET` allows unpaginated full catalog only when an admin session is present)
  8. `app/api/reviews/route.ts` (`GET` unmasks customer emails only when an admin session is present)
  9. `app/api/reviews/[id]/route.ts` (`DELETE` requires admin)

### How Admin Login, Session, Logout, Roles & Permissions Work (Plain English)
1. **Login (`app/admin/login/page.tsx` → `POST /api/admin/login`)**:
   - The login form posts email and password to `/api/admin/login`.
   - `app/api/admin/login/route.ts` verifies same-origin CSRF headers and applies rate limiting (20 attempts per 15 min per IP; 5 attempts per 15 min per email).
   - It checks the email/password against `.env.local` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) using `timingSafeEqual` first, and otherwise looks up the staff user in MySQL `staff_users` (when DB is configured) or `data/staff-users.json` (local dev only when DB is not configured). Passwords are verified via scrypt/legacy hash verification (`verifyUserPasswordUnified`).
   - On success, it mints an HMAC-SHA256 signed token (`v1...`) using `SESSION_SECRET` (`lib/db/sessionToken.ts`) and sets an `httpOnly` cookie named `alhamd_admin_session`.
2. **Session Lifetime & Verification (`middleware.ts`, `lib/db/sessionToken.ts`, `lib/db/adminAuth.ts`, `context/AdminAuthContext.tsx`)**:
   - **Session lifetime**: **12 hours** (`SESSION_TTL_MS = 12 * 60 * 60 * 1000` in `lib/db/sessionToken.ts`).
   - On every page/API request, Edge `middleware.ts` checks cookie presence & HMAC signature (Edge cannot read MySQL). Logged-in admins visiting `/admin/login` are redirected to `/admin/dashboard`; customer-only sessions visiting `/admin/*` are redirected to `/admin/login?error=customer_unauthorized`.
   - Inside Node.js API routes, `getAdminSessionAsync()` (`lib/db/adminAuth.ts`) re-verifies the HMAC signature AND cross-checks the user's live `status`, `role`, and `permissions` against MySQL `staff_users` (or `data/staff-users.json` in dev fallback, or env `ADMIN_EMAIL`). If DB is missing in production or errors out, it fails closed (returns `null`).
   - In the browser, `AdminAuthContext` (`context/AdminAuthContext.tsx`) fetches `/api/admin/login` (GET) on load and `/api/admin/session` for refreshes, caching non-sensitive user metadata in `localStorage['alhamd_current_admin']`.
3. **Logout (`app/api/admin/logout/route.ts`)**:
   - Clicking sign-out in the sidebar triggers `POST /api/admin/logout` (CSRF-checked) which clears `alhamd_admin_session`, legacy `admin_session`, and `alhamd_customer_session` cookies, clears `localStorage`, and redirects to `/admin/login`. Note: a `GET /api/admin/logout` handler also exists without CSRF checks.
4. **Owner vs `SUPER_ADMIN` vs Other Roles (`lib/db/requireAdmin.ts`, `lib/permissions.ts`, `lib/constants/permissions.ts`)**:
   - **Owner / Root Super Admin (`isOwner`)**: Any account matching `isOwner === true`, `role === 'SUPER_ADMIN'`, `role === 'OWNER'`, or whose email matches `process.env.ADMIN_EMAIL` (`.env` login creates `id: 'admin-env-1'`, `role: 'SUPER_ADMIN'`, `isOwner: true`, `permissions: ['*']`). `requireAdmin()` and `hasStaffPermission()` automatically bypass all permission checks for these accounts. Only `isOwner` accounts can call `GET/POST /api/admin/diagnostics/ip` and `GET/POST /api/admin/migrate-data`.
   - **Other Roles & Presets**: `lib/constants/permissions.ts` defines **104** granular permission keys across 16 modules, grouped into presets (`Full Admin`, `Retail Only`, `Inventory Operator`, `Order Manager`, `Catalog Curator`, `Custom`). Staff users get their own custom `permissions[]` array or fall back to `ROLE_DEFAULT_PERMISSIONS[role]`. Pricing permissions (`pricing.*`) are isolated so non-pricing permissions never grant price/cost access, and product bodies are filtered by `lib/productSanitizer.ts`.

---

## 2. PAGE-BY-PAGE TABLE

### A. Sidebar Pages (in exact `allAdminNavItems` order from `app/admin/layout.tsx`)

| Sidebar name | URL | What it does (one line) | Main actions/buttons | API routes it calls | Permission required | Data source in production (MySQL table names) | Data source in local dev (JSON file or none) | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard | `/admin` | Main store overview with KPIs, low-stock alerts, recent orders, and quick links | `+ NEW PRODUCT`, `Edit Homepage`, `Manage All Orders`, `Review stock levels` | `GET /api/admin/inquiries`, `GET /api/admin/products`, `GET /api/orders` | `dashboard.view` | `products`, `orders`, `customer_inquiries`, `categories` (`customers` missing) | `data/dev-products.json`, `data/dev-categories.json`, `data/dev-inquiries.json`, browser `localStorage` | Partly | Shows `Total Customers: 0` (reads localStorage); "Out of Stock" shows confusing text `"Unpublished from bag"`. |
| Shop Counter / POS | `/admin/pos` | In-store counter checkout terminal with daily summary and void history tabs | Add to cart, Variant picker, Apply discount/promo, Complete Sale, Print Receipt, Void Sale | `POST /api/promotions/validate`, `POST /api/orders` (via `createPosSale`), `POST /api/admin/pos/void` | `pos.view` or `orders.view` | `products`, `product_models`, `orders`, `order_items`, `promotions`, `promo_code_usages`, `inventory_logs` | `data/dev-products.json`, `data/payment-methods.json`, browser `localStorage` | Broken | **Bypasses `/api/admin/pos`**, sends unawaited `POST /api/orders`; all dev products show `OUT OF STOCK` (`shopStock: 0`). |
| Orders | `/admin/orders` | Lists all online and POS orders with search, channel/status filters, and quick updates | Search, Channel/Status/Sort filters, Status dropdown, View Details, Invoice/Receipt modal | `GET /api/orders`, `PATCH /api/orders/[id]` | `orders.view` | `orders`, `order_items`, `products`, `customers` | `seedOrders` (`[]`) / browser `localStorage` | Partly | Lists 0 orders in dev by default; calls `/api/orders/[id]` rather than `/api/admin/orders/[id]`. |
| Invoices & Bills | `/admin/invoices` | Searchable archive of customer invoices with A4/thermal print previews | Search by Invoice/Order/Customer, Print/Preview Invoice modal | `GET /api/orders` | `orders.print_bills` or `orders.view` | `orders`, `order_items` | `seedOrders` (`[]`) / browser `localStorage` | Partly | Uses `InvoiceModal` + `billSettings`; empty in local dev until orders exist. |
| Store & Bill Settings | `/admin/bill-settings` | Configures store header, address, tax info, and A4 vs thermal receipt layout toggles | Upload Logo, Toggle A4/Thermal fields, Select Paper Width (58mm/80mm/custom), Live Preview, Save | `GET/PUT /api/admin/bill-settings`, `POST /api/admin/settings/upload` | Sidebar: `settings.view` or `orders.print_bills`; API: also `settings.edit` / `inventory.shop_bill` | `bill_settings` | `data/dev-bill-settings.json` | Works | Live preview renders properly; saves to MySQL + JSON fallback. |
| Payment Methods & CMS | `/admin/payment-methods` | Configures Cash on Delivery, Easypaisa, JazzCash, bank transfer, tier visibility, and security text | Toggle methods, Edit instructions, Tier checkboxes (`RETAIL`/`WHOLESALE`/`SUPER_WHOLESALE`), Security/CMS tabs, Save | `GET/POST /api/admin/payment-methods` | Sidebar: `settings.payment_methods` / `edit` / `view`; Route guard & API miss `settings.payment_methods` | **None** (JSON file only!) | `data/payment-methods.json` | Partly | Not stored in MySQL; permission mismatch locks out `settings.payment_methods`-only staff. |
| Payment Verification | `/admin/payments` | Queue to verify or reject manual/bank/wallet payments on orders | Search, Status/Method filters, Verify Payment modal, Reject Payment modal, View Invoice | `GET /api/orders`, `PATCH /api/orders/[id]` | `orders.process` or `orders.view` | `orders`, `order_items` | `seedOrders` (`[]`) / browser `localStorage` | Partly | Uses `alert()` on failure; empty in local dev unless test orders exist. |
| Products | `/admin/products` | Main catalog table with search, category/stock filters, duplicate, edit, and delete | `+ New Product`, Search, Category/Stock filters, Duplicate, Edit, Delete modal | `GET /api/admin/products`, `POST /api/admin/products`, `DELETE /api/admin/products/[id]`, `GET /api/categories`, `GET /api/brands` | `products.view` / `create` / `add` / `edit` | `products`, `product_media`, `product_models`, `product_colors`, `product_bulk_pricing` | `data/dev-products.json` | Works | Loaded 24 dev products; Duplicate creates immediate copy without confirmation. |
| New Arrivals | `/admin/new-arrivals` | Curates products badged as New Arrivals and toggles the homepage New Arrivals section | Search candidates, Toggle Homepage Visible/Hidden, Add/Remove New Arrival, View Live Page | `GET /api/admin/products`, `PUT /api/admin/products/[id]`, `GET/POST /api/admin/homepage-settings` | `content.new_arrivals` | `products` (`homepage-settings.json` for visibility) | `data/dev-products.json`, `data/homepage-settings.json` | Works | Section visibility lives in JSON (`homepage-settings.json`), product flag in MySQL `products`. |
| Best Sellers | `/admin/best-sellers` | Curates Best Seller products and toggles homepage section visibility | Search candidates, Toggle Homepage Visible/Hidden, Add/Remove Best Seller, Selection Mode toggle | `GET /api/admin/products`, `PUT /api/admin/products/[id]`, `GET/POST /api/admin/homepage-settings` | `content.best_sellers` | `products` (`homepage-settings.json` for visibility) | `data/dev-products.json`, `data/homepage-settings.json` | Partly | **"Selection Mode" (Manual vs Automatic) toggle is fake UI** — local state only, never saved. |
| Categories | `/admin/categories` | Creates, edits, deletes, and sets featured status/images for product categories | New Category, Edit, Upload Image, Delete modal | `GET/POST /api/categories`, `PUT/DELETE /api/categories/[id]`, `POST /api/admin/categories/upload` | `categories.view` | `categories` | `data/dev-categories.json` | Works | Loaded 20 categories in dev; uses `alert()` for upload/delete errors. |
| Brands | `/admin/brands` | Manages product brands, logos, descriptions, featured toggle, display order, and deletions | Add Brand, Reorder, Toggle Active/Featured, Upload Logo, Edit, Delete modal | `GET/POST/PUT /api/brands`, `PUT/DELETE /api/brands/[id]`, `POST /api/admin/brands/upload` | `brands.*` (Route guard also allows `categories.view`, `products.view`) | `brands`, `products` | `data/dev-brands.json` | Works | Loaded 30 brands in dev. |
| Inventory (Warehouse) | `/admin/inventory` | Manages master warehouse stock levels, variant stock, low-stock warnings, and audit logs | Warehouse Stock / History tabs, Quick `+`/`-`, Keypad modal, Bulk Variant adjust, Warning threshold | `GET /api/admin/products`, `PUT /api/admin/products/[id]`, `GET/POST /api/admin/inventory/logs` | `inventory.view` (+ granular `.adjust_stock`, `.edit_warning`) | `products`, `product_models`, `inventory_logs` | `data/dev-products.json`, `data/dev-inventory-logs.json` | Works | Loaded 24 products cleanly. |
| Shop Inventory | `/admin/shop-inventory` | Manages shop-counter stock levels, warning limits, and Warehouse→Shop transfer bills | Shop Stock / Bills tabs, Create Shop Bill modal, Finalize/Void bill, Warning limit, Delete/Restore from shop | `GET/POST /api/admin/shop-bills`, `GET/PATCH /api/admin/shop-bills/[id]`, `GET/PUT /api/admin/products/[id]` | Sidebar: `inventory.view_shop` or `inventory.view`; Write API checks `shop_bills.manage` / `pos.manage` | `products`, `product_models`, `shop_bills`, `shop_bill_items`, `inventory_logs` | `data/dev-products.json`, `data/dev-shop-bills.json` | Partly | **Permission bug**: `inventory.shop_bill` user gets 403 on creating/finalizing bills (`adminAuth.ts:199`); delete uses raw `confirm()`. |
| Customers | `/admin/customers` | Shows retail customers table, order history modal, and suspend/deactivate controls | Search customers, View profile & orders drawer, Activate / Suspend / Deactivate modal | **None** (uses browser `localStorage` via `lib/db/customers.ts` & `/api/orders`) | `customers.view` | **None** (MySQL `customers` table is NOT queried!) | `seedCustomers` / `localStorage` | Broken | **Major gap**: Does not query MySQL `customers` or persist status changes to DB. |
| Customer Inquiries | `/admin/inquiries` | Lists customer support tickets/complaints with priority, type, status filters, and stats | Search, Type/Status/Priority filters, Refresh, Open Inquiry detail | `GET /api/admin/inquiries` | `inquiries.view` or `customers.view` (API also allows `orders.view`) | `customer_inquiries` | `data/dev-inquiries.json` | Works | Loaded 24 dev inquiries cleanly. |
| Wholesale Accounts | `/admin/wholesale` | Creates, edits, suspends, resets passwords for, and deletes B2B Wholesale accounts | Create Account, Search/Filter, View/Edit modal, Toggle Active/Inactive modal, Delete modal | `GET/POST /api/admin/wholesale`, `GET/PUT/DELETE /api/admin/wholesale/[id]` | Sidebar & Guard: `wholesale.view` or `.manage`; Page blocks `.view` (`wholesale.manage` required) | `customers` (`customer_type = 'WHOLESALE'`) | `data/customers.json` | Partly | Page gate blocks `wholesale.view`-only staff with 403; nearly identical 1,162-line copy of Super Wholesale. |
| Super Wholesale Accounts | `/admin/super-wholesale` | Manages VIP Super Wholesale B2B accounts, shop names, credentials, and status | Create Account, Search/Filter, View/Edit modal, Toggle Active/Inactive modal, Delete modal | `GET/POST /api/admin/super-wholesale`, `GET/PUT/DELETE /api/admin/super-wholesale/[id]` | Sidebar & Guard: `wholesale.view` or `.manage`; Page & API require `wholesale.manage` | `customers` (`customer_type = 'SUPER_WHOLESALE'`) | `data/customers.json` | Partly | Both page and `GET /api/admin/super-wholesale` return 403 to `wholesale.view` staff. |
| Sales & Reports | `/admin/sales` | Analytics dashboard with date range filters, revenue breakdowns, top products, CSV export | Start/End date filters, Product filter, Export CSV | `GET /api/orders`, `GET /api/admin/products` | Sidebar: `finance.view` or `orders.view`; Route guard also allows `products.view` | `orders`, `order_items`, `products` | `data/dev-products.json`, `seedOrders` / `localStorage` | Partly | Route guard permits `products.view` even though hidden in sidebar; zero orders in local dev. |
| Home Page Videos | `/admin/homepage-videos` | Uploads/manages homepage hero slider videos & poster images, headlines, and sort order | Upload Video/Poster, Add URL, Edit copy/CTA, Reorder, Toggle active, Delete modal | `GET/POST /api/admin/homepage-videos`, `POST /api/admin/homepage-videos/upload` | Sidebar: `content.videos` / `.homepage`; Guard: `.homepage` / `.media`; Upload API: **no perm check** | `homepage_videos` (+ uploaded files) | `data/homepage-videos.json` | Partly | 3-way permission mismatch between sidebar, `permissions.ts`, and upload API. |
| Homepage Control | `/admin/homepage` | Configures homepage section order/visibility, hero slider/banner, flash sale timer, and trust badges | Toggle/Reorder Sections, Edit Hero/Flash Sale/Trust Badges, Save Changes | `GET/POST /api/admin/homepage-settings`, `GET /api/admin/products`, `GET /api/admin/deals` | `content.homepage` | **None** (JSON file only!) | `data/homepage-settings.json` | Partly | Stored strictly in JSON file; wiped on redeploy without `DATA_DIR`. |
| Deals | `/admin/deals` | Creates and schedules bundle deals linking shop inventory products and discount prices | Create Deal modal, Upload Image, Add/Remove Shop Products, Edit, Delete modal | `GET/POST/PUT/DELETE /api/admin/deals`, `/api/admin/deals/[id]`, `/api/admin/deals/upload` | Sidebar & Guard: `deals.*` or `promotions.view`; API checks `promotions.view`/`add`/`edit`/`delete` only | `deals`, `deal_products` | `data/dev-deals.json` | Partly | Staff granted `deals.view`/`deals.manage` pass the page guard but get 403 from `/api/admin/deals`. |
| Promo Codes | `/admin/promo-codes` | Creates percentage/fixed promo codes, usage limits, min order rules, and checks usage logs | Create Promo, Search/Status filters, Copy Code, Usage History modal, Edit, Toggle, Delete modal | `GET/POST /api/admin/promotions`, `PUT/DELETE /api/admin/promotions/[id]`, `GET /api/admin/promotions/usages` | `promotions.view` / `add` / `create` / `edit` | `promotions`, `promo_code_usages` | Browser `localStorage` (`promo_codes`) | Broken | Non-DB branch calls client `localStorage` on server; **`/api/admin/promotions/usages` never queries MySQL** (`promo_code_usages`). |
| Navigation Menu | `/admin/navigation` | Edits top announcement bar messages, header brand/logo, and main header navigation links | Add/Edit/Reorder/Delete Announcements (`confirm()`), Edit Header Brand, Add/Reorder/Delete Menu links (`confirm()`), Save | `GET/POST /api/admin/navigation`, `GET/POST /api/admin/announcements`, `GET/PUT /api/admin/settings`, `POST /api/admin/settings/upload` | `content.navigation` | **Announcements & Nav: None (JSON only)**; Brand: `store_settings` | `data/navigation.json`, `data/announcements.json`, `data/store-settings.json` | Partly | Nav & announcements live in JSON only; uses raw `confirm()` and `alert()`. |
| Pages & Legal | `/admin/pages` | Visual block editor for custom CMS & legal pages (About, Privacy, Terms, Warranty, Shipping) | Create Page, Duplicate, Edit Blocks, Publish/Unpublish, Show in Header/Footer, Delete | `GET/POST /api/admin/pages`, `PUT/DELETE /api/admin/pages/[id]` | Sidebar: `pages.view`/`edit`/`create`; `[id]` API has **no permission check** | `custom_pages` | `data/custom-pages.json` | Partly | `PUT/DELETE /api/admin/pages/[id]` missing RBAC check — any logged-in staff can alter/delete pages. |
| Shop Location | `/admin/shop-location` | Adds and edits physical branch cards, opening hours, phones, and Google Maps embed URLs | Add Location, Edit, Set Active/Display Order, Delete | `GET/POST /api/admin/locations` | Sidebar & Guard: `settings.view`; API has **no permission check** | **None** (JSON file only!) | `data/shop-locations.json` | Partly | Stored in JSON only; `locations` API lacks `settings.view`/`settings.edit` permission checks. |
| Store Settings | `/admin/settings` | Configures store identity, shipping fees, tax %, social links, admin password, and server diagnostics | Save Store Info, Add/Edit/Delete Social account, Change Password, Check IP & Storage | `GET/PUT /api/admin/settings`, `POST /api/admin/settings/upload`, `POST /api/admin/password`, `GET /api/admin/diagnostics/ip` | `settings.view` / `settings.edit` (+ `isOwner` for diagnostics) | `store_settings` | `data/store-settings.json` | Partly | **Clicking Delete on a social account (`handleDeletePlatform`) saves deletion immediately with NO confirmation**. |
| SEO & Website Settings | `/admin/settings/seo` | Manages meta titles, descriptions, canonical URL, favicon, and OG social share card with live preview | Edit Title/Meta/Keywords/Canonical, Upload Logo/Favicon/OG Image, Live Search & OG Preview, Save | `GET/PUT /api/admin/settings`, `POST /api/admin/settings/upload` | `settings.view` / `settings.edit` | `store_settings` | `data/store-settings.json` | Partly | Live check shows `404 /uploads/branding/og_1791481522147_111.png` (missing local upload asset). |
| Login Appearance | `/admin/settings/login-appearance` | Customizes customer login page logo, slider images, copy, colors, and responsive preview | Upload/Add/Delete/Reorder Login Media, Edit Branding/Text/Colors/Layout tabs, Reset Defaults, Save | `GET/POST /api/admin/login-page/settings`, `GET/POST /api/admin/login-page/media`, `POST /api/admin/login-page/upload` | `settings.view` / `settings.edit` (`media` & `upload` APIs lack perm checks) | `login_page_settings`, `login_page_media` | `data/login-page-settings.json`, `data/login-page-media.json` | Partly | Live check shows `404 /uploads/login/1790338810605_1.jpeg`; `media` and `upload` APIs miss RBAC checks. |
| Staff Management | `/admin/staff` | Creates/edits staff accounts, toggles active status, assigns 104 granular permissions, and revokes password resets | Staff / Roles & Permissions / Password Resets tabs, Add/Edit Staff, Permissions Modal, Reset/Revoke, Delete modal | `GET/POST/PATCH/DELETE /api/admin/staff`, `GET /api/admin/password-resets`, `POST /api/admin/password-resets/[id]/revoke` | `staff.view` / `manage` / `add` / `edit` (`password-resets` APIs lack perm checks) | `staff_users`, `password_reset_tokens` (Roles presets not in DB) | `data/staff-users.json`, `data/password-reset-tokens.json`, `localStorage` | Partly | Custom roles in Roles tab are `localStorage`-only; `password-resets` APIs omit `staff.*` checks. |
| Activity Logs | `/admin/activity` | Displays audit log of admin edits, pricing changes, orders, and stock movements | Search, Module filter, Newest/Oldest sort | (Exists: `GET/POST /api/admin/activity`, **NOT called on mount by page**) | `staff.view` or `settings.view` | `activity_logs` | `localStorage` (`DEFAULT_ACTIVITY_LOGS`, `logs: []` from API) | Broken | Page never calls `syncActivityLogsFromApi()` on mount; local API returns `[]` without DB; shows stale `localStorage`. |

### B. Non-Sidebar Admin Pages (11 pages under `app/admin/**`)

| Sidebar name | URL | What it does (one line) | Main actions/buttons | API routes it calls | Permission required | Data source in production (MySQL table names) | Data source in local dev (JSON file or none) | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| *(Not in sidebar)* | `/admin/login` | Staff login page verifying email/password and setting the HTTP-only admin cookie | Email/Password inputs, Remember checkbox, Sign In, Forgot password dialog | `POST /api/admin/login` (+ `GET` login, `pages`, `session`, `customer/me` fired on mount) | Public (redirects to `/admin/dashboard` if logged in) | `staff_users`, `rate_limits` | `.env.local` + `data/staff-users.json` | Works | Works for login, but fires **four 401 requests** during initial unauthenticated load. |
| *(Not in sidebar)* | `/admin/dashboard` | Duplicate route rendering the exact same Dashboard component as `/admin` | Same as `/admin` | Same as `/admin` | `dashboard.view` | Same as `/admin` | Same as `/admin` | Partly | Alias for `/admin`; post-login redirect targets `/admin/dashboard` even though sidebar points to `/admin`. |
| *(Not in sidebar)* | `/admin/orders/[id]` | Full order detail view: items, shipping, status progression, payment verify/reject, print invoice | Status dropdown, Verify Payment modal, Reject Payment modal, Open Invoice | `GET/PATCH /api/orders/[id]` | `orders.view` (+ `.update_status`, `.process`) | `orders`, `order_items`, `products`, `inventory_logs` | `seedOrders` / `localStorage` | Partly | `app/api/admin/orders/[id]` returns `503` without DB, so UI relies on `/api/orders/[id]`. Test ID gave 404. |
| *(Not in sidebar)* | `/admin/products/new` | Comprehensive product creation form (basic info, media/video, models, colors, pricing tiers, bulk rules, stock) | Upload/Import URL Media, Add Models/Colors/Bulk Pricing, Save Product | `POST /api/admin/products`, `POST /api/admin/products/upload`, `POST /api/admin/products/import-url`, `GET /api/brands`, `GET /api/categories` | `products.create` / `add` / `view` (guard allows `.view`!) | `products`, `product_media`, `product_models`, `product_colors`, `product_bulk_pricing` | `data/dev-products.json` | Works | Form renders cleanly; page guard allows `products.view`-only users to open the form (`permissions.ts:296`). |
| *(Not in sidebar)* | `/admin/products/[id]` | Loads an existing product by ID and renders `ProductForm` for editing | Edit any product/variant/price/stock/media field, Save Changes | `GET/PUT /api/admin/products/[id]`, upload/import-url, `GET /api/brands`, `GET /api/categories` | `products.view` / `edit` / `create` (`GET` API has **NO auth check!**) | `products`, `product_media`, `product_models`, `product_colors`, `product_bulk_pricing` | `data/dev-products.json` | Partly | **Critical leak**: `GET /api/admin/products/[id]` has no auth check and exposes raw cost/wholesale prices. |
| *(Not in sidebar)* | `/admin/inquiries/[id]` | Inquiry ticket detail page to change status/priority and save internal admin notes | Quick Status buttons, Priority selector, Admin Notes editor, Save | `GET/PATCH /api/admin/inquiries/[id]` | `inquiries.view` / `customers.view` / `orders.view` (`PATCH` requires `.manage`) | `customer_inquiries`, `activity_logs` | `data/dev-inquiries.json` | Works | Loaded real dev inquiry (`inq_1794242048040_tiffi0`) cleanly in live check. |
| *(Not in sidebar)* | `/admin/shop-bills` | Legacy redirect stub redirecting immediately to `/admin/shop-inventory?tab=bills` | Auto-redirect (`window.location` / `router.replace`) | None (redirects) | `inventory.shop_bill` / `.view_shop` / `.view` | None | None | Works | Redundant legacy redirect page; active tab state works cleanly. |
| *(Not in sidebar)* | `/admin/shop-bills/new` | Legacy redirect stub redirecting immediately to `/admin/shop-inventory?tab=create-bill` | Auto-redirect | None (redirects) | `inventory.shop_bill` / `.view_shop` / `.view` | None | None | Works | Wait: `shop-inventory/page.tsx:54` only reads `tab === 'bills'`, so `?tab=create-bill` lands on `stock` tab instead of opening Create Bill modal! |
| *(Not in sidebar)* | `/admin/login-page` | Legacy redirect stub redirecting to `/admin/settings/login-appearance` | Auto-redirect | None (redirects) | `settings.view` / `settings.edit` / `content.homepage` | None | None | Works | Old route replaced by `/admin/settings/login-appearance`. |
| *(Not in sidebar)* | `/admin/media` | Centralized media uploader/viewer/copy-URL gallery | Upload Media Files, Search, Preview Modal, Copy URL, Delete (`confirm()`) | Upload routes (`/api/admin/products/upload`, etc.) | `content.homepage` / `content.banners` / `products.add` | **None** (`localStorage` index only!) | `localStorage` (`media_library`) | Broken | Unlinked from sidebar; only tracks images uploaded in the same browser (`localStorage`), not server files. |
| *(Not in sidebar)* | `/admin/blog` | Dead server redirect sending visitors straight to `/admin` | Immediate Next.js `redirect('/admin')` | None | `content.navigation` or `settings.view` | None | None | Broken / Dead | Dead leftover from removed blog feature; still checked in `lib/permissions.ts:394`. |

---

## 3. LIVE CHECK OF EVERY PAGE (Headless Chrome via Playwright, Local Dev Server)

Every admin page was visited in headless Chrome (1440×900) after logging in through `/admin/login` with `.env.local` credentials (`session` verified as `200`, `authenticated: true`, `role: SUPER_ADMIN`).
- **Systemic findings observed across ALL 42 pages**:
  1. Every authenticated admin page triggered `GET /api/auth/customer/me` → **HTTP 401** (`net::ERR_ABORTED` + `401`) because root `app/layout.tsx` wraps `/admin/**` in `<CustomerAuthProvider>` (`components/Providers.tsx:24`). This added at least **1 console error** (`Failed to load resource: the server responded with a status of 401 (Unauthorized)`) to every single page.
  2. Local dev compile/render load times were slow across all 42 routes (**8.86s – 11.45s** per navigation).
  3. Zero uncaught JS `pageerror` exceptions occurred on any of the 42 pages.

| # | Route | HTTP | Load Time | Final URL | Console Errs | Failed Requests (>=400 / FAILED) | Content State (rows / text length / heading) | Screenshot |
|---|---|---|---|---|---:|---:|---|---|
| 1 | `/admin/login` | 200 | 9172ms | `/admin/login` | 1 | 5 | Real UI (`h1`: "Welcome Back", len 245); pre-login 401s on `login` (x2), `pages`, `customer/me`, `session` | [login.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/login.png) |
| 2 | `/admin` | 200 | 8952ms | `/admin` | 1 | 2 | Real KPIs (`h1`: "Store Performance", len 1273, 1 table row); `/api/auth/customer/me` 401/aborted | [admin-root.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/admin-root.png) |
| 3 | `/admin/dashboard` | 200 | 8864ms | `/admin/dashboard` | 1 | 2 | Real KPIs (`h1`: "Store Performance", len 1273, 1 row); `/api/auth/customer/me` 401/aborted | [dashboard.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/dashboard.png) |
| 4 | `/admin/pos` | 200 | 9598ms | `/admin/pos` | 1 | 2 | Real POS UI (`h1`: "Shop Counter / POS", len 3341); all tiles show `OUT OF STOCK`; `customer/me` 401 | [pos.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/pos.png) |
| 5 | `/admin/orders` | 200 | 9708ms | `/admin/orders` | 1 | 17 | Empty table state (`h1`: "Orders Management", 1 empty row, len 1081); `customer/me` 401 + 15 aborted Unsplash images | [orders.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/orders.png) |
| 6 | `/admin/invoices` | 200 | 9597ms | `/admin/invoices` | 1 | 2 | Empty table state (`h1`: "Invoices & Bills", 1 empty row, len 784); `customer/me` 401 | [invoices.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/invoices.png) |
| 7 | `/admin/bill-settings` | 200 | 9707ms | `/admin/bill-settings` | 1 | 2 | Real settings & preview (`h1`: "Bill & Invoice Settings", len 2204, 2 rows); `customer/me` 401 | [bill-settings.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/bill-settings.png) |
| 8 | `/admin/payment-methods` | 200 | 9745ms | `/admin/payment-methods` | 1 | 2 | Real payment toggles (`h1`: "Checkout Payment Content Management", len 1855); `customer/me` 401 | [payment-methods.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/payment-methods.png) |
| 9 | `/admin/payments` | 200 | 9334ms | `/admin/payments` | 1 | 2 | Empty table state (`h1`: "PAYMENT VERIFICATION", 1 empty row, len 1071); `customer/me` 401 | [payments.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/payments.png) |
| 10 | `/admin/products` | 200 | 9647ms | `/admin/products` | 1 | 10 | Real catalog (`h1`: "Products (24)", 24 rows, len 4942); `customer/me` 401 + 8 aborted Unsplash images | [products.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/products.png) |
| 11 | `/admin/products/new` | 200 | 9705ms | `/admin/products/new` | 1 | 13 | Real full product form (`h1`: `""`, len 3172); `customer/me` 401 + 11 aborted prefetch/image requests | [products-new.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/products-new.png) |
| 12 | `/admin/new-arrivals` | 200 | 9573ms | `/admin/new-arrivals` | 1 | 2 | Real product picker (`h1`: "New Arrivals Management", len 2437); `customer/me` 401 | [new-arrivals.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/new-arrivals.png) |
| 13 | `/admin/best-sellers` | 200 | 9517ms | `/admin/best-sellers` | 1 | 2 | Real product picker (`h1`: "Best Sellers Management", len 2547); `customer/me` 401 | [best-sellers.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/best-sellers.png) |
| 14 | `/admin/categories` | 200 | 9843ms | `/admin/categories` | 1 | 2 | Real table (`h1`: "Category Management (20)", 20 rows, len 3649); `customer/me` 401 | [categories.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/categories.png) |
| 15 | `/admin/brands` | 200 | 9160ms | `/admin/brands` | 1 | 2 | Real table (`h1`: "Brand Management (30)", 30 rows, len 3418); `customer/me` 401 | [brands.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/brands.png) |
| 16 | `/admin/inventory` | 200 | 9622ms | `/admin/inventory` | 1 | 2 | Real stock table (`h1`: "Warehouse Inventory", 24 rows, len 3406); `customer/me` 401 | [inventory.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/inventory.png) |
| 17 | `/admin/shop-inventory` | 200 | 9684ms | `/admin/shop-inventory` | 1 | 2 | Real stock table (`h1`: "Shop Inventory", 24 rows, len 4192); `customer/me` 401 | [shop-inventory.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/shop-inventory.png) |
| 18 | `/admin/shop-bills` | 200 | 9512ms | `/admin/shop-inventory?tab=bills` | 1 | 2 | Redirected to Bills tab (`h1`: "Shop Inventory", len 959); `customer/me` 401 | [shop-bills.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/shop-bills.png) |
| 19 | `/admin/shop-bills/new` | 200 | 9639ms | `/admin/shop-inventory?tab=create-bill` | 1 | 2 | Redirected to Shop Stock tab (`h1`: "Shop Inventory", len 2705); modal did not auto-open; `customer/me` 401 | [shop-bills-new.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/shop-bills-new.png) |
| 20 | `/admin/customers` | 200 | 10134ms | `/admin/customers` | 1 | 2 | Seed fallback rows (`h1`: "Customers & Clients", 2 rows, len 963); `customer/me` 401 | [customers.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/customers.png) |
| 21 | `/admin/inquiries` | 200 | 9740ms | `/admin/inquiries` | 1 | 2 | Real dev inquiries (`h1`: "Customer Inquiries & Complaints", 24 rows, len 5969); `customer/me` 401 | [inquiries.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/inquiries.png) |
| 22 | `/admin/wholesale` | 200 | 9749ms | `/admin/wholesale` | 1 | 2 | Empty table state (`h1`: "Wholesale Account Management", 1 row, len 930); `customer/me` 401 | [wholesale.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/wholesale.png) |
| 23 | `/admin/super-wholesale` | 200 | 9636ms | `/admin/super-wholesale` | 1 | 2 | Empty table state (`h1`: "Super Wholesale Accounts", 1 row, len 956); `customer/me` 401 | [super-wholesale.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/super-wholesale.png) |
| 24 | `/admin/sales` | 200 | 9496ms | `/admin/sales` | 1 | 2 | Zero-sales state (`h1`: "Sales Analytics & Reports", 2 rows, len 2455); `customer/me` 401 | [sales.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/sales.png) |
| 25 | `/admin/homepage-videos` | 200 | 9930ms | `/admin/homepage-videos` | 1 | 2 | Real hero cards (`h1`: "Homepage Hero Sequence", len 1381); `customer/me` 401 | [homepage-videos.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/homepage-videos.png) |
| 26 | `/admin/homepage` | 200 | 9070ms | `/admin/homepage` | 1 | 2 | Real control center (`h1`: "Homepage Control Center", len 1412); `customer/me` 401 | [homepage.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/homepage.png) |
| 27 | `/admin/deals` | 200 | 9534ms | `/admin/deals` | 1 | 2 | Real empty-deals state (`h1`: "Deals Management", len 962); `customer/me` 401 | [deals.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/deals.png) |
| 28 | `/admin/promo-codes` | 200 | 9593ms | `/admin/promo-codes` | 1 | 2 | Empty table state (`h1`: "Promo & Discount Codes", 1 row, len 1049); `customer/me` 401 | [promo-codes.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/promo-codes.png) |
| 29 | `/admin/navigation` | 200 | 9051ms | `/admin/navigation` | 1 | 2 | Real menu & bar editor (`h1`: "Navigation & Announcement Center", len 1198); `customer/me` 401 | [navigation.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/navigation.png) |
| 30 | `/admin/pages` | 200 | 9963ms | `/admin/pages` | 1 | 2 | Real page list (`h1`: "Pages & Legal", len 1484); `customer/me` 401 | [pages.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/pages.png) |
| 31 | `/admin/shop-location` | 200 | 9687ms | `/admin/shop-location` | 1 | 5 | Real location UI (`h1`: "Shop Location", len 1131); aborted `pages`/`session` + `customer/me` 401 | [shop-location.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/shop-location.png) |
| 32 | `/admin/settings` | 200 | 9896ms | `/admin/settings` | 1 | 2 | Real settings form (`h1`: "Store Settings", len 895); `customer/me` 401 | [settings.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/settings.png) |
| 33 | `/admin/settings/seo` | 200 | 9369ms | `/admin/settings/seo` | 2 | 3 | Real SEO UI + broken preview (`h1`: "SEO & Website Branding Settings", len 3183); **404 OG image** + `customer/me` 401 | [settings-seo.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/settings-seo.png) |
| 34 | `/admin/settings/login-appearance` | 200 | 9331ms | `/admin/settings/login-appearance` | 2 | 3 | Real UI + broken logo (`h1`: "Login Appearance Management", len 1570); **404 login logo** + `customer/me` 401 | [settings-login-appearance.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/settings-login-appearance.png) |
| 35 | `/admin/staff` | 200 | 9822ms | `/admin/staff` | 1 | 2 | Real table (`h1`: "Staff Management", 2 rows, len 1258); `customer/me` 401 | [staff.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/staff.png) |
| 36 | `/admin/activity` | 200 | 9708ms | `/admin/activity` | 1 | 2 | Seed/local row (`h1`: "Audit & Activity Log", 1 row, len 887); `customer/me` 401 | [activity.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/activity.png) |
| 37 | `/admin/login-page` | 200 | 9289ms | `/admin/settings/login-appearance` | 2 | 3 | Redirected to Login Appearance (`h1`: "Login Appearance Management", len 1570); **404 login logo** + `customer/me` 401 | [login-page.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/login-page.png) |
| 38 | `/admin/media` | 200 | 9801ms | `/admin/media` | 1 | 2 | Real `localStorage` gallery (`h1`: "Media & Asset Library", len 955); `customer/me` 401 | [media.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/media.png) |
| 39 | `/admin/blog` | 200 | 9666ms | `/admin` | 1 | 2 | Server redirect back to `/admin` (`h1`: "Store Performance", len 1273); `customer/me` 401 | [blog.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/blog.png) |
| 40 | `/admin/orders/test-order-1` | 200 | 10863ms | `/admin/orders/test-order-1` | 2 | 4 | "Order Not Found" fallback (`h1`: `""`, len 664) — no dev order exists; **404 `/api/orders/test-order-1`** (x2) + `customer/me` 401 | [orders-detail.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/orders-detail.png) |
| 41 | `/admin/products/prod-1793303746610` | 200 | 11450ms | `/admin/products/prod-1793303746610` | 1 | 4 | Real populated Edit Product form (`h1`: `""`, len 3092); `customer/me` 401 + aborted `orders/test-order-1` | [products-edit.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/products-edit.png) |
| 42 | `/admin/inquiries/inq_1794242048040_tiffi0` | 200 | 11027ms | `/admin/inquiries/inq_1794242048040_tiffi0` | 1 | 2 | Real inquiry detail view (`h1`: `""`, len 1270); `customer/me` 401 | [inquiries-detail.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/inquiries-detail.png) |

*(Note: A follow-up script attempting to click extra read-only tabs timed out during login rate-limiting/redirect handling, so tab-interior DOM clicks were verified via code reading instead of runtime click logs.)*

---

## 4. FEATURE MAP

1. **Products (add/edit/delete, variants/models/colors, images, bulk pricing, wholesale/super-wholesale prices)**:
   - **Pages**: `/admin/products`, `/admin/products/new`, `/admin/products/[id]`, `components/admin/ProductForm.tsx`.
   - **APIs**: `GET/POST /api/admin/products`, `GET/PUT/DELETE /api/admin/products/[id]`, `POST /api/admin/products/upload`, `POST /api/admin/products/import-url`.
   - **Storage**: MySQL `products`, `product_media`, `product_models`, `product_colors`, `product_bulk_pricing` (dev: `data/dev-products.json`).
   - **Flow**: Form checks `pricing.retail.*`, `pricing.wholesale.*`, `pricing.super_wholesale.*`, `inventory.stock.edit`, and `products.sku_barcode`. On submit, `lib/productSanitizer.ts` validates field-level write permissions before writing main row and child tables (`product_models`, `product_colors`, `product_media`, `product_bulk_pricing`), then revalidates `/`, `/products`, `/api/products`, `/admin/products`. Uploads save under `PERSISTENT_UPLOADS_DIR/products` (or `public/uploads/products`); remote image URLs pass SSRF validation before downloading to disk.
2. **Categories**:
   - **Page**: `/admin/categories`. **APIs**: `GET/POST /api/categories`, `PUT/DELETE /api/categories/[id]`, `POST /api/admin/categories/upload`.
   - **Storage**: MySQL `categories` (dev: `data/dev-categories.json`).
   - **Flow**: Creates/updates category name, slug, description, status, featured flag, and image, then updates client cache + `alhamd:data-updated` event.
3. **Brands**:
   - **Page**: `/admin/brands`. **APIs**: `GET/POST/PUT /api/brands`, `PUT/DELETE /api/brands/[id]`, `POST /api/admin/brands/upload`.
   - **Storage**: MySQL `brands` (migration `add_brand_ordering.sql`, dev: `data/dev-brands.json`).
   - **Flow**: Manages brand CRUD, active/featured toggles, and drag/arrow display ordering (`action === 'reorder'`), updating `display_order` in DB.
4. **Inventory (Warehouse) and Shop Inventory**:
   - **Pages**: `/admin/inventory`, `/admin/shop-inventory`. **APIs**: `GET/POST /api/admin/inventory/logs`, `GET/PUT /api/admin/products/[id]`, `GET/POST /api/admin/shop-bills`, `GET/PATCH /api/admin/shop-bills/[id]`.
   - **Storage**: MySQL `products` (`stock`, `shop_stock`, `low_stock_threshold`), `product_models`, `inventory_logs`, `shop_bills`, `shop_bill_items` (dev: `dev-products.json`, `dev-inventory-logs.json`, `dev-shop-bills.json`).
   - **Flow**: Warehouse page adjusts parent `stock` or model-level stock via quick `+`/`-`, keypad, or bulk variant modal and records `inventory_logs`. Shop Inventory displays `shopStock`, lets staff configure shop low-stock warnings, hide/remove items from shop view, and transfer units from Warehouse (`stock`) → Shop (`shop_stock`) via Shop Bills.
5. **POS / Shop Counter**:
   - **Page**: `/admin/pos`. **APIs intended**: `POST /api/admin/pos`, `GET /api/admin/pos?view=summary|history`, `POST /api/admin/pos/void`, `POST /api/promotions/validate`.
   - **Storage**: MySQL `orders`, `order_items`, `products`, `product_models`, `inventory_logs`, `promo_code_usages` (dev: `dev-products.json`, `localStorage`).
   - **Flow**: Intended flow validates shop stock & pricing server-side via `createPosSaleInDb()` inside `/api/admin/pos`. **Actual UI flow**: `app/admin/pos/page.tsx` calls `createPosSale()` (`lib/db/pos.ts`), which deducts `localStorage` stock, logs locally, and fires an unawaited `POST /api/orders` (public checkout API). Voiding a sale calls `POST /api/admin/pos/void` (`voidOrderInDb`), which requires `pos.void_sale` and restores shop stock.
6. **Shop Bills and Invoices**:
   - **Pages**: `/admin/shop-inventory` (`bills` tab, `CreateShopBillModal`, `ShopBillModal`), `/admin/invoices` (`InvoiceModal`), plus redirect stubs `/admin/shop-bills` and `/admin/shop-bills/new`.
   - **APIs**: `GET/POST /api/admin/shop-bills`, `GET/PATCH /api/admin/shop-bills/[id]`, `GET/PUT /api/admin/bill-settings`, `GET /api/orders`.
   - **Storage**: MySQL `shop_bills`, `shop_bill_items`, `orders`, `order_items`, `bill_settings` (dev: `dev-shop-bills.json`, `dev-bill-settings.json`).
   - **Flow**: Shop Bills move inventory from Warehouse to Shop with `draft` → `finalized` (adjusts `stock` and `shop_stock` + writes `inventory_logs`) or `voided` (requires non-empty `voidReason` and reverses stock). Customer Invoices pull orders from `/api/orders` and render printable A4 or thermal (58mm/80mm/custom) bills formatted using `/admin/bill-settings`.
7. **Orders (status flow)**:
   - **Pages**: `/admin/orders`, `/admin/orders/[id]`. **APIs**: `GET/POST /api/orders`, `GET/PATCH /api/orders/[id]` (note: `app/api/admin/orders/[id]/route.ts` exists too, returning 503 if no DB).
   - **Storage**: MySQL `orders`, `order_items`, `products`, `inventory_logs`, `activity_logs`.
   - **Flow**: Supports `ONLINE` and `POS` channels plus `RETAIL`, `WHOLESALE`, and `SUPER_WHOLESALE` customer tiers. Valid statuses: `Pending` → `Confirmed` → `Processing` → `Packed` → `Shipped` → `Out for Delivery` → `Delivered`, plus `Cancelled` / `Refunded`. Status updates require `orders.update_status` or `orders.manage` via `PATCH /api/orders/[id]`.
8. **Payment Methods and Payment Verification**:
   - **Pages**: `/admin/payment-methods`, `/admin/payments`. **APIs**: `GET/POST /api/admin/payment-methods`, `GET /api/orders`, `PATCH /api/orders/[id]`.
   - **Storage**: Payment methods & checkout instructions are stored ONLY in `data/payment-methods.json` (no MySQL table). Payment verification updates `payment_status` (`Pending` | `Paid` | `Failed` | `Refunded`) and `payment_verification` JSON column in MySQL `orders`.
   - **Flow**: `/admin/payment-methods` saves active methods, account details, and customer tier eligibility (`RETAIL`, `WHOLESALE`, `SUPER_WHOLESALE`) to JSON and revalidates `/checkout`. `/admin/payments` filters orders needing verification and sends `PATCH /api/orders/[id]` (`paymentStatus` + note) requiring `orders.process` or `orders.manage`.
9. **Customers**:
   - **Page**: `/admin/customers`. **APIs**: **None**.
   - **Storage**: Intended: MySQL `customers`. **Actual**: Reads `localStorage` (`alhamd_store_customers`) aggregated with orders in `lib/db/customers.ts`; status toggles (`active`/`suspended`/`deactivated`) update `localStorage` only and never reach MySQL.
10. **Wholesale and Super Wholesale accounts**:
    - **Pages**: `/admin/wholesale`, `/admin/super-wholesale`.
    - **APIs**: `GET/POST /api/admin/wholesale`, `GET/PUT/DELETE /api/admin/wholesale/[id]`, `GET/POST /api/admin/super-wholesale`, `GET/PUT/DELETE /api/admin/super-wholesale/[id]`.
    - **Storage**: MySQL `customers` (`customer_type = 'WHOLESALE'` or `'SUPER_WHOLESALE'`, `shop_name` unique per tier; dev: `data/customers.json`).
    - **Flow**: Shop accounts log in by `shopName` + password (stored as scrypt hash) at wholesale login, receiving `WHOLESALE` or `SUPER_WHOLESALE` tier pricing and payment method visibility. Both admin pages allow create/edit/status toggle/password reset/delete.
11. **Customer Inquiries**:
    - **Pages**: `/admin/inquiries`, `/admin/inquiries/[id]`. **APIs**: `GET /api/admin/inquiries`, `GET/PATCH /api/admin/inquiries/[id]` (submitted from storefront `POST /api/contact`).
    - **Storage**: MySQL `customer_inquiries` (`INQ-YYYY-000001` references; dev: `data/dev-inquiries.json`).
    - **Flow**: Lists tickets with counts by status/priority/type; `[id]` page updates `status`, `priority`, `adminNotes`, sets `resolved_at`/`resolved_by`, and logs to `activity_logs`.
12. **Promo Codes**:
    - **Page**: `/admin/promo-codes`. **APIs**: `GET/POST /api/admin/promotions`, `GET/PUT/PATCH/DELETE /api/admin/promotions/[id]`, `GET /api/admin/promotions/usages` (+ public `POST /api/promotions/validate`).
    - **Storage**: MySQL `promotions`, `promo_code_usages` (dev non-DB code calls client `localStorage` helpers on server).
    - **Flow**: Defines code, percentage/fixed discount, max cap, min order amount, start/expiry dates, global usage limit, and category/product applicability. Usage endpoint currently fails to query `promo_code_usages` in MySQL.
13. **Deals**:
    - **Page**: `/admin/deals`. **APIs**: `GET/POST /api/admin/deals`, `GET/PUT/DELETE /api/admin/deals/[id]`, `POST /api/admin/deals/upload` (+ public `GET /api/deals`, `/api/deals/[slug]`).
    - **Storage**: MySQL `deals`, `deal_products` (dev: `data/dev-deals.json`).
    - **Flow**: Bundles one or more Shop Inventory products (up to 100 items) under a fixed deal price, schedule (`startDate`–`endDate`), banner image, and `showOnHomepage` toggle.
14. **Homepage Control and Home Page Videos**:
    - **Pages**: `/admin/homepage`, `/admin/homepage-videos`. **APIs**: `GET/POST /api/admin/homepage-settings`, `GET/POST /api/admin/homepage-videos`, `POST /api/admin/homepage-videos/upload`.
    - **Storage**: Homepage layout/hero/flash sale/trust bar are stored ONLY in `data/homepage-settings.json`; hero videos are stored in MySQL `homepage_videos` + `homepage-videos.json` cache + files in `uploads/videos`.
    - **Flow**: Homepage Control enables/disables and reorders homepage blocks, hero text/CTAs, flash-sale countdown, and trust benefits, then revalidates `/`. Hero Videos uploads MP4/WebM (max 25MB) and poster images (max 8MB) and orders slides by `displayOrder`.
15. **New Arrivals and Best Sellers**:
    - **Pages**: `/admin/new-arrivals`, `/admin/best-sellers`. **APIs**: `GET /api/admin/products`, `PUT /api/admin/products/[id]`, `GET/POST /api/admin/homepage-settings`.
    - **Storage**: Flags `is_new_arrival` / `is_best_seller` on MySQL `products` (dev: `data/dev-products.json`); section visibility in `data/homepage-settings.json`.
    - **Flow**: Toggles product flags and section visibility. Best Sellers' "Manual vs Automatic" toggle is unimplemented local UI state.
16. **Navigation Menu**:
    - **Page**: `/admin/navigation`. **APIs**: `GET/POST /api/admin/navigation`, `GET/POST /api/admin/announcements`, `GET/PUT /api/admin/settings`, `POST /api/admin/settings/upload`.
    - **Storage**: Announcements (`data/announcements.json`) and menu items (`data/navigation.json`) have NO MySQL tables; header logo/brand saves to `store_settings` + `store-settings.json`.
    - **Flow**: Manages top marquee announcements (normalizing/filtering legacy `/blog`), header brand logo/text, and main navbar links, revalidating root layout on save.
17. **Pages & Legal**:
    - **Page**: `/admin/pages`. **APIs**: `GET/POST /api/admin/pages`, `PUT/DELETE /api/admin/pages/[id]`.
    - **Storage**: MySQL `custom_pages` + `data/custom-pages.json` fallback.
    - **Flow**: Structured block builder (`hero`, `text`, `features`, `faq`, etc.) with slug routing (`/pages/[slug]`), SEO title/description, publish toggle, and header/footer placement flags.
18. **Shop Location**:
    - **Page**: `/admin/shop-location`. **APIs**: `GET/POST /api/admin/locations` (public read via `GET /api/locations`).
    - **Storage**: Stored ONLY in `data/shop-locations.json` (no MySQL table).
    - **Flow**: Single POST endpoint handles create/update and `action === 'delete'`, validating Google Maps URLs (`isValidGoogleMapsUrl`), revalidating `/` and `/contact`.
19. **Store Settings**:
    - **Page**: `/admin/settings`. **APIs**: `GET/PUT /api/admin/settings`, `POST /api/admin/settings/upload`, `POST /api/admin/password`, `GET /api/admin/diagnostics/ip`.
    - **Storage**: MySQL `store_settings` + disk cache `data/store-settings.json`.
    - **Flow**: Updates store name, tagline, contact/WhatsApp, currency, Pakistan shipping rates, tax %, business hours, social links, personal password change (for DB staff accounts), and owner-only server IP/storage diagnostics.
20. **SEO Settings**:
    - **Page**: `/admin/settings/seo`. **APIs**: `GET/PUT /api/admin/settings`, `POST /api/admin/settings/upload`.
    - **Storage**: MySQL `store_settings` (`seo_meta_title`, `seo_meta_description`, `seo_keywords`, `website_title`, `search_engine_title`, `search_engine_description`, `canonical_url`, `og_image_url`, `favicon_url`) + `data/store-settings.json`.
    - **Flow**: Saves SEO/branding metadata read by `app/layout.tsx` `generateMetadata()` and `/api/favicon`, showing live Google SERP, browser header, and OG card previews.
21. **Login Appearance**:
    - **Page**: `/admin/settings/login-appearance` (plus redirect `/admin/login-page`). **APIs**: `GET/POST /api/admin/login-page/settings`, `GET/POST /api/admin/login-page/media`, `POST /api/admin/login-page/upload`.
    - **Storage**: MySQL `login_page_settings`, `login_page_media` + `data/login-page-settings.json`, `data/login-page-media.json`.
    - **Flow**: Customizes the customer `/login` split-screen slider media (images up to 10MB, videos up to 50MB), branding logo, colors, headings, and layout while rendering an interactive Desktop/Tablet/Mobile preview.
22. **Staff Management (roles/permissions)**:
    - **Page**: `/admin/staff`. **APIs**: `GET/POST/PATCH/DELETE /api/admin/staff`, `GET /api/admin/password-resets`, `POST /api/admin/password-resets/[id]/revoke`.
    - **Storage**: Staff accounts in MySQL `staff_users` (dev: `data/staff-users.json`); reset tokens in `password_reset_tokens` (`data/password-reset-tokens.json`); **Custom Role templates in `localStorage` (`alhamd_store_staff_roles`) only**.
    - **Flow**: Creates/edits/deactivates/deletes staff users, assigns custom `permissions[]` via `PermissionManager` (104 permissions), resets staff passwords (`validatePasswordPolicy` + scrypt), and revokes customer/staff reset tokens.
23. **Activity Logs**:
    - **Page**: `/admin/activity`. **APIs**: `GET/POST /api/admin/activity` (unused on mount by page UI).
    - **Storage**: MySQL `activity_logs` (written server-side by products, orders, inquiries, shop bills, migration); local dev returns `logs: []` from `/api/admin/activity`, so page shows browser `localStorage` (`DEFAULT_ACTIVITY_LOGS` + client-written logs).
24. **Sales & Reports**:
    - **Page**: `/admin/sales`. **APIs**: `GET /api/orders`, `GET /api/admin/products`.
    - **Storage**: Derived client-side from `orders` (`order_items`) and `products`.
    - **Flow**: Computes Today / 7-Day / Month / Year revenue KPIs, payment method splits, product sales breakdown, and exports filtered reports to CSV in the browser.
25. **Notifications**:
    - **UI**: Header bell popover in `app/admin/layout.tsx`. **APIs**: **None**.
    - **Storage**: Browser `localStorage` (`admin_notifications` via `lib/db/notifications.ts`).
    - **Flow**: Reads/marks individual notifications read in `localStorage`; starts with a hardcoded `"Admin control center is live and synced with MySQL."` message, never syncs with server events/orders, and `markAllNotificationsAsRead()` is unexposed in UI.

---

## 5. DATA STORAGE MAP

- **Environment variables controlling persistence across Hostinger GitHub redeploys**:
  - `DATA_DIR` (`lib/storage/dataDir.ts`): When set to a directory **outside** the app root (and seeded once from `<root>/data/*.json`), JSON files survive redeploys. If unset (default `<root>/data/`), redeploys overwrite/wipe runtime JSON changes.
  - `PERSISTENT_UPLOADS_DIR` (or `MEDIA_STORAGE_PATH` / `UPLOADS_DIR`, `lib/mediaStorage.ts`): When set **outside** the app root, uploaded files (`/uploads/...` served by `app/uploads/[...path]/route.ts`) survive redeploys. If unset (default `<root>/public/uploads/`), redeploys wipe uploaded images/videos.

| Setting or feature | Stored in MySQL table or JSON file | File path / Table name | Survives a GitHub redeploy? |
|---|---|---|---|
| Products, models, colors, media, bulk pricing, reviews | MySQL (Prod) / JSON (Dev) | MySQL: `products`, `product_models`, `product_colors`, `product_media`, `product_bulk_pricing`, `product_reviews` / Dev: `data/dev-products.json` | **Yes** (MySQL); product image files depend on `PERSISTENT_UPLOADS_DIR` |
| Categories | MySQL (Prod) / JSON (Dev) | MySQL: `categories` / Dev: `data/dev-categories.json` | **Yes** (MySQL); uploaded icons depend on `PERSISTENT_UPLOADS_DIR` |
| Brands | MySQL (Prod) / JSON (Dev) | MySQL: `brands` / Dev: `data/dev-brands.json` | **Yes** (MySQL); uploaded logos depend on `PERSISTENT_UPLOADS_DIR` |
| Warehouse & Shop Inventory Logs | MySQL (Prod) / JSON (Dev) | MySQL: `inventory_logs` / Dev: `data/dev-inventory-logs.json` | **Yes** (MySQL) |
| Shop Bills & Items | MySQL (Prod) / JSON (Dev) | MySQL: `shop_bills`, `shop_bill_items` / Dev: `data/dev-shop-bills.json` | **Yes** (MySQL) |
| Orders & POS Sales | MySQL (Prod) / Seed+Local (Dev) | MySQL: `orders`, `order_items` (`pos.ts` uses `orders` API) | **Yes** (MySQL; **No** in local browser-only `localStorage`) |
| Customers (Retail list & status in `/admin/customers`) | MySQL table exists, **UI reads `localStorage` only** | UI: `localStorage['alhamd_store_customers']` (MySQL table `customers` only used by auth/checkout/wholesale) | **No** (browser-only for `/admin/customers` status edits) |
| Wholesale & Super Wholesale Accounts | MySQL (Prod) / JSON (Dev) | MySQL: `customers` (`customer_type`) / Dev: `data/customers.json` | **Yes** (MySQL) |
| Customer Inquiries | MySQL (Prod) / JSON (Dev) | MySQL: `customer_inquiries` / Dev: `data/dev-inquiries.json` | **Yes** (MySQL) |
| Deals & Bundle Products | MySQL (Prod) / JSON (Dev) | MySQL: `deals`, `deal_products` / Dev: `data/dev-deals.json` | **Yes** (MySQL); deal banners depend on `PERSISTENT_UPLOADS_DIR` |
| Promo Codes & Usages | MySQL (Prod) / Client Storage (Dev) | MySQL: `promotions`, `promo_code_usages` | **Yes** (MySQL), except usage reader in `/api/admin/promotions/usages` reads localStorage instead of MySQL |
| Custom Pages & Legal | MySQL + JSON cache | MySQL: `custom_pages` / JSON: `data/custom-pages.json` | **Yes** (MySQL) |
| Store & SEO Settings | MySQL + JSON cache | MySQL: `store_settings` / JSON: `data/store-settings.json` | **Yes** (MySQL); uploaded logo/favicon/OG depend on `PERSISTENT_UPLOADS_DIR` |
| Bill & Receipt Settings | MySQL + JSON fallback | MySQL: `bill_settings` / JSON: `data/dev-bill-settings.json` | **Yes** (MySQL); uploaded bill logo depends on `PERSISTENT_UPLOADS_DIR` |
| Login Appearance (Settings & Media) | MySQL + JSON fallback | MySQL: `login_page_settings`, `login_page_media` / JSON: `data/login-page-settings.json`, `data/login-page-media.json` | **Yes** (MySQL); media files depend on `PERSISTENT_UPLOADS_DIR` |
| Home Page Videos | MySQL + JSON cache | MySQL: `homepage_videos` / JSON: `data/homepage-videos.json` | **Yes** (MySQL); video/poster files depend on `PERSISTENT_UPLOADS_DIR` |
| Staff Users & Password Reset Tokens | MySQL (Prod) / JSON (Dev) | MySQL: `staff_users`, `password_reset_tokens` / Dev: `data/staff-users.json`, `data/password-reset-tokens.json` | **Yes** (MySQL) |
| Custom Staff Role Templates (`/admin/staff` Roles tab) | Browser `localStorage` only | `localStorage['alhamd_store_staff_roles']` | **No** (lost across browsers/devices/storage clear) |
| Activity Logs | MySQL (server) / `localStorage` (Dev UI) | MySQL: `activity_logs` / Client: `localStorage['alhamd_store_activity_logs']` | **Yes** (MySQL for server-logged events) |
| Admin Notifications | Browser `localStorage` only | `localStorage['alhamd_store_admin_notifications']` | **No** |
| Media Library (`/admin/media`) Index | Browser `localStorage` only | `localStorage['alhamd_store_media_library']` (actual files in `uploads/`) | Index: **No**; Uploaded files: **Depends on `PERSISTENT_UPLOADS_DIR`** |
| **Payment Methods & Checkout CMS** | **JSON file only (No MySQL)** | `data/payment-methods.json` | **Depends on `DATA_DIR`** (lost on redeploy if `DATA_DIR` unset) |
| **Homepage Control Sections, Hero, Flash Sale, Trust** | **JSON file only (No MySQL)** | `data/homepage-settings.json` | **Depends on `DATA_DIR`** (lost on redeploy if `DATA_DIR` unset) |
| **Navigation Menu** | **JSON file only (No MySQL)** | `data/navigation.json` | **Depends on `DATA_DIR`** (lost on redeploy if `DATA_DIR` unset) |
| **Top Announcement Bar** | **JSON file only (No MySQL)** | `data/announcements.json` | **Depends on `DATA_DIR`** (lost on redeploy if `DATA_DIR` unset) |
| **Shop Locations** | **JSON file only (No MySQL)** | `data/shop-locations.json` | **Depends on `DATA_DIR`** (lost on redeploy if `DATA_DIR` unset) |
| Uploaded Images & Videos (`/uploads/...`) | Disk filesystem | `PERSISTENT_UPLOADS_DIR` (or `public/uploads/`) | **Depends on `PERSISTENT_UPLOADS_DIR`** (lost on redeploy if unset) |

---

## 6. PROBLEMS FOUND (Sorted by Severity)

### Critical (5)

- **CRIT-01 — POS counter bypasses `/api/admin/pos` and silently drops/rate-limits sales**
  - **Page**: `/admin/pos`
  - **Evidence**: `app/admin/pos/page.tsx:9,736` imports and calls client-side `createPosSale()` (`lib/db/pos.ts:59-375`). Line 366 fires `fetch('/api/orders', { method: 'POST', ... }).catch(() => {})` (unawaited, errors swallowed) instead of `POST /api/admin/pos`. Meanwhile `POST /api/orders` (`app/api/orders/route.ts:63`) enforces a public limit of 10 orders/hour/IP.
  - **Impact**: A cashier doing >10 counter sales in an hour gets silently blocked from saving to MySQL while the UI prints a receipt saying `"Sale completed successfully!"`. Also skips server-side `pos.apply_discount` enforcement in `app/api/admin/pos/route.ts:40`.
  - **Suggested Fix**: Update `app/admin/pos/page.tsx` to `await fetch('/api/admin/pos', { method: 'POST', ... })` directly, check `res.ok`, and only show success / print receipt once MySQL confirms commit.

- **CRIT-02 — Customers admin page is completely disconnected from MySQL**
  - **Page**: `/admin/customers` (and Dashboard Total Customers metric)
  - **Evidence**: `app/admin/customers/page.tsx:6,46,70,98` uses `getCustomers()` and `updateCustomerStatus()` from `lib/db/customers.ts:58-163,244-265`, which read/write only browser `localStorage` (`STORAGE_KEY = 'customers'`). There is no `/api/admin/customers` API route. Live check on `/admin` showed `Total Customers: 0` even with backend data, and `/admin/customers` showed only 2 hardcoded demo seeds (`hamza.khan@gmail.com`, `ayesha.malik@outlook.com`).
  - **Impact**: Store admin cannot see real registered retail customers in MySQL, and suspending/deactivating a customer in `/admin/customers` does nothing in production — blocked customers can still log in and order.
  - **Suggested Fix**: Create `GET /api/admin/customers` and `PATCH /api/admin/customers/[id]` backed by `lib/db/repositories/customers.ts` (`getAllCustomersFromDb`), protected by `requireAdmin(..., 'customers.view' / 'customers.manage')`, and wire `/admin/customers` and `/admin` dashboard to it.

- **CRIT-03 — Unauthenticated `GET /api/admin/products/[id]` leaks wholesale & cost prices**
  - **Page / API**: `/admin/products/[id]` / `app/api/admin/products/[id]/route.ts`
  - **Evidence**: `app/api/admin/products/[id]/route.ts:16-41` never calls `requireAdmin()` or returns 401 when `session` is null. Line 38 executes `const safeProduct = session ? sanitizeProductForSession(product, session) : product;` — returning the **unsanitized** product object when unauthenticated.
  - **Impact**: Anyone on the internet can fetch `/api/admin/products/<id>` without logging in and read private `wholesalePrice`, `superWholesalePrice`, and `costPrice` fields for all 521 products.
  - **Suggested Fix**: Add `const auth = await requireAdmin(request, ['products.view', 'products.edit', 'products.manage']); if (!auth.ok) return auth.response;` at the start of `GET`.

- **CRIT-04 — Five core settings/CMS features have no MySQL tables and risk data wipe on redeploy**
  - **Pages**: `/admin/payment-methods`, `/admin/homepage`, `/admin/navigation`, `/admin/shop-location`
  - **Evidence**: `lib/db/paymentMethodsStorage.ts`, `lib/db/homepageSettingsStorage.ts`, `lib/db/navigationStorage.ts`, `lib/db/announcementsStorage.ts`, and `lib/db/locationStorage.ts` read/write exclusively to `data/*.json` via `getDataDir()` (`lib/storage/dataDir.ts:30-73`). No MySQL repositories or SQL tables exist for these 5 modules.
  - **Impact**: On Hostinger GitHub auto-deploys, if `DATA_DIR` is not explicitly configured to a directory outside the app folder, every redeploy resets all payment methods/instructions, homepage layout/hero/flash sale, menu links, announcements, and shop locations back to seed defaults.
  - **Suggested Fix**: Either guarantee `DATA_DIR` and `PERSISTENT_UPLOADS_DIR` are set outside the Hostinger deploy path, or migrate those 5 JSON configs into MySQL (`store_settings` / dedicated tables).

- **CRIT-05 — Promo Code usages API reads browser `localStorage` on the server (never queries MySQL)**
  - **Page / API**: `/admin/promo-codes`, `/api/admin/promotions/usages`, `/api/admin/promotions/[id]`
  - **Evidence**: `app/api/admin/promotions/usages/route.ts:2,25` calls `getPromoCodeUsages()` from client module `lib/db/promotions.ts` instead of querying `promo_code_usages` in MySQL (`lib/db/repositories/promotions.ts`). Also `app/api/admin/promotions/[id]/route.ts:2,42,83,125` calls `getPromoCodes`/`updatePromoCode`/`deletePromoCode` (`localStorage`-backed) in its non-DB fallback branch.
  - **Impact**: Promo Code usage analytics ("Usage History" modal) always appear empty in production even when customers redeem codes, and local dev server CRUD on `/api/admin/promotions/[id]` operates on an empty server cache rather than a JSON file.
  - **Suggested Fix**: Add `getPromoCodeUsagesFromDb()` in `lib/db/repositories/promotions.ts` and call it in `/api/admin/promotions/usages`; add `dev-promotions.json` server dev fallback in `serverDevStorage.ts`.

---

### High (10)

- **HIGH-01 — Four admin API route files authenticate the session but skip RBAC permission checks**
  - **Pages / APIs**: `/admin/pages`, `/admin/shop-location`, `/admin/staff`
  - **Evidence**: `app/api/admin/pages/[id]/route.ts:16-19,47-50` (`PUT`/`DELETE`), `app/api/admin/locations/route.ts:12,36` (`GET`/`POST` including `action === 'delete'`), `app/api/admin/password-resets/route.ts:7-10` (`GET`), and `app/api/admin/password-resets/[id]/revoke/route.ts:10-13` (`POST`) only check `getAdminSessionAsync(request)` without `hasAdminPermission(...)`.
  - **Impact**: Any low-privilege staff member (e.g., a cashier or inventory clerk) can directly call these APIs to delete legal pages, delete store locations, or inspect/revoke customer/staff password-reset requests.
  - **Suggested Fix**: Replace manual `getAdminSessionAsync` calls with `requireAdmin(request, [...])` specifying `pages.edit`/`pages.delete`, `settings.view`/`settings.edit`, and `staff.reset_passwords`/`staff.manage`.

- **HIGH-02 — Upload & Login-Page media APIs lack RBAC permission checks**
  - **Pages / APIs**: `/admin/homepage-videos`, `/admin/settings/login-appearance`, `/admin/settings`, `/admin/settings/seo`
  - **Evidence**: `app/api/admin/homepage-videos/upload/route.ts:14-20`, `app/api/admin/login-page/upload/route.ts:12-18`, `app/api/admin/settings/upload/route.ts:11-17`, and `POST` in `app/api/admin/login-page/media/route.ts:82-88` only check `getAdminSessionAsync(request)` and do not call `hasAdminPermission(...)`.
  - **Impact**: Any authenticated staff role can upload arbitrary images/videos (up to 50MB) or overwrite login page slider media.
  - **Suggested Fix**: Add `requireAdmin(request, ...)` permission checks (`content.videos`/`content.homepage`, `settings.edit`).

- **HIGH-03 — Widespread permission mismatches across Sidebar, `canAccessAdminRoute`, Pages, and APIs**
  - **Pages**: `/admin/payment-methods`, `/admin/wholesale`, `/admin/super-wholesale`, `/admin/homepage-videos`, `/admin/deals`, `/admin/shop-inventory`, `/admin/sales`, `/admin/brands`, `/admin/pages`, `/admin/products/new`
  - **Evidence**:
    - `Payment Methods`: Sidebar (`layout.tsx:66`) checks `settings.payment_methods`, but `lib/permissions.ts:346` & `app/api/admin/payment-methods/route.ts:14,29` omit `settings.payment_methods`.
    - `Wholesale & Super Wholesale`: Sidebar (`layout.tsx:77-78`) & `permissions.ts:351` grant entry to `wholesale.view`, but both pages (`wholesale/page.tsx:44`, `super-wholesale/page.tsx:44`) gate the entire screen on `wholesale.manage`, and `app/api/admin/super-wholesale/route.ts:33` returns `403` to `wholesale.view`.
    - `Home Page Videos`: Sidebar (`layout.tsx:80`) checks `content.videos`, `permissions.ts:374` checks `content.media` (undefined in `ALL_PERMISSIONS`), and `api/admin/homepage-videos/route.ts:33` omits both `content.videos` and `content.media`.
    - `Deals`: Sidebar & `permissions.ts:366` check `deals.view`/`deals.manage`, while `api/admin/deals/route.ts:13` & `[id]/route.ts:16,58` only check `promotions.view`/`promotions.edit`.
    - `Shop Bills`: `permissions.ts:321` checks `inventory.shop_bill`, while `lib/db/adminAuth.ts:199` (`isAuthorizedForShopBill`) requires `shop_bills.manage` or `pos.manage` (neither key exists in `ALL_PERMISSIONS`).
    - `Products/New`, `Sales`, `Brands`, `Pages`: `permissions.ts:296,314,392,416` permit read-only `products.view` / `categories.view` / `settings.view` roles to open pages hidden from them in the sidebar.
  - **Impact**: Non-owner staff get confusing 403 errors on pages visible in their sidebar (or can bypass sidebar restrictions by typing URLs directly).
  - **Suggested Fix**: Unify every module's permission keys across `ALL_PERMISSIONS`, `layout.tsx`, `lib/permissions.ts`, page-level `hasPermission`, and backend `requireAdmin`.

- **HIGH-04 — Activity Logs page never syncs from `/api/admin/activity` on mount and lacks local dev persistence**
  - **Page / API**: `/admin/activity`, `/api/admin/activity`
  - **Evidence**: `app/admin/activity/page.tsx:20-30` calls `getActivityLogs()` synchronously and never calls `syncActivityLogsFromApi()`. In `app/api/admin/activity/route.ts:13-15`, when `!isDbConfigured()`, `GET` immediately returns `{ count: 0, logs: [] }`.
  - **Impact**: In production, `/admin/activity` initially renders stale browser `localStorage` logs and only triggers a background fire-and-forget fetch (`lib/db/activity.ts:86-88`) if `hasSyncedActivityLogsFromApi` is false. In local dev, `GET /api/admin/activity` returns empty, and server-side actions aren't logged to disk.
  - **Suggested Fix**: Await `syncActivityLogsFromApi()` in `app/admin/activity/page.tsx` `useEffect` (with a loading/refresh indicator) and persist dev activity logs in `data/dev-activity-logs.json`.

- **HIGH-05 — Staff Roles & Permissions templates ("Roles & Permissions" tab) are `localStorage`-only**
  - **Page**: `/admin/staff`
  - **Evidence**: `app/admin/staff/page.tsx:9,14-16` imports `getStaffRolesLocal`, `createStaffRoleLocal`, `updateStaffRoleLocal`, `deleteStaffRoleLocal` from `lib/client/staffApi.ts:136-225`, which saves custom roles exclusively to `localStorage['alhamd_store_staff_roles']`.
  - **Impact**: Custom roles created by the owner on one computer vanish on any other browser/computer and cannot be referenced server-side.
  - **Suggested Fix**: Add a `staff_roles` MySQL table and `/api/admin/roles` API instead of saving custom roles in `localStorage`.

- **HIGH-06 — `/api/admin/orders/[id]` and `/api/admin/inquiries` lack offline dev parity**
  - **Pages / APIs**: `/admin/orders/[id]`, `/admin/inquiries`, `/api/admin/orders/[id]`
  - **Evidence**: `app/api/admin/orders/[id]/route.ts:41-43,110-112` hard-returns `503 Database is not configured` when MySQL is absent (unlike `/api/orders/[id]`), and `app/api/admin/inquiries/route.ts:23-33` always calls `getAllInquiriesFromDb` (only working locally because `lib/db/repositories/inquiries.ts:58` internally reads `data/dev-inquiries.json`).
  - **Impact**: Calling `/api/admin/orders/[id]` in local dev fails with 503; order detail testing locally depends entirely on the separate `/api/orders/[id]` route and has 0 seed orders unless one is created first.
  - **Suggested Fix**: Consolidate `/api/admin/orders/[id]` and `/api/orders/[id]` or add `serverDevStorage` fallback (`data/dev-orders.json`) so order workflows can be tested end-to-end without MySQL.

- **HIGH-07 — Orphaned `/admin/media` library is local-only and unreachable from the sidebar**
  - **Page**: `/admin/media`
  - **Evidence**: `allAdminNavItems` in `app/admin/layout.tsx:60-92` omits `/admin/media`. Inside `lib/db/media.ts:14,57-59`, `getMediaItems()` returns hardcoded Unsplash defaults + `localStorage['alhamd_store_media_library']` without ever listing files stored on the server.
  - **Impact**: Admins cannot see or manage uploaded server images in a central library, and media uploaded by another staff member never appears in `/admin/media`.
  - **Suggested Fix**: Either build a `GET /api/admin/media` route scanning `PERSISTENT_UPLOADS_DIR` / `product_media` and add it to the sidebar, or remove `/admin/media`.

- **HIGH-08 — Root `<CustomerAuthProvider>` causes HTTP 401 console error on every single admin page**
  - **Pages**: All 42 `/admin/**` pages (especially `/admin/login`)
  - **Evidence**: `app/layout.tsx` → `components/Providers.tsx:24` wraps `/admin/**` in `<CustomerAuthProvider>`, `<CartDrawer />`, and `<SearchModal />`. Playwright recorded `401 /api/auth/customer/me` + `Failed to load resource: 401 (Unauthorized)` on **all 42 pages**. On `/admin/login`, `AdminAuthContext` and page checks also fired `401` on `/api/admin/login`, `/api/admin/pages`, and `/api/admin/session`.
  - **Impact**: Clutters browser DevTools with constant 401 errors on every admin navigation and unnecessarily runs customer auth + cart + search hooks in the admin bundle.
  - **Suggested Fix**: In `CustomerAuthContext` / `Providers.tsx` (or route-group layouts `(store)` vs `admin`), skip `/api/auth/customer/me` and storefront drawers when `pathname.startsWith('/admin')`, and skip `AdminAuthContext` session polling on `/admin/login`.

- **HIGH-09 — Broken local upload assets (`404`) in SEO & Login Appearance previews, plus aborted external Unsplash images**
  - **Pages**: `/admin/settings/seo`, `/admin/settings/login-appearance`, `/admin/login-page`, `/admin/orders`, `/admin/products`
  - **Evidence**: Playwright captured `404 /uploads/branding/og_1791481522147_111.png` on `/admin/settings/seo` ([settings-seo.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/settings-seo.png)) and `404 /uploads/login/1790338810605_1.jpeg` on `/admin/settings/login-appearance` ([settings-login-appearance.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/settings-login-appearance.png)). Those paths exist in `data/store-settings.json` / `data/login-page-media.json` but the files are absent locally. `/admin/orders` and `/admin/products` also aborted 15 and 8 remote `images.unsplash.com` requests respectively.
  - **Impact**: Broken image icons appear directly inside the SEO OG preview and Login branding preview; missing `/uploads/*` URLs will also show broken icons on live storefronts if a redeploy wipes `public/uploads/`.
  - **Suggested Fix**: Replace broken sample upload paths in `data/*.json` with existing placeholders or fallback SVG handling (`onError`), and verify `PERSISTENT_UPLOADS_DIR` on Hostinger.

- **HIGH-10 — Missing confirmation before destructive social account deletion; raw browser `confirm()` elsewhere**
  - **Pages**: `/admin/settings`, `/admin/media`, `/admin/navigation`, `/admin/shop-inventory`
  - **Evidence**: `app/admin/settings/page.tsx:415-433` (`handleDeletePlatform`) immediately deletes the social media link and saves via `await updateStoreSettings(...)` on click with **zero confirmation**. `media/page.tsx:49`, `navigation/page.tsx:130,190`, and `shop-inventory/page.tsx:370` rely on blocking browser `window.confirm()`.
  - **Impact**: One accidental click permanently deletes a store social media link immediately; raw `confirm()` dialogs feel inconsistent and can be suppressed by browsers.
  - **Suggested Fix**: Add an in-app confirmation modal for deleting social accounts in `/admin/settings` and replace remaining `confirm()`/`alert()` calls with the existing modal and toast components.

---

### Medium (7)

- **MED-01 — Fake/unimplemented "Selection Mode" toggle in Best Sellers**
  - **Page**: `/admin/best-sellers`
  - **Evidence**: `app/admin/best-sellers/page.tsx:41,158-178` stores `const [mode, setMode] = useState<'manual' | 'automatic'>('manual');`, which never calls an API, never writes to `homepage-settings.json` or MySQL, and resets on refresh.
  - **Impact**: Misleads staff into thinking Best Sellers can switch to automatic calculation from sales/reviews.
  - **Suggested Fix**: Persist `mode` in `homepage-settings.json` and implement automatic sorting on the storefront, or remove the toggle until implemented.

- **MED-02 — Confusing Dashboard label `"Unpublished from bag"`**
  - **Page**: `/admin` & `/admin/dashboard`
  - **Evidence**: `app/admin/page.tsx:559` displays `Unpublished from bag` beneath the `OUT OF STOCK` counter (`admin-root.png`).
  - **Impact**: Confuses non-technical shop staff ("bag" is unclear, and out-of-stock products are not necessarily unpublished).
  - **Suggested Fix**: Change the subtitle to `"0 units in warehouse"` or `"Needs restocking"` and link it to `/admin/inventory?filter=out`.

- **MED-03 — Notifications bell is hardcoded `localStorage` mock data**
  - **Page**: Global Admin Header (`app/admin/layout.tsx:47,251,402-440`)
  - **Evidence**: `lib/db/notifications.ts:6-17` seeds a fake `"Admin control center is live and synced with MySQL."` notification into `localStorage` (even when DB is off), has no backend API, and `app/admin/layout.tsx` never exposes `markAllNotificationsAsRead()`.
  - **Impact**: Red notification badge `(1)` gives false reassurance about MySQL sync and never alerts staff about real new orders, low stock, or inquiries.
  - **Suggested Fix**: Feed the notification bell dynamically from recent pending orders, unresolved `NEW` inquiries, and low-stock counts (or a `notifications` table).

- **MED-04 — Heavy code duplication (`Wholesale` vs `Super Wholesale`) and 4 legacy redirect pages**
  - **Pages**: `/admin/wholesale` & `/admin/super-wholesale`; redirects `/admin/blog`, `/admin/login-page`, `/admin/shop-bills`, `/admin/shop-bills/new`
  - **Evidence**: `app/admin/wholesale/page.tsx` (1,162 lines) and `app/admin/super-wholesale/page.tsx` (1,170 lines) duplicate nearly identical state, tables, and 4 modals. Four legacy routes (`/admin/blog`, `/admin/login-page`, `/admin/shop-bills`, `/admin/shop-bills/new`) just redirect; `/admin/shop-bills/new` redirects to `/admin/shop-inventory?tab=create-bill` which fails to open the modal (`shop-inventory/page.tsx:54` only checks `tab === 'bills'`).
  - **Impact**: Double maintenance cost for B2B features and confusing half-working legacy URLs (`/admin/shop-bills/new`).
  - **Suggested Fix**: Extract a shared `<WholesaleAccountsManager tier="WHOLESALE" | "SUPER_WHOLESALE" />` component, fix `?tab=create-bill` handling (or remove redirect stubs), and delete `/admin/blog`.

- **MED-05 — POS Walk-in input placeholder truncated & all local dev products show `OUT OF STOCK`**
  - **Page**: `/admin/pos`
  - **Evidence**: In [pos.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/pos.png), the Walk-in customer input clips placeholder text to `"Customer Name (optio"`, and every product tile renders `"OUT OF STOCK"` because `seedProducts` / `data/dev-products.json` set warehouse `stock` without `shopStock`.
  - **Impact**: Local dev testing of POS checkout is blocked unless you manually create & finalize a Shop Bill first, and the walk-in field looks cramped at normal desktop widths.
  - **Suggested Fix**: Widen/wrap the two Walk-in inputs (`grid-cols-1 xl:grid-cols-2`) or shorten placeholder to `"Name (optional)"`, and include realistic `shopStock` values in `data/dev-products.json`.

- **MED-06 — Dual order APIs and public-readable `/api/admin/login-page/*` endpoints**
  - **APIs**: `/api/orders` vs `/api/admin/orders/[id]`, `/api/admin/login-page/media`, `/api/admin/login-page/settings`
  - **Evidence**: Order detail UI (`lib/db/orders.ts:428`) calls `/api/orders/[id]`, leaving `app/api/admin/orders/[id]/route.ts` redundant/divergent. Meanwhile `GET /api/admin/login-page/media` (`media/route.ts:53`) and `GET /api/admin/login-page/settings` (`settings/route.ts:64`) require no auth despite living under `/api/admin/` (duplicating `/api/login-page/*`).
  - **Impact**: Fixes made in `/api/orders/[id]` and `/api/admin/orders/[id]` can drift out of sync, and unauthenticated `/api/admin/*` GET endpoints muddy security audits.
  - **Suggested Fix**: Point all admin order actions to `/api/admin/orders/[id]` (with dev fallback) and require `requireAdmin` on all `GET /api/admin/login-page/*` routes (public login uses `/api/login-page/*`).

- **MED-07 — `GET /api/admin/logout` clears cookies without CSRF; dev pages take ~9–11.5s & load unpaginated 521-item catalog**
  - **APIs / Global**: `/api/admin/logout`, `/api/admin/products`
  - **Evidence**: `app/api/admin/logout/route.ts:35-38` logs out both admin and customer sessions on any `GET` request without CSRF. Live timings across all 42 pages ranged from **8,864ms** (`/admin/dashboard`) to **11,450ms** (`/admin/products/[id]`) in dev, and `GET /api/admin/products` returns all products unpaginated (`products/route.ts:35`).
  - **Impact**: Any `<img>` or link pointing to `/api/admin/logout` force-logs out an admin (Logout CSRF), and fetching all 521 products + syncing them into `localStorage` on every admin page visit slows down low-RAM tablets and risks `localStorage` 5MB quota exhaustion.
  - **Suggested Fix**: Remove `GET /api/admin/logout` (keep `POST` with CSRF), and add server-side pagination/search to `/api/admin/products` instead of caching 521 full products in `localStorage`.

---

### Low (4)

- **LOW-01 — Flat 31-item sidebar with no grouping overflows vertically**
  - **Page**: Global Admin Layout (`app/admin/layout.tsx:60-92`)
  - **Evidence**: All 31 navigation items sit in one flat ungrouped `<nav>` list; items below "Home Page Videos" require scrolling inside the 900px viewport ([admin-root.png](file:///e:/Antigravity/codes/Al%20Hamd%20FINAL/scratch/admin-audit/admin-root.png)).
  - **Suggested Fix**: Organize the 31 links into 5–6 collapsible/labeled groups (see Section 7 UX Review).

- **LOW-02 — Inconsistent naming between sidebar labels and page `<h1>` titles**
  - **Pages**: Several sidebar pages
  - **Evidence**: Examples verified in live DOM/screenshots: `Store & Bill Settings` → `"Bill & Invoice Settings"`, `Payment Methods & CMS` → `"Checkout Payment Content Management"`, `Home Page Videos` → `"Homepage Hero Sequence"`, `Promo Codes` → `"Promo & Discount Codes"`, `Activity Logs` → `"Audit & Activity Log"`, `Customers` → `"Customers & Clients"`.
  - **Suggested Fix**: Standardize labels so sidebar links and page headings match word-for-word.

- **LOW-03 — Create/Detail pages lack semantic `<h1>` elements**
  - **Pages**: `/admin/products/new`, `/admin/products/[id]`, `/admin/orders/[id]`, `/admin/inquiries/[id]`
  - **Evidence**: Playwright recorded `h1: ""` on all 4 pages during the live check.
  - **Suggested Fix**: Render a clear `<h1>` heading at the top of each form/detail view for accessibility and consistent hierarchy.

- **LOW-04 — Blocking browser `alert()` dialogs used in 5 admin pages**
  - **Pages**: `/admin/categories`, `/admin/deals`, `/admin/inquiries/[id]`, `/admin/pages`, `/admin/payments`
  - **Evidence**: Verified via static scan (`categories/page.tsx:150,175,295`, `deals/page.tsx:345`, `inquiries/[id]/page.tsx:105`, `pages/page.tsx:190`, `payments/page.tsx:87,106`).
  - **Suggested Fix**: Replace all `window.alert()` calls with the inline toast banners already used elsewhere in the admin.

---

## 7. UX REVIEW

### 1. Sidebar Length & Suggested Grouping
Currently the sidebar has **31 flat links** with no dividers or section headers. On a 1440×900 laptop screen, roughly 11 items at the bottom are pushed below the fold and require scrolling. Proposed 6-group structure:
1. **Overview & Counter**: Dashboard (`/admin`), Shop Counter / POS (`/admin/pos`)
2. **Orders & Billing**: Orders (`/admin/orders`), Payment Verification (`/admin/payments`), Invoices & Bills (`/admin/invoices`), Store & Bill Settings (`/admin/bill-settings`)
3. **Catalog & Stock**: Products (`/admin/products`), Categories (`/admin/categories`), Brands (`/admin/brands`), Inventory Warehouse (`/admin/inventory`), Shop Inventory (`/admin/shop-inventory`)
4. **Customers & B2B**: Customers (`/admin/customers`), Customer Inquiries (`/admin/inquiries`), Wholesale Accounts (`/admin/wholesale`), Super Wholesale Accounts (`/admin/super-wholesale`), Sales & Reports (`/admin/sales`)
5. **Marketing & Storefront**: Homepage Control (`/admin/homepage`), Home Page Videos (`/admin/homepage-videos`), New Arrivals (`/admin/new-arrivals`), Best Sellers (`/admin/best-sellers`), Deals (`/admin/deals`), Promo Codes (`/admin/promo-codes`), Navigation Menu (`/admin/navigation`), Pages & Legal (`/admin/pages`), Media Library (`/admin/media`)
6. **Settings & Team**: Store Settings (`/admin/settings`), SEO & Website Settings (`/admin/settings/seo`), Payment Methods & CMS (`/admin/payment-methods`), Login Appearance (`/admin/settings/login-appearance`), Shop Location (`/admin/shop-location`), Staff Management (`/admin/staff`), Activity Logs (`/admin/activity`)

*(Also consider merging `Store & Bill Settings`, `Shop Location`, `Payment Methods`, `SEO`, and `Login Appearance` as sub-tabs under Settings/Storefront so top-level sidebar items drop from 31 to ~22.)*

### 2. Repeated / Confusing Labels
- **Sidebar vs Page Titles**: `Store & Bill Settings` vs `Bill & Invoice Settings`; `Home Page Videos` vs `Homepage Hero Sequence`; `Payment Methods & CMS` vs `Checkout Payment Content Management`; `Activity Logs` vs `Audit & Activity Log`.
- **Dashboard Routes**: `/admin` and `/admin/dashboard` render the exact same screen, yet `/admin/login` sends admins to `/admin/dashboard` while the sidebar highlights `/admin`.
- **Dashboard Card**: `"Out of Stock"` subtitle `"Unpublished from bag"` does not make sense for stock management.

### 3. Missing Confirmations Before Destructive Actions
- **No confirmation at all**: Deleting a social account on `/admin/settings` (`handleDeletePlatform`) immediately removes and persists the deletion.
- **Raw `window.confirm()` instead of in-app modal**: Used for deleting media in `/admin/media`, deleting announcements/menu items in `/admin/navigation`, and removing products from shop inventory in `/admin/shop-inventory`.
- **No-confirm write action**: `Duplicate` on `/admin/products` immediately creates a new product record on click rather than opening `/admin/products/new` prefilled.

### 4. Mobile / Tablet Usability (Checked at 768×1024px)
- **Horizontal overflow**: All 7 core pages tested at 768px (`/admin`, `/admin/pos`, `/admin/orders`, `/admin/products`, `/admin/staff`, `/admin/settings`, `/admin/bill-settings`) reported `scrollWidth === 768 === innerWidth` (**zero horizontal page overflow**).
- **Navigation drawer**: `lg:hidden` hamburger drawer button (`aria-label="Open navigation drawer"`) was rendered on 6/7 pages at 768px; on `/admin/orders` it had not mounted yet during the fast 500ms `domcontentloaded` snapshot because `AdminShell` waits for `AdminAuthContext` hydration (`Verifying Staff Permissions...` full-screen spinner) before rendering the header/drawer button.
- **POS & Wide Tables**: At 768px, multi-column tables rely on horizontal inner scrolling inside table wrappers, and the POS Walk-in input placeholder already clips even at 1440px (`"Customer Name (optio"`).

### 5. Slow Pages & Scalability Risks
- Every admin route took **8.86s – 11.45s** in local Next.js dev mode (`npm run dev`), largely due to on-demand route compilation plus synchronous root layout settings/nav lookups and unauthenticated customer context calls.
- In production with **521 products**, `GET /api/admin/products` loads the entire catalog at once (including all models/colors/media) and multiple pages copy it into `localStorage` (`persistCollection('products', ...)`), risking slow hydration and browser storage limits on mobile/tablet POS terminals.

---

## 8. SUMMARY (Top 10 Things to Fix First, in Order)

1. Make `/admin/pos` call `POST /api/admin/pos` directly and wait for MySQL confirmation instead of fire-and-forget `POST /api/orders` (`CRIT-01`).
2. Add `requireAdmin()` authentication to `GET /api/admin/products/[id]` so unauthenticated visitors cannot read wholesale and cost prices (`CRIT-03`).
3. Create `/api/admin/customers` and connect `/admin/customers` and the Dashboard customer count to the MySQL `customers` table (`CRIT-02`).
4. Add missing RBAC permission checks (`requireAdmin`) to `/api/admin/pages/[id]`, `/api/admin/locations`, `/api/admin/password-resets/*`, `POST /api/admin/login-page/media`, and the three upload routes (`HIGH-01`, `HIGH-02`).
5. Ensure `DATA_DIR` and `PERSISTENT_UPLOADS_DIR` are set outside the Hostinger app root (or move Payment Methods, Homepage Settings, Navigation, Announcements, and Shop Locations into MySQL) so redeploys never wipe settings (`CRIT-04`).
6. Fix `/api/admin/promotions/usages` to query the MySQL `promo_code_usages` table instead of client `localStorage` (`CRIT-05`).
7. Unify mismatched permission keys across sidebar, `lib/permissions.ts`, pages, and APIs for Payment Methods, Wholesale/Super Wholesale, Homepage Videos, Deals, and Shop Bills (`HIGH-03`).
8. Wire `/admin/activity` to await `syncActivityLogsFromApi()` on mount and move Custom Staff Roles (`/admin/staff`) from `localStorage` into MySQL (`HIGH-04`, `HIGH-05`).
9. Skip `<CustomerAuthProvider>` (`/api/auth/customer/me`) inside `/admin/**` to eliminate the 401 console error on all 42 admin pages, and clean up the broken 404 sample upload URLs (`HIGH-08`, `HIGH-09`).
10. Add a delete confirmation modal for Social Links on `/admin/settings`, remove the fake Best Sellers mode toggle, fix the `"Unpublished from bag"` label, and group the 31-item sidebar (`HIGH-10`, `MED-01`, `MED-02`, `LOW-01`).

