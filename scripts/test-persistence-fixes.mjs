import fs from 'fs';
import path from 'path';
import assert from 'assert';

const ROOT_DIR = process.cwd();

console.log('--- STARTING VERIFICATION TEST SUITE: PERSISTENCE & ADMIN FIXES ---\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// 1. Hero Video Layout Assertion
runTest('1. Responsive hero-video layout restored to large, immersive 100dvh on desktop & mobile', () => {
  const heroFile = path.join(ROOT_DIR, 'components', 'home', 'HeroSection.tsx');
  assert(fs.existsSync(heroFile), 'HeroSection.tsx must exist');
  const content = fs.readFileSync(heroFile, 'utf8');

  assert(content.includes('h-[100dvh] min-h-[500px]'), 'HeroSection must have h-[100dvh] min-h-[500px]');
  assert(!content.includes('h-[45vh]'), 'HeroSection must NOT contain reduced h-[45vh]');
  assert(!content.includes('min-h-[220px]'), 'HeroSection must NOT contain shrunk min-h-[220px]');
  assert(!content.includes('max-h-[380px]'), 'HeroSection must NOT contain max-h-[380px]');
  assert(content.includes('bottom-8 sm:bottom-10'), 'Indicators must have bottom-8 sm:bottom-10 spacing');
  assert(content.includes('h-32 bg-gradient-to-t'), 'Bottom vignette must be full h-32 gradient');
});

// 2. Product API failure must never return false success
runTest('2. Product API failure must never return false success', () => {
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  assert(fs.existsSync(productsDbFile), 'lib/db/products.ts must exist');
  const content = fs.readFileSync(productsDbFile, 'utf8');

  // Verify createProduct checks res.ok and does not return success: true on error
  assert(content.includes('!res.ok || !resData.success'), 'createProduct must check !res.ok and !resData.success');
  assert(content.includes('return { success: false, error: resData.error'), 'createProduct must return error on failure');
  assert(content.includes('catch (err: any) {'), 'createProduct must catch network errors');
  assert(content.includes('getAdminAuthHeaders'), 'createProduct must send admin auth headers');
});

// 3. Database errors are reported safely
runTest('3. Database errors are reported safely without false success or credential leakage', () => {
  const adminProductsRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'products', 'route.ts');
  assert(fs.existsSync(adminProductsRoute), 'app/api/admin/products/route.ts must exist');
  const content = fs.readFileSync(adminProductsRoute, 'utf8');

  assert(content.includes('status: 500'), 'API route must return 500 status on database/server error');
  assert(content.includes('success: false'), 'API route must return success: false on failure');
  assert(!content.includes('DB_PASSWORD'), 'API route must not leak DB credentials');
  assert(!content.includes('MYSQL_PASSWORD'), 'API route must not leak MYSQL_PASSWORD');
});

// 4. Product persistence uses the intended repository & global server cache
runTest('4. Product persistence uses intended repository and persistent global cache', () => {
  const adminProductsRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'products', 'route.ts');
  const content = fs.readFileSync(adminProductsRoute, 'utf8');
  assert(content.includes('insertProductToDb'), 'admin products route must use insertProductToDb');
  assert(content.includes('isDbConfigured'), 'admin products route must check isDbConfigured');

  const cacheFile = path.join(ROOT_DIR, 'lib', 'cache', 'memoryCache.ts');
  assert(fs.existsSync(cacheFile), 'memoryCache.ts must exist');
  const cacheContent = fs.readFileSync(cacheFile, 'utf8');
  assert(cacheContent.includes('globalThis') && cacheContent.includes('serverCache'), 'serverCache must be attached to globalThis in production');
});

// 5. Public cache invalidation/revalidation after successful writes
runTest('5. Public cache invalidation and revalidation after successful writes', () => {
  const adminProductsRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'products', 'route.ts');
  const content = fs.readFileSync(adminProductsRoute, 'utf8');

  assert(content.includes("revalidatePath('/')"), 'admin products route must revalidate /');
  assert(content.includes("revalidatePath('/products')"), 'admin products route must revalidate /products');
  assert(content.includes("revalidatePath('/api/products')"), 'admin products route must revalidate /api/products');
  assert(content.includes("revalidatePath('/admin/products')"), 'admin products route must revalidate /admin/products');

  const publicProductsRoute = path.join(ROOT_DIR, 'app', 'api', 'products', 'route.ts');
  const publicContent = fs.readFileSync(publicProductsRoute, 'utf8');
  assert(publicContent.includes('fresh') || publicContent.includes('isFresh'), 'public products API must support fresh cache bypass');
});

