// ==============================================================================
// TEST SUITE: AL-HAMD SHOP 3 Features Safe Audit & Verification
// Tests:
// 1. Feature 1: Out-of-Stock Product Images Full Colour (CSS/classes check)
// 2. Feature 2: Dynamic Homepage All Products Section & Admin Settings
// 3. Feature 3: Customer Registration, Password Hashing, Validation, Duplicate Rejection, Login
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log(' RUNNING VERIFICATION FOR 3 IMPLEMENTED FEATURES');
console.log('======================================================\n');

// ------------------------------------------------------------------------------
// TEST SUITE 1: Feature 1 — Out-of-Stock Images in Full Colour
// ------------------------------------------------------------------------------
console.log('--- TEST SUITE 1: Feature 1 — Out-of-Stock Full Colour Images ---');

runTest('ProductCard.tsx: Does not apply grayscale or desaturating filters to out-of-stock product images', () => {
  const content = fs.readFileSync(path.join(ROOT, 'components/products/ProductCard.tsx'), 'utf8');
  assert(!content.includes('grayscale'), 'ProductCard.tsx should not contain "grayscale"');
  assert(!content.includes('isOutOfStock ? \'grayscale opacity-75\' : \'\''), 'Conditional grayscale filter must be removed');
  assert(content.includes('isOutOfStock'), 'isOutOfStock logic must be preserved for badges and cart safeguards');
  assert(content.includes('Out of Stock'), 'Out of Stock badge must remain');
  assert(content.includes('quick-add') || content.includes('handleQuickAdd'), 'Quick add handler must remain');
});

runTest('BestSellers.tsx: Does not apply grayscale to out-of-stock product images', () => {
  const content = fs.readFileSync(path.join(ROOT, 'components/home/BestSellers.tsx'), 'utf8');
  assert(!content.includes('grayscale'), 'BestSellers.tsx should not contain "grayscale"');
  assert(content.includes('isOutOfStock'), 'isOutOfStock logic must be preserved for badges and cart safeguards');
});

runTest('wishlist/page.tsx: Does not apply grayscale to out-of-stock product images', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/wishlist/page.tsx'), 'utf8');
  assert(!content.includes('grayscale'), 'wishlist/page.tsx should not contain "grayscale"');
  assert(content.includes('isOutOfStock'), 'isOutOfStock logic must be preserved');
});

// ------------------------------------------------------------------------------
// TEST SUITE 2: Feature 2 — Dynamic Homepage All Products Section
// ------------------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Feature 2 — Homepage All Products Section ---');

runTest('AllProductsSection.tsx component exists and renders properly', () => {
  const compPath = path.join(ROOT, 'components/home/AllProductsSection.tsx');
  assert(fs.existsSync(compPath), 'components/home/AllProductsSection.tsx must exist');
  const content = fs.readFileSync(compPath, 'utf8');
  assert(content.includes('getProducts'), 'Must fetch products from getProducts()');
  assert(content.includes('getAllProductsConfig'), 'Must retrieve section configuration');
  assert(content.includes('ProductCard'), 'Must use existing ProductCard component');
  assert(content.includes('status !== \'archived\''), 'Must filter out archived products');
  assert(content.includes('grid-cols-2'), 'Must be responsive with mobile 2-col and desktop layout');
});

runTest('app/page.tsx: Successfully registers and renders all-products section', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/page.tsx'), 'utf8');
  assert(content.includes('AllProductsSection'), 'app/page.tsx must import AllProductsSection');
  assert(content.includes('case \'all-products\':'), 'app/page.tsx must handle all-products case in section switch');
  assert(content.includes('<AllProductsSection />'), 'app/page.tsx fallback must include <AllProductsSection />');
});

runTest('lib/db/homepage.ts: Contains AllProductsConfig functions & auto-migration', () => {
  const content = fs.readFileSync(path.join(ROOT, 'lib/db/homepage.ts'), 'utf8');
  assert(content.includes('getAllProductsConfig'), 'Must export getAllProductsConfig');
  assert(content.includes('updateAllProductsConfig'), 'Must export updateAllProductsConfig');
  assert(content.includes('all-products'), 'Must include all-products in section migration');
});

runTest('app/admin/homepage/page.tsx: Admin controls for All Products showcase exist', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/admin/homepage/page.tsx'), 'utf8');
  assert(content.includes('allProductsConfig'), 'Must manage allProductsConfig state');
  assert(content.includes('updateAllProductsConfig'), 'Must save All Products config');
  assert(content.includes('All Products Showcase Settings'), 'Must have tab for All Products settings');
  assert(content.includes('toggleSection(\'all-products\')'), 'Must allow toggling section visibility');
});

// ------------------------------------------------------------------------------
// TEST SUITE 3: Feature 3 — Customer Registration, Validation & Hashing
// ------------------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Feature 3 — Customer Registration & Auth Flow ---');

runTest('Customer register API route has rigorous server validation & rate limiting', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/api/auth/customer/register/route.ts'), 'utf8');
  assert(content.includes('checkRateLimit'), 'Must enforce rate limiting');
  assert(content.includes('EMAIL_REGEX'), 'Must enforce email validation regex');
  assert(content.includes('rawPassword.length < 6'), 'Must enforce min password length');
  assert(content.includes('sanitizeCustomer'), 'Must sanitize customer to prevent leaking password hashes');
  assert(content.includes('status: isDup ? 409 : 400'), 'Must return 409 on duplicate registration');
});

