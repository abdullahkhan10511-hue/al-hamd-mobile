const fs = require('fs');
const path = require('path');

const backupDir = path.join('_security_backups', 'step1_20261103');

const filesToBackup = [
  'app/api/admin/login/route.ts',
  'app/api/auth/customer/login/route.ts',
  'lib/db/staff.ts',
  'scripts/setup-admin.js',
  'lib/db/sessionToken.ts',
  'middleware.ts',
  '.env.example',
  'app/api/admin/products/import-url/route.ts',
  'lib/db/adminAuth.ts',
  'app/api/admin/staff/route.ts',
  'app/api/admin/password/route.ts',
  'lib/db/repositories/staff.ts',
  'lib/db/staff-server.ts',
  'lib/productSanitizer.ts',
  'lib/db/seed.ts',
  'firestore.rules',
  'scripts/test-three-features.mjs',
  'lib/db/activity.ts',
  'lib/db/admins.ts',
  'lib/db/announcements.ts',
  'lib/db/billSettings.ts',
  'lib/db/blog.ts',
  'lib/db/brands.ts',
  'lib/db/categories.ts',
  'lib/db/customers-server.ts',
  'lib/db/customers.ts',
  'lib/db/deals.ts',
  'lib/db/homepage.ts',
  'lib/db/homepageVideos.ts',
  'lib/db/locations.ts',
  'lib/db/loginPage.ts',
  'lib/db/media.ts',
  'lib/db/navigation.ts',
  'lib/db/orders.ts',
  'lib/db/pages.ts',
  'lib/db/paymentMethods.ts',
  'lib/db/products.ts',
  'lib/db/promotions.ts',
  'lib/db/repositories/activity.ts',
  'lib/db/repositories/categories.ts',
  'lib/db/repositories/orders.ts',
  'lib/db/repositories/products.ts',
  'lib/db/repositories/settings.ts',
  'lib/db/serverDevStorage.ts',
  'lib/db/settings.ts',
  'app/api/admin/bill-settings/route.ts',
  'app/admin/bill-settings/page.tsx',
  'app/admin/brands/page.tsx',
  'app/admin/categories/page.tsx',
  'app/admin/customers/page.tsx',
  'app/admin/deals/page.tsx',
  'app/admin/inventory/page.tsx',
  'app/admin/login/page.tsx',
  'app/admin/orders/[id]/page.tsx',
  'app/admin/pages/page.tsx',
  'app/admin/payment-methods/page.tsx',
  'app/admin/payments/page.tsx',
  'app/admin/settings/page.tsx',
  'app/admin/settings/seo/page.tsx',
  'app/admin/shop-inventory/page.tsx',
  'app/admin/shop-location/page.tsx',
  'app/admin/super-wholesale/page.tsx',
  'app/admin/wholesale/page.tsx',
  'components/admin/ProductForm.tsx',
  'context/AdminAuthContext.tsx',
  'lib/db/adminLoginAppearance.ts'
];

let count = 0;
for (const relPath of filesToBackup) {
  const src = path.resolve(relPath);
  if (fs.existsSync(src)) {
    const dest = path.join(backupDir, relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    count++;
  } else {
    console.warn('Source file not found for backup:', relPath);
  }
}

console.log(`Successfully backed up ${count} files to ${backupDir}`);