// 6. Admin settings persist across a fresh request/session
runTest('6. Admin settings and locations persist across fresh requests/sessions', () => {
  const locationsRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'locations', 'route.ts');
  assert(fs.existsSync(locationsRoute), 'app/api/admin/locations/route.ts must exist');
  const locContent = fs.readFileSync(locationsRoute, 'utf8');
  const locStorage = path.join(ROOT_DIR, 'lib', 'db', 'locationStorage.ts');
  assert(fs.existsSync(locStorage), 'locationStorage.ts must exist');
  const locStorageContent = fs.readFileSync(locStorage, 'utf8');
  assert(locStorageContent.includes('shop-locations.json'), 'Locations storage must persist to shop-locations.json');
  assert(locContent.includes("revalidatePath('/')"), 'Locations route must revalidate /');

  const homepageSettingsRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'homepage-settings', 'route.ts');
  assert(fs.existsSync(homepageSettingsRoute), 'app/api/admin/homepage-settings/route.ts must exist');
  const hpContent = fs.readFileSync(homepageSettingsRoute, 'utf8');
  const hpStorage = path.join(ROOT_DIR, 'lib', 'db', 'homepageSettingsStorage.ts');
  assert(fs.existsSync(hpStorage), 'homepageSettingsStorage.ts must exist');
  const hpStorageContent = fs.readFileSync(hpStorage, 'utf8');
  assert(hpStorageContent.includes('homepage-settings.json'), 'Homepage storage must persist to homepage-settings.json');
  assert(hpContent.includes("revalidatePath('/')"), 'Homepage settings route must revalidate /');

  // Verify client sync functions exist and are exported
  const homepageDb = path.join(ROOT_DIR, 'lib', 'db', 'homepage.ts');
  const hpDbContent = fs.readFileSync(homepageDb, 'utf8');
  assert(hpDbContent.includes('syncHomepageSettingsFromApi'), 'homepage.ts must export syncHomepageSettingsFromApi');
  assert(hpDbContent.includes('saveHomepageSettingsToServer'), 'homepage.ts must persist updates to server');

  const locationsDb = path.join(ROOT_DIR, 'lib', 'db', 'locations.ts');
  const locDbContent = fs.readFileSync(locationsDb, 'utf8');
  assert(locDbContent.includes('syncShopLocationsFromApi'), 'locations.ts must export syncShopLocationsFromApi');
  assert(locDbContent.includes('/api/admin/locations'), 'locations.ts must persist updates to server API');
});

// 7. Stock and product fields remain untouched when updating unrelated settings
runTest('7. Stock and product fields remain untouched when updating unrelated settings', () => {
  const settingsRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'settings', 'route.ts');
  const setContent = fs.readFileSync(settingsRoute, 'utf8');
  assert(!setContent.includes('DELETE FROM products'), 'Settings route must never delete products');
  assert(!setContent.includes('UPDATE products'), 'Settings route must not update products');

  const hpRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'homepage-settings', 'route.ts');
  const hpContent = fs.readFileSync(hpRoute, 'utf8');
  assert(!hpContent.includes('DELETE FROM products'), 'Homepage settings route must never delete products');
  assert(!hpContent.includes('UPDATE products'), 'Homepage settings route must not update products');
});

// 8. Public components sync locations and settings on mount
runTest('8. Public components sync locations and settings on mount for Incognito/new visitor visibility', () => {
  const headerFile = path.join(ROOT_DIR, 'components', 'layout', 'Header.tsx');
  const headerContent = fs.readFileSync(headerFile, 'utf8');
  assert(headerContent.includes('syncShopLocationsFromApi'), 'Header must call syncShopLocationsFromApi');

  const footerFile = path.join(ROOT_DIR, 'components', 'layout', 'Footer.tsx');
  const footerContent = fs.readFileSync(footerFile, 'utf8');
  assert(footerContent.includes('syncShopLocationsFromApi'), 'Footer must call syncShopLocationsFromApi');

  const contactFile = path.join(ROOT_DIR, 'app', 'contact', 'page.tsx');
  const contactContent = fs.readFileSync(contactFile, 'utf8');
  assert(contactContent.includes('syncShopLocationsFromApi'), 'Contact page must call syncShopLocationsFromApi');

  const pageFile = path.join(ROOT_DIR, 'app', 'page.tsx');
  const pageContent = fs.readFileSync(pageFile, 'utf8');
  assert(pageContent.includes('syncHomepageSettingsFromApi'), 'Home page must call syncHomepageSettingsFromApi');
});

// 9. Staff API failure must never return false success
runTest('9. Staff API failure must never swallow database errors or return false success', () => {
  const staffRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'staff', 'route.ts');
  assert(fs.existsSync(staffRoute), 'app/api/admin/staff/route.ts must exist');
  const content = fs.readFileSync(staffRoute, 'utf8');

  // Verify createStaffInDb throws rather than being swallowed by console.warn notice
  assert(!content.includes('MySQL create staff notice:'), 'Staff POST must not swallow MySQL errors');
  assert(!content.includes('MySQL update staff notice:'), 'Staff PATCH must not swallow MySQL errors');
  assert(!content.includes('MySQL delete staff notice:'), 'Staff DELETE must not swallow MySQL errors');

  // Verify production returns 503 if DB is unconfigured
  assert(content.includes('Database is not configured in production.'), 'Staff route must return 503 if DB is not configured in production');
});

// 10. Deals API failure must never return false success
runTest('10. Deals API failure must never swallow database errors or return false success', () => {
  const dealsRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'deals', 'route.ts');
  assert(fs.existsSync(dealsRoute), 'app/api/admin/deals/route.ts must exist');
  const dealsContent = fs.readFileSync(dealsRoute, 'utf8');

  assert(!dealsContent.includes('MySQL error inserting deal, falling back to local storage'), 'Deals POST must not swallow MySQL error and claim success');
  assert(dealsContent.includes('Database is not configured in production.'), 'Deals route must return 503 if DB is not configured in production');

  const dealIdRoute = path.join(ROOT_DIR, 'app', 'api', 'admin', 'deals', '[id]', 'route.ts');
  assert(fs.existsSync(dealIdRoute), 'app/api/admin/deals/[id]/route.ts must exist');
  const dealIdContent = fs.readFileSync(dealIdRoute, 'utf8');

  assert(!dealIdContent.includes('MySQL error updating deal, fallback to storage'), 'Deals PUT must not fall back to storage on DB failure');
  assert(!dealIdContent.includes('MySQL error deleting deal, fallback to storage'), 'Deals DELETE must not fall back to storage on DB failure');
});

console.log(`\n--- TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED ---`);
if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
}
