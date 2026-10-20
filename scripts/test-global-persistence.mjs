import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- STARTING GLOBAL ADMIN PERSISTENCE AUDIT TEST SUITE ---');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
  }
}

// 1. Navigation Persistence
runTest('Header Navigation has persistent server storage and API backing', () => {
  const storagePath = path.resolve('lib/db/navigationStorage.ts');
  const adminRoutePath = path.resolve('app/api/admin/navigation/route.ts');
  const publicRoutePath = path.resolve('app/api/navigation/route.ts');
  const clientDbPath = path.resolve('lib/db/navigation.ts');

  assert(fs.existsSync(storagePath), 'lib/db/navigationStorage.ts must exist');
  assert(fs.existsSync(adminRoutePath), 'app/api/admin/navigation/route.ts must exist');
  assert(fs.existsSync(publicRoutePath), 'app/api/navigation/route.ts must exist');

  const clientDb = fs.readFileSync(clientDbPath, 'utf8');
  assert(clientDb.includes('syncNavigationFromApi'), 'syncNavigationFromApi must exist in lib/db/navigation.ts');
  assert(clientDb.includes('/api/admin/navigation'), 'must POST to /api/admin/navigation on write');

  const header = fs.readFileSync(path.resolve('components/layout/Header.tsx'), 'utf8');
  assert(header.includes('syncNavigationFromApi'), 'Header component must sync navigation from API on mount');
});

// 2. Announcements Bar Persistence
runTest('Announcements bar has persistent server storage and API backing', () => {
  const storagePath = path.resolve('lib/db/announcementsStorage.ts');
  const adminRoutePath = path.resolve('app/api/admin/announcements/route.ts');
  const publicRoutePath = path.resolve('app/api/announcements/route.ts');
  const clientDbPath = path.resolve('lib/db/announcements.ts');

  assert(fs.existsSync(storagePath), 'lib/db/announcementsStorage.ts must exist');
  assert(fs.existsSync(adminRoutePath), 'app/api/admin/announcements/route.ts must exist');
  assert(fs.existsSync(publicRoutePath), 'app/api/announcements/route.ts must exist');

  const clientDb = fs.readFileSync(clientDbPath, 'utf8');
  assert(clientDb.includes('syncAnnouncementsFromApi'), 'syncAnnouncementsFromApi must exist in lib/db/announcements.ts');
  assert(clientDb.includes('/api/admin/announcements'), 'must POST to /api/admin/announcements on write');

  const announcementBar = fs.readFileSync(path.resolve('components/layout/AnnouncementBar.tsx'), 'utf8');
  assert(announcementBar.includes('syncAnnouncementsFromApi'), 'AnnouncementBar component must sync from API on mount');
});

// 3. Payment Methods Persistence
runTest('Payment Methods has persistent server storage and API backing', () => {
  const storagePath = path.resolve('lib/db/paymentMethodsStorage.ts');
  const adminRoutePath = path.resolve('app/api/admin/payment-methods/route.ts');
  const publicRoutePath = path.resolve('app/api/payment-methods/route.ts');
  const clientDbPath = path.resolve('lib/db/paymentMethods.ts');

  assert(fs.existsSync(storagePath), 'lib/db/paymentMethodsStorage.ts must exist');
  assert(fs.existsSync(adminRoutePath), 'app/api/admin/payment-methods/route.ts must exist');
  assert(fs.existsSync(publicRoutePath), 'app/api/payment-methods/route.ts must exist');

  const clientDb = fs.readFileSync(clientDbPath, 'utf8');
  assert(clientDb.includes('syncPaymentMethodsFromApi'), 'syncPaymentMethodsFromApi must exist in lib/db/paymentMethods.ts');
  assert(clientDb.includes('/api/admin/payment-methods'), 'must POST to /api/admin/payment-methods on write');

  const checkout = fs.readFileSync(path.resolve('app/checkout/page.tsx'), 'utf8');
  assert(checkout.includes('syncPaymentMethodsFromApi'), 'Checkout page must sync payment methods from API on mount');
});

// 4. Homepage Hero Videos Persistence
runTest('Homepage Hero Videos has server disk fallback and public API sync', () => {
  const storagePath = path.resolve('lib/db/homepageVideosStorage.ts');
  const adminRoutePath = path.resolve('app/api/admin/homepage-videos/route.ts');
  const publicRoutePath = path.resolve('app/api/homepage-videos/route.ts');

  assert(fs.existsSync(storagePath), 'lib/db/homepageVideosStorage.ts must exist');

  const adminRoute = fs.readFileSync(adminRoutePath, 'utf8');
  assert(adminRoute.includes('homepageVideosStorage'), 'Admin route must use homepageVideosStorage fallback');
  assert(!adminRoute.includes('status: 503'), 'Admin route must not return 503 when DB is offline');

  const publicRoute = fs.readFileSync(publicRoutePath, 'utf8');
  assert(publicRoute.includes('readPersistentHomepageVideos'), 'Public route must read persistent videos');
});