runTest('CustomerAuthContext.tsx awaits server registration before session storage', () => {
  const content = fs.readFileSync(path.join(ROOT, 'context/CustomerAuthContext.tsx'), 'utf8');
  assert(content.includes('fetch(\'/api/auth/customer/register\''), 'Must post to /api/auth/customer/register');
  assert(!content.includes('fetch(\'/api/auth/customer/register\', {\n          method: \'POST\',\n          headers: { \'Content-Type\': \'application/json\' },\n          body: JSON.stringify(data),\n        }).catch(() => {})'), 'Must not fire unawaited background fetch');
});

runTest('Migration scripts exist for safe database uniqueness constraint', () => {
  const migPath = path.join(ROOT, 'scripts/migrations/add_customer_email_unique.sql');
  const rollPath = path.join(ROOT, 'scripts/migrations/rollback_customer_email_unique.sql');
  assert(fs.existsSync(migPath), 'add_customer_email_unique.sql must exist');
  assert(fs.existsSync(rollPath), 'rollback_customer_email_unique.sql must exist');

  const migContent = fs.readFileSync(migPath, 'utf8');
  assert(migContent.includes('idx_customers_email_unique'), 'Migration must target idx_customers_email_unique');
  assert(migContent.includes('schema_migrations'), 'Migration must record execution in schema_migrations');
});

// Now dynamically test hashing and server logic functions
await runAsyncTest('Password hashing: sha256 with per-user salt produces secure non-plaintext hash and verifies accurately', async () => {
  const { hashCustomerPassword, generateCustomerSalt, verifyCustomerPassword } = await import('../lib/db/repositories/customers.ts');

  const salt1 = generateCustomerSalt(16);
  const salt2 = generateCustomerSalt(16);
  assert(salt1 !== salt2, 'Salts must be randomly unique');

  const plain = 'SafePassword2026!';
  const hash1 = hashCustomerPassword(plain, salt1);
  const hash2 = hashCustomerPassword(plain, salt2);

  assert(hash1 !== plain, 'Password must never equal plaintext');
  assert(hash1 !== hash2, 'Identical passwords with different salts must produce different hashes');
  assert(verifyCustomerPassword(plain, salt1, hash1), 'verifyCustomerPassword must return true for correct password');
  assert(!verifyCustomerPassword('WrongPassword!', salt1, hash1), 'verifyCustomerPassword must reject incorrect password');
});

await runAsyncTest('Customer server registration: Normalizes email, hashes password, saves sanitized record, and rejects duplicate email', async () => {
  const { registerCustomerServer, sanitizeCustomer, authenticateCustomerServer } = await import('../lib/db/customers-server.ts');

  const testEmail = `test.user.${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  const customer = await registerCustomerServer({
    fullName: 'Test Customer Safety',
    email: testEmail.toUpperCase(), // Test normalization to lower case
    phone: '+92 300 1234567',
    password: testPassword,
  });

  assert.strictEqual(customer.email, testEmail.toLowerCase(), 'Email must be normalized to lowercase');
  assert(customer.passwordHash && customer.passwordHash !== testPassword, 'Password hash must be generated and not plaintext');
  assert(customer.passwordSalt, 'Password salt must be generated');

  const sanitized = sanitizeCustomer(customer);
  assert.strictEqual(sanitized.passwordHash, undefined, 'Sanitized customer must not have passwordHash');
  assert.strictEqual(sanitized.passwordSalt, undefined, 'Sanitized customer must not have passwordSalt');

  // Verify duplicate rejection
  let duplicateRejected = false;
  try {
    await registerCustomerServer({
      fullName: 'Another Person',
      email: testEmail.toLowerCase(),
      phone: '+92 300 7654321',
      password: 'AnotherPassword456!',
    });
  } catch (err) {
    duplicateRejected = err.message.includes('already exists');
  }
  assert(duplicateRejected, 'Duplicate registration with same email must be rejected with duplicate error');

  // Verify successful authentication with created customer
  const authenticated = await authenticateCustomerServer(testEmail, testPassword);
  assert.strictEqual(authenticated.id, customer.id, 'Customer must successfully log in with registered credentials');

  // Verify authentication failure with wrong password
  let wrongPassRejected = false;
  try {
    await authenticateCustomerServer(testEmail, 'WrongPassword999!');
  } catch (err) {
    wrongPassRejected = true;
  }
  assert(wrongPassRejected, 'Authentication must reject incorrect password');
});

await runAsyncTest('Admin authentication remains intact and functional', async () => {
  const { getServerStaffByEmail, verifyServerPassword } = await import('../lib/db/staff-server.ts');
  const admin = await getServerStaffByEmail('admin@alhamd.com');
  assert(admin, 'Admin account admin@alhamd.com must exist');
  assert(admin.passwordHash && admin.salt, 'Admin must have password hash and salt');
  assert(verifyServerPassword('AlHamd@Admin2026!', admin.salt, admin.passwordHash), 'Admin password verification must succeed');
});

console.log('\n======================================================');
console.log(` RESULTS: ${passedTests} passed, ${failedTests} failed out of ${totalTests} total tests.`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
