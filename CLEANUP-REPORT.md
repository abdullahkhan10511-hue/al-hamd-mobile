# AL-HAMD SHOP — Safe Cleanup Report (Step 8)
**Date:** 2026-11-07  
**Project:** `al-hamd-app` (AL-HAMD SHOP)  
**Execution Mode:** Production-Safe with Rollback Protection  

---

## 1. Summary of Actions
In accordance with **TASK W6**, safe cleanup was conducted to remove provably unused code, isolate dead files, eliminate dead imports, and prevent shipping the full 521-product database to retail visitors.

All backups were captured prior to editing in:
- `/_security_backups/step8_20261107/` (modified files)
- `/_security_backups/step8_unused/` (unused files preserved with folder structure)

---

## 2. Unused Files Moved (Preserved, Not Deleted)
Under the strict Safety Rule (never permanently delete code files), dead files were relocated to `/_security_backups/step8_unused/` retaining their original path hierarchy:

| Original Path | Destination Path | Rationale & Proof of Zero References |
|---|---|---|
| `lib/validation/schemas.ts` | `_security_backups/step8_unused/lib/validation/schemas.ts` | Contained `BoundedArrayLimit`, `cartItemSchema`, `orderSubmissionSchema`, and `promoValidationItemsSchema`. AST and text grep across all `.ts` and `.tsx` files confirmed 0 external imports or references. Production build passed (`103/103` pages). |

---

## 3. Unused Imports Removed
All imports listed below were verified via `tsc --noEmit --noUnusedLocals` and safe removal confirmed with `npx tsc --noEmit` and `npm run build`:

| File | Removed Imports | Rationale |
|---|---|---|
| `components/products/ProductDetailClient.tsx` | `getProducts`, `fetchProductBySlug`, `syncProductsFromApi` | Component receives `initialProduct` via SSR. Dynamic updates use slug-scoped listener. Catalogue sync was redundant. |
| `components/layout/SearchModal.tsx` | `getProducts`, `syncProductsFromApi`, `normalizeSearchText` | Replaced full-catalogue client array filtering with server-side query `/api/products?search=...&limit=12&minimal=true`. |
| `components/home/BestSellers.tsx` | `syncProductsFromApi` | Replaced client background sync with ISR server props passed from `app/page.tsx` (`getServerBestSellers(3)`). |
| `components/home/NewArrivals.tsx` | `syncProductsFromApi`, `getProducts` | Replaced client background sync with ISR server props passed from `app/page.tsx` (`getServerNewArrivals(6)`). |
| `components/home/AllProductsSection.tsx` | `syncProductsFromApi`, `getProducts`, `syncCategoriesFromApi`, `getActiveCategories` | Replaced unpaginated array memory slicing with server props (`initialProducts`, `initialTotal`) and paginated API loads. |
| `app/shop/page.tsx` | `syncProductsFromApi` | Replaced full-catalogue download on mount with bounded query `/api/products?limit=60&minimal=true`. |
| `lib/db/serverCatalog.ts` | `getAllProductsFromDb` | Unused repository import; replaced with bounded `getStorefrontProductsFromDb`. |

---

## 4. Unused Local Variables & Dead Code Eliminated
1. **Homepage Section Memory Slicing:**
   - In `BestSellers.tsx` and `NewArrivals.tsx`: Removed continuous re-filtering of 500+ items inside client components. Replaced with direct consumption of minimal projected items.
   - In `AllProductsSection.tsx`: Removed the client-side `filteredProducts = list.filter(...)` which loaded every product into memory to slice 12. Replaced with server-side SQL `LIMIT 12 OFFSET X`.
2. **Search Debounce & Redundant Filtering:**
   - In `SearchModal.tsx`: Removed client-side multi-field regex string search across entire product catalog in browser memory. Converted to server-side query with 250ms debounce, minimum 2 characters, and maximum 12 results.

---

## 5. NPM Dependencies Audit
- Checked dependencies in `package.json`:
  - `framer-motion`: Active for UI transitions & animations.
  - `lucide-react`: Active for icons across admin and storefront.
  - `mysql2`: Active for MariaDB database connectivity.
  - `nodemailer`: Active for SMTP transactional notifications and password resets.
  - `server-only`: Active for security boundary enforcement.
  - `zod`: Active for schema validation.
- **Result:** Zero unused npm packages. No uninstallation required.

---

## 6. Verification and Validation
- **TypeScript Type Check:** `npx tsc --noEmit` -> **0 errors**
- **Next.js Production Build:** `npm run build` -> **103/103 pages successfully generated**
- **Automated Verification Suites:**
  - `verify:step1`: 16/16 PASSED
  - `verify:step2`: 36/36 PASSED
  - `verify:step3`: 67/67 PASSED
  - `verify:step4`: 78/78 PASSED
  - `verify:step6`: 57/57 PASSED
  - `verify:step7a`: 62/62 PASSED
  - `verify:step7b`: 36/36 PASSED
  - `verify:step8`: 38/38 PASSED
  - `verify:animation`: 15/15 PASSED
  - `predeploy`: PASSED