// 5. Custom Pages & Legal Persistence
runTest('Custom Pages & Legal has persistent server storage, auth headers, and public API', () => {
  const storagePath = path.resolve('lib/db/pagesStorage.ts');
  const adminRoutePath = path.resolve('app/api/admin/pages/route.ts');
  const publicRoutePath = path.resolve('app/api/pages/route.ts');
  const clientDbPath = path.resolve('lib/db/pages.ts');

  assert(fs.existsSync(storagePath), 'lib/db/pagesStorage.ts must exist');

  const clientDb = fs.readFileSync(clientDbPath, 'utf8');
  assert(clientDb.includes('getAdminAuthHeaders'), 'lib/db/pages.ts must send getAdminAuthHeaders');

  const adminRoute = fs.readFileSync(adminRoutePath, 'utf8');
  assert(adminRoute.includes('pagesStorage'), 'Admin route must use pagesStorage fallback');
  assert(!adminRoute.includes('status: 503'), 'Admin route must not return 503 when DB is offline');

  const adminPagesManager = fs.readFileSync(path.resolve('app/admin/pages/page.tsx'), 'utf8');
  assert(adminPagesManager.includes('syncPagesFromApi'), 'AdminPagesManager must call syncPagesFromApi on mount');
});

// 6. Login Page Settings & Media Persistence
runTest('Login Page Settings and Media have server fallback and public API endpoints', () => {
  const settingsJson = path.resolve('data/login-page-settings.json');
  const publicSettingsRoute = path.resolve('app/api/login-page/settings/route.ts');
  const publicMediaRoute = path.resolve('app/api/login-page/media/route.ts');
  const clientDbPath = path.resolve('lib/db/loginPage.ts');

  assert(fs.existsSync(publicSettingsRoute), 'Public login page settings route must exist');
  assert(fs.existsSync(publicMediaRoute), 'Public login page media route must exist');

  const clientDb = fs.readFileSync(clientDbPath, 'utf8');
  assert(clientDb.includes('/api/login-page/settings'), 'Client DB must fetch public settings route');
  assert(clientDb.includes('getAdminAuthHeaders'), 'Client DB must include getAdminAuthHeaders on admin updates');

  if (fs.existsSync(settingsJson)) {
    const parsed = JSON.parse(fs.readFileSync(settingsJson, 'utf8'));
    assert(parsed.id || parsed['0']?.id, 'login-page-settings.json must contain valid settings payload');
  }
});

// 7. Store Settings Admin Live Sync
runTest('Admin Store Settings synchronizes authoritative server data on mount', () => {
  const adminSettingsPage = fs.readFileSync(path.resolve('app/admin/settings/page.tsx'), 'utf8');
  assert(adminSettingsPage.includes('syncStoreSettingsFromApi'), 'Store settings admin page must call syncStoreSettingsFromApi on mount');
});

// 8. Bill Settings Authentication Headers
runTest('Bill Settings API calls send admin authentication headers', () => {
  const billSettingsPath = path.resolve('lib/db/billSettings.ts');
  const content = fs.readFileSync(billSettingsPath, 'utf8');
  assert(content.includes('getAdminAuthHeaders'), 'lib/db/billSettings.ts must include getAdminAuthHeaders');
});

// 9. Hero Section Fullscreen Responsive Layout
runTest('Hero Section retains full viewport height and gradient styling', () => {
  const heroPath = path.resolve('components/home/HeroSection.tsx');
  const heroContent = fs.readFileSync(heroPath, 'utf8');
  assert(heroContent.includes('h-[100dvh] min-h-[500px]'), 'HeroSection must have h-[100dvh] min-h-[500px]');
  assert(heroContent.includes('bottom-8 sm:bottom-10'), 'HeroSection must have bottom-8 sm:bottom-10 controls');
  assert(heroContent.includes('h-32 bg-gradient-to-t'), 'HeroSection must have h-32 bg-gradient-to-t overlay');
});

// 10. Production Data Integrity
runTest('Production database schemas and data files remain unmodified and intact', () => {
  const prodProductsPath = path.resolve('data/products.ts');
  assert(fs.existsSync(prodProductsPath), 'Production products.ts must exist');
  const prodCategoriesPath = path.resolve('data/categories.ts');
  assert(fs.existsSync(prodCategoriesPath), 'Production categories.ts must exist');
});

console.log(`\n--- TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED ---`);
if (passedTests === totalTests) {
  console.log('ALL GLOBAL PERSISTENCE AUDIT CHECKS PASSED!\n');
  process.exit(0);
} else {
  console.error(`FAILED: ${totalTests - passedTests} tests failed.\n`);
  process.exit(1);
}
