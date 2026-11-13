/**
 * AL-HAMD SHOP — STEP 15 VERIFICATION SUITE
 * Admin controls for homepage marquee animations and WhatsApp button
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Bootstrap with tsx if invoked directly by plain node
if (!process.execArgv.some((a) => a.includes('tsx')) && !process.env.TSX_CHILD) {
  const result = spawnSync('npx', ['tsx', `"${__filename}"`], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TSX_CHILD: '1', ALLOW_TEST_POOL: '1' },
  });
  process.exit(result.status ?? 0);
}

import { createRequire } from 'node:module';
const _nodeRequire = createRequire(import.meta.url);
try {
  const _sp = _nodeRequire.resolve('server-only');
  _nodeRequire.cache[_sp] = { id: _sp, filename: _sp, loaded: true, exports: {} };
} catch {}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32mPASS\x1b[0m [${totalTests}] ${testName}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31mFAIL\x1b[0m [${totalTests}] ${testName}`);
    if (details) console.error(`       \x1b[33mDetails:\x1b[0m ${details}`);
  }
}

async function run() {
  console.log('\n============================================================');
  console.log('       STEP 15 VERIFICATION: MARQUEE & WHATSAPP CONTROLS     ');
  console.log('============================================================\n');

  // 1. MIGRATION SCRIPT CHECK
  console.log('--- 1. Migration Script Checks ---');
  const migrationPath = path.resolve(projectRoot, 'scripts', 'migrations', 'add_site_ui_settings.sql');
  assert(fs.existsSync(migrationPath), 'SQL migration file exists', migrationPath);
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  assert(
    /CREATE TABLE IF NOT EXISTS [`"]?site_ui_settings[`"]?/i.test(sqlContent),
    'Migration contains safe additive CREATE TABLE IF NOT EXISTS site_ui_settings'
  );
  assert(
    /[`"]?setting_key[`"]?\s+VARCHAR/i.test(sqlContent) && /PRIMARY KEY/i.test(sqlContent),
    'Migration table has setting_key as PRIMARY KEY'
  );
  assert(
    /[`"]?setting_value[`"]?\s+TEXT/i.test(sqlContent),
    'Migration table has setting_value column'
  );

  // 2. PERMISSIONS CHECKS
  console.log('\n--- 2. Permissions & RBAC Checks ---');
  const permissionsTs = fs.readFileSync(path.resolve(projectRoot, 'lib', 'constants', 'permissions.ts'), 'utf8');
  assert(
    permissionsTs.includes("'settings.appearance'"),
    'settings.appearance permission is declared in ALL_PERMISSIONS'
  );

  const { canAccessAdminRoute } = await import('../lib/permissions.js');
  const ownerUser = { role: 'OWNER', isOwner: true, permissions: ['*'] };
  const superAdmin = { role: 'SUPER_ADMIN', isOwner: false, permissions: [] };
  const authorizedStaff = { role: 'STAFF', isOwner: false, permissions: ['settings.appearance'] };
  const unauthorizedStaff = { role: 'STAFF', isOwner: false, permissions: ['content.homepage'] };

  assert(
    canAccessAdminRoute(ownerUser, '/admin/homepage-animations'),
    'Owner can access /admin/homepage-animations'
  );
  assert(
    canAccessAdminRoute(superAdmin, '/admin/homepage-animations'),
    'SUPER_ADMIN can access /admin/homepage-animations'
  );
  assert(
    canAccessAdminRoute(authorizedStaff, '/admin/homepage-animations'),
    'Staff with settings.appearance can access /admin/homepage-animations'
  );
  assert(
    !canAccessAdminRoute(unauthorizedStaff, '/admin/homepage-animations'),
    'Staff without settings.appearance is denied /admin/homepage-animations'
  );
  assert(
    canAccessAdminRoute(authorizedStaff, '/admin/whatsapp'),
    'Staff with settings.appearance can access /admin/whatsapp'
  );
  assert(
    !canAccessAdminRoute(unauthorizedStaff, '/admin/whatsapp'),
    'Staff without settings.appearance is denied /admin/whatsapp'
  );

  // 3. ADMIN NAVIGATION INTEGRATION
  console.log('\n--- 3. Admin Layout Navigation Checks ---');
  const adminLayoutContent = fs.readFileSync(path.resolve(projectRoot, 'app', 'admin', 'layout.tsx'), 'utf8');
  assert(
    adminLayoutContent.includes("href: '/admin/homepage-animations'"),
    'Admin sidebar includes /admin/homepage-animations link'
  );
  assert(
    adminLayoutContent.includes("href: '/admin/whatsapp'"),
    'Admin sidebar includes /admin/whatsapp link'
  );

  // 4. ADMIN PAGES EXISTENCE
  console.log('\n--- 4. Admin Pages Checks ---');
  const animPagePath = path.resolve(projectRoot, 'app', 'admin', 'homepage-animations', 'page.tsx');
  const whatsappPagePath = path.resolve(projectRoot, 'app', 'admin', 'whatsapp', 'page.tsx');
  assert(fs.existsSync(animPagePath), 'Homepage animations admin page exists');
  assert(fs.existsSync(whatsappPagePath), 'WhatsApp button admin page exists');

  const animPageContent = fs.readFileSync(animPagePath, 'utf8');
  assert(animPageContent.includes('continuous') && animPageContent.includes('static'), 'Admin page supports continuous and static modes');
  assert(animPageContent.includes('cardHover') && animPageContent.includes('tilt'), 'Admin page supports 3D Tilt card hover');
  assert(animPageContent.includes('DEFAULT_HOMEPAGE_ANIMATIONS'), 'Admin page provides reset to default');

  const whatsappPageContent = fs.readFileSync(whatsappPagePath, 'utf8');
  assert(whatsappPageContent.includes('normalizePakistaniMobileNumber'), 'Admin page uses Pakistani mobile number normalizer');
  assert(whatsappPageContent.includes('defaultMessage') && whatsappPageContent.includes('{page}'), 'Admin page supports tokenized defaultMessage');

  // 5. PHONE NUMBER NORMALIZATION & URL BUILDER
  console.log('\n--- 5. Phone Normalization & WhatsApp URL Builder ---');
  const {
    normalizePakistaniMobileNumber,
    buildWhatsAppLink,
    HomepageAnimationsSettingsSchema,
    WhatsAppButtonSettingsSchema,
    DEFAULT_HOMEPAGE_ANIMATIONS,
    DEFAULT_WHATSAPP_SETTINGS,
  } = await import('../lib/db/siteUiSettings.js');

  assert(normalizePakistaniMobileNumber('03432200995') === '923432200995', 'Normalizes 03432200995 to 923432200995');
  assert(normalizePakistaniMobileNumber('+92 343 2200995') === '923432200995', 'Normalizes +92 343 2200995 to 923432200995');
  assert(normalizePakistaniMobileNumber('923432200995') === '923432200995', 'Normalizes 923432200995 as 923432200995');
  assert(normalizePakistaniMobileNumber('0300-1234567') === '923001234567', 'Normalizes dashed mobile number');
  assert(normalizePakistaniMobileNumber('021-1234567') === null, 'Rejects landline prefix 021');
  assert(normalizePakistaniMobileNumber('12345') === null, 'Rejects too short number');
  assert(normalizePakistaniMobileNumber('03991234567') === null, 'Rejects invalid carrier prefix 0399');

  const generatedUrl = buildWhatsAppLink('923432200995', 'Hello {page}! Link: {url}', {
    page: 'Bosch Drill 18V',
    url: 'https://alhamdshop.com/product/bosch-drill',
  });
  assert(
    generatedUrl.includes('https://wa.me/923432200995?text='),
    'buildWhatsAppLink formats wa.me URL correctly'
  );
  assert(
    decodeURIComponent(generatedUrl).includes('Hello Bosch Drill 18V! Link: https://alhamdshop.com/product/bosch-drill'),
    'Tokens {page} and {url} are substituted properly in wa.me link'
  );

  // 6. ZOD VALIDATION SCHEMAS
  console.log('\n--- 6. Zod Validation Schemas ---');
  const validAnim = HomepageAnimationsSettingsSchema.safeParse(DEFAULT_HOMEPAGE_ANIMATIONS);
  assert(validAnim.success, 'Default animation settings pass schema validation');

  const invalidAnim = HomepageAnimationsSettingsSchema.safeParse({
    categories: { ...DEFAULT_HOMEPAGE_ANIMATIONS.categories, style: 'non-existent' },
    brands: DEFAULT_HOMEPAGE_ANIMATIONS.brands,
  });
  assert(!invalidAnim.success, 'Invalid animation style is rejected by schema');

  const validWA = WhatsAppButtonSettingsSchema.safeParse(DEFAULT_WHATSAPP_SETTINGS);
  assert(validWA.success, 'Default WhatsApp settings pass schema validation');

  const invalidWA = WhatsAppButtonSettingsSchema.safeParse({
    ...DEFAULT_WHATSAPP_SETTINGS,
    phoneNumber: 'invalid-number',
  });
  assert(!invalidWA.success, 'Invalid phone number format is rejected by schema');

  // 7. SETTINGS REPOSITORY & PERSISTENCE
  console.log('\n--- 7. Repository Storage & Fallback Checks ---');
  const {
    getHomepageAnimationsSettings,
    saveHomepageAnimationsSettings,
    getWhatsAppButtonSettings,
    saveWhatsAppButtonSettings,
  } = await import('../lib/db/repositories/siteUiSettings.js');

  const initialAnim = await getHomepageAnimationsSettings();
  assert(initialAnim && initialAnim.settings && initialAnim.settings.categories, 'getHomepageAnimationsSettings returns valid structure');
  assert(typeof initialAnim.source === 'string', 'getHomepageAnimationsSettings reports source (db or local)');

  const testAnimPayload = {
    categories: {
      ...initialAnim.settings.categories,
      style: 'step',
      direction: 'rtl',
      stepSeconds: 3,
      cardHover: 'lift',
    },
    brands: {
      ...initialAnim.settings.brands,
      style: 'static',
      direction: 'ltr',
      cardHover: 'none',
    },
  };

  const saveAnimRes = await saveHomepageAnimationsSettings(testAnimPayload, 'verify-agent');
  assert(saveAnimRes.success, 'saveHomepageAnimationsSettings succeeds');

  const reloadedAnim = await getHomepageAnimationsSettings();
  assert(
    reloadedAnim.settings.categories.style === 'step' &&
    reloadedAnim.settings.brands.style === 'static',
    'Saved animation settings persist and match saved values'
  );

  // Restore defaults
  await saveHomepageAnimationsSettings(DEFAULT_HOMEPAGE_ANIMATIONS, 'verify-agent');

  const initialWA = await getWhatsAppButtonSettings();
  assert(initialWA && initialWA.settings && initialWA.settings.phoneNumber, 'getWhatsAppButtonSettings returns valid structure');

  const testWAPayload = {
    ...initialWA.settings,
    phoneNumber: '923001234567',
    showOn: 'except_checkout_cart',
    position: 'bottom_left',
    labelText: 'Help Desk',
  };

  const saveWARes = await saveWhatsAppButtonSettings(testWAPayload, 'verify-agent');
  assert(saveWARes.success, 'saveWhatsAppButtonSettings succeeds');

  const reloadedWA = await getWhatsAppButtonSettings();
  assert(
    reloadedWA.settings.phoneNumber === '923001234567' &&
    reloadedWA.settings.labelText === 'Help Desk',
    'Saved WhatsApp settings persist and match saved values'
  );

  // Restore defaults
  await saveWhatsAppButtonSettings(DEFAULT_WHATSAPP_SETTINGS, 'verify-agent');

  // 8. STOREFRONT CODE INTEGRATION CHECKS
  console.log('\n--- 8. Storefront Component Integration Checks ---');
  const floatingWAContent = fs.readFileSync(path.resolve(projectRoot, 'components', 'ui', 'FloatingWhatsApp.tsx'), 'utf8');
  assert(floatingWAContent.includes('initialSettings'), 'FloatingWhatsApp component accepts initialSettings prop');
  assert(floatingWAContent.includes('buildWhatsAppLink'), 'FloatingWhatsApp uses buildWhatsAppLink');
  assert(floatingWAContent.includes('except_checkout_cart'), 'FloatingWhatsApp implements except_checkout_cart rule');
  assert(floatingWAContent.includes('bottom_left'), 'FloatingWhatsApp supports bottom_left position');

  const rootLayoutContent = fs.readFileSync(path.resolve(projectRoot, 'app', 'layout.tsx'), 'utf8');
  assert(
    rootLayoutContent.includes('getWhatsAppButtonSettings') && rootLayoutContent.includes('<FloatingWhatsApp initialSettings='),
    'Root layout passes SSR initialSettings to FloatingWhatsApp'
  );

  const marqueeContent = fs.readFileSync(path.resolve(projectRoot, 'components', 'ui', 'Marquee.tsx'), 'utf8');
  assert(marqueeContent.includes("style?: 'continuous' | 'step' | 'static'"), 'Marquee component supports style prop');
  assert(marqueeContent.includes('staticScrollRef') && marqueeContent.includes('ChevronLeft'), 'Marquee implements static mode with arrows');
  assert(marqueeContent.includes('prefersReducedMotion'), 'Marquee handles prefers-reduced-motion');

  const catSectionContent = fs.readFileSync(path.resolve(projectRoot, 'components', 'home', 'ShopByCategories.tsx'), 'utf8');
  assert(catSectionContent.includes('MarqueeSectionSettings'), 'ShopByCategories imports MarqueeSectionSettings');
  assert(catSectionContent.includes('hoverEffect'), 'ShopByCategories respects card hover settings');

  const brandSectionContent = fs.readFileSync(path.resolve(projectRoot, 'components', 'home', 'ShopByBrands.tsx'), 'utf8');
  assert(brandSectionContent.includes('MarqueeSectionSettings'), 'ShopByBrands imports MarqueeSectionSettings');
  assert(brandSectionContent.includes('hoverEffect'), 'ShopByBrands respects card hover settings');

  const homePageContent = fs.readFileSync(path.resolve(projectRoot, 'app', 'page.tsx'), 'utf8');
  assert(
    homePageContent.includes('getHomepageAnimationsSettings') &&
    homePageContent.includes('settings={animSettingsRes?.settings?.categories}') &&
    homePageContent.includes('settings={animSettingsRes?.settings?.brands}'),
    'HomePage passes animation settings to ShopByCategories and ShopByBrands'
  );

  // 9. API ROUTE RBAC TEST
  console.log('\n--- 9. API Route Security Checks ---');
  const adminApiContent = fs.readFileSync(path.resolve(projectRoot, 'app', 'api', 'admin', 'ui-settings', 'route.ts'), 'utf8');
  assert(adminApiContent.includes('getAdminSessionAsync'), 'Admin UI Settings API enforces session check');
  assert(adminApiContent.includes('settings.appearance'), 'Admin UI Settings API checks settings.appearance permission');
  assert(adminApiContent.includes('assertSameOrigin'), 'Admin UI Settings API enforces CSRF check');

  const publicApiContent = fs.readFileSync(path.resolve(projectRoot, 'app', 'api', 'ui-settings', 'route.ts'), 'utf8');
  assert(publicApiContent.includes('getHomepageAnimationsSettings') && publicApiContent.includes('getWhatsAppButtonSettings'), 'Public UI Settings API provides read-only settings');
  assert(publicApiContent.includes('s-maxage=60'), 'Public UI Settings API includes cache header');

  console.log('\n============================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      \x1b[32m${passedTests}\x1b[0m`);
  console.log(`FAILED:      ${failedTests > 0 ? `\x1b[31m${failedTests}\x1b[0m` : '0'}`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Verification failed with unexpected error:', err);
  process.exit(1);
});
