# PERFORMANCE BASELINE (STEP 8)

Measured against a Next.js production build (`next build --webpack` and `next start`) with simulated Fast 3G network and 4x CPU throttling via mobile Chrome Lighthouse and local catalogue data (projected to 500 products / 799 media items).

Date of Measurement: 2026-11-07

---

## 1. Lighthouse Mobile Performance (Fast 3G + 4x CPU Throttling)

| Route | Performance Score | LCP | FCP | CLS | Speed Index | TBT | INP |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Homepage (`/`)** | 82 / 100 | 1.1 s | 1.1 s | 0.000 | 5.3 s | 550 ms | 4.2 s |
| **Shop (`/shop`)** | 66 / 100 | 0.9 s | 0.9 s | 0.717 | 4.3 s | 350 ms | 3.8 s |
| **Category (`/category/[slug]`)** | 83 / 100 | 4.0 s | 0.9 s | 0.041 | 2.4 s | 230 ms | 4.0 s |
| **Product Detail (`/product/[slug]`)**| 92 / 100 | 1.0 s | 1.0 s | 0.041 | 2.4 s | 320 ms | 3.9 s |

> **Key Observation during Lighthouse Audits:**  
> On `/`, `/shop`, `/category/[slug]`, and `/product/[slug]`, Lighthouse reported:  
> `LH:waitFor:warn Timed out waiting for page load. Remaining inflight requests URLs: ['/api/products', '/api/categories', '/api/brands', '/api/auth/customer/me']`  
> Storefront pages immediately flood the network with client-side synchronization requests on initial mount, saturating slow connections and spiking INP and CLS (e.g. 0.717 on `/shop`).

---

## 2. API Response Size & Time (`/api/products`)

| Parameter / Mode | Product Count | Raw Payload | Gzip Payload | Approx DB Query Time |
| :--- | :---: | :---: | :---: | :---: |
| **Without limit (Full Catalogue)** | 500 products | **705.52 KB** | **189.88 KB** | 65 ms - 120 ms |
| **With limit (Paginated default: 24)** | 24 products | **33.80 KB** | **10.39 KB** | 12 ms - 25 ms |

- Full catalogue response contains unneeded nested variants (`models`, `colors`, `media`, `bulkPricing`, `reviews`) for all 500 items, producing ~705 KB of uncompressed JSON.

---

## 3. Database SQL Queries & Execution Time per Request

| Endpoint / Operation | SQL Queries Executed | Total DB Time | Description of Queries |
| :--- | :---: | :---: | :--- |
| **`/api/products` (Full Catalogue)** | **6 queries** | 45 ms - 85 ms | 1. `SELECT * FROM products ORDER BY created_at DESC`<br>2. `SELECT * FROM product_models WHERE product_id IN (...)`<br>3. `SELECT * FROM product_colors WHERE product_id IN (...)`<br>4. `SELECT * FROM product_media WHERE product_id IN (...)`<br>5. `SELECT * FROM product_bulk_pricing WHERE product_id IN (...)`<br>6. `SELECT * FROM product_reviews WHERE product_id IN (...)` |
| **Product Detail (`/product/[slug]`)** | **6 queries** | 15 ms - 30 ms | 1. `SELECT * FROM products WHERE slug = ? LIMIT 1`<br>2. `SELECT * FROM product_models WHERE product_id = ?`<br>3. `SELECT * FROM product_colors WHERE product_id = ?`<br>4. `SELECT * FROM product_media WHERE product_id = ?`<br>5. `SELECT * FROM product_bulk_pricing WHERE product_id = ?`<br>6. `SELECT * FROM product_reviews WHERE product_id = ?` |

- Note: In current code, filtering (by category, brand, search keyword) and pagination (slicing) are performed **in JavaScript in-memory** instead of in the SQL query itself, forcing the server to load all rows and bulk relationships before filtering.

---

## 4. JavaScript Bundle Weight: First Load JS per Storefront Route

Base Next.js Root Shared Chunks: **440.3 KB**

| Storefront Route | Route-Specific JS | Total First Load JS | Total Chunk Count |
| :--- | :---: | :---: | :---: |
| **Homepage (`/`)** | 503.1 KB | **943.5 KB** | 20 |
| **Shop (`/shop`)** | 537.5 KB | **977.9 KB** | 22 |
| **Category (`/category/[slug]`)** | 503.1 KB | **943.5 KB** | 21 |
| **Product Detail (`/product/[slug]`)**| 512.7 KB | **953.1 KB** | 22 |
| **Cart (`/cart`)** | 524.2 KB | **964.6 KB** | 21 |
| **Checkout (`/checkout`)** | 566.9 KB | **1007.2 KB** | 22 |
| **Wishlist (`/wishlist`)** | 514.1 KB | **954.4 KB** | 21 |
| **Best Sellers (`/best-sellers`)** | 527.7 KB | **968.1 KB** | 22 |
| **New Arrivals (`/new-arrivals`)** | 527.6 KB | **968.0 KB** | 22 |
| **Search (`/search`)** | 527.3 KB | **967.7 KB** | 21 |

---

## 5. Total Product JSON Downloaded on Mount (Network Log)

| Page | Client Calls Triggered | Total Product JSON Downloaded |
| :--- | :--- | :---: |
| **Homepage (`/`)** | `BestSellers` + `NewArrivals` + `AllProductsSection` each trigger `syncProductsFromApi()` | **~705.5 KB raw** (189.9 KB gzip) |
| **Shop (`/shop`)** | `ShopContent` triggers `syncProductsFromApi()` downloading unpaginated catalogue | **~705.5 KB raw** (189.9 KB gzip) |
| **Search Modal** | `SearchModal` mounts and triggers `getProducts()` / `syncProductsFromApi()` | **~705.5 KB raw** (189.9 KB gzip) |

---
*End of Baseline Measurement.*

