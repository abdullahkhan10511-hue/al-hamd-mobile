import {
  getProductEffectivePrice,
  getModelEffectivePrice,
  getSuperWholesaleSavings,
  isSuperWholesaleCustomer,
  isAnyWholesaleCustomer
} from '../lib/wholesale';
import {
  createSuperWholesaleAccount,
  getSuperWholesaleAccounts,
  updateSuperWholesaleAccount,
  updateSuperWholesaleAccountStatus,
  deleteSuperWholesaleAccount,
  authenticateCustomer
} from '../lib/db/customers';
import { Product, ProductModelVariant } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- STARTING SUPER WHOLESALE TEST SUITE ---\n');

  // 1. Central Pricing Resolver Tests
  console.log('1. Central Pricing Resolver Tests:');
  const sampleProduct = {
    id: 'test-prod-1',
    name: 'Sample Case',
    slug: 'sample-case',
    price: 1500,
    wholesalePrice: 1300,
    superWholesalePrice: 1150,
    stock: 50,
    category: 'Cases',
    images: [],
  } as unknown as Product;

  const retailCust = { id: 'c1', customerType: 'RETAIL' as const, fullName: 'Retail User' };
  const wholesaleCust = { id: 'c2', customerType: 'WHOLESALE' as const, fullName: 'Wholesale Shop', shopName: 'Shop A' };
  const superWholesaleCust = { id: 'c3', customerType: 'SUPER_WHOLESALE' as const, fullName: 'Super Shop', shopName: 'Super Shop B' };

  assert(getProductEffectivePrice(sampleProduct, null) === 1500, 'Unauthenticated user gets Retail price (1500)');
  assert(getProductEffectivePrice(sampleProduct, retailCust) === 1500, 'Retail user gets Retail price (1500)');
  assert(getProductEffectivePrice(sampleProduct, wholesaleCust) === 1300, 'Wholesale user gets Wholesale price (1300)');
  assert(getProductEffectivePrice(sampleProduct, superWholesaleCust) === 1150, 'Super Wholesale user gets Super Wholesale price (1150)');

  // 2. Safe Fallback Tests
  console.log('\n2. Safe Fallback Logic Tests:');
  const prodWithoutSuper = {
    id: 'test-prod-2',
    name: 'No Super Price Product',
    slug: 'no-super',
    price: 1000,
    wholesalePrice: 850,
    stock: 10,
    category: 'Accessories',
    images: [],
  } as unknown as Product;
  assert(
    getProductEffectivePrice(prodWithoutSuper, superWholesaleCust) === 850,
    'Product without superWholesalePrice safely falls back to Wholesale price (850)'
  );

  const prodOnlyRetail = {
    id: 'test-prod-3',
    name: 'Only Retail Price',
    slug: 'only-retail',
    price: 500,
    stock: 10,
    category: 'Accessories',
    images: [],
  } as unknown as Product;
  assert(
    getProductEffectivePrice(prodOnlyRetail, superWholesaleCust) === 500,
    'Product with neither super nor wholesale price safely falls back to Retail price (500)'
  );

  // 3. Model Variant Pricing Tests
  console.log('\n3. Model Variant Pricing Tests:');
  const modelWithSuper: ProductModelVariant = {
    id: 'm1',
    name: 'iPhone 13',
    price: 1500,
    wholesalePrice: 1300,
    superWholesalePrice: 1150,
    stock: 20,
    isActive: true,
  };
  const modelWithoutSuper: ProductModelVariant = {
    id: 'm2',
    name: 'iPhone 14',
    price: 1600,
    wholesalePrice: 1400,
    stock: 20,
    isActive: true,
  };

  assert(getModelEffectivePrice(sampleProduct, modelWithSuper, retailCust) === 1500, 'Model variant for retail user is 1500');
  assert(getModelEffectivePrice(sampleProduct, modelWithSuper, wholesaleCust) === 1300, 'Model variant for wholesale user is 1300');
  assert(getModelEffectivePrice(sampleProduct, modelWithSuper, superWholesaleCust) === 1150, 'Model variant for super wholesale user is 1150');
  assert(
    getModelEffectivePrice(sampleProduct, modelWithoutSuper, superWholesaleCust) === 1400,
    'Model without superWholesalePrice falls back to model wholesale price (1400)'
  );

  // 4. Savings Calculation
  console.log('\n4. Super Wholesale Savings Calculation:');
  const savings = getSuperWholesaleSavings(sampleProduct);
  assert(savings.amount === 350, 'Calculates correct savings amount (1500 - 1150 = 350)');
  assert(savings.percentage === 23, 'Calculates correct percentage (23%)');

  // 5. Customer Type Helpers
  console.log('\n5. Helper Functions:');
  assert(isSuperWholesaleCustomer(superWholesaleCust) === true, 'isSuperWholesaleCustomer returns true for SUPER_WHOLESALE');
  assert(isSuperWholesaleCustomer(wholesaleCust) === false, 'isSuperWholesaleCustomer returns false for WHOLESALE');
  assert(isAnyWholesaleCustomer(superWholesaleCust) === true, 'isAnyWholesaleCustomer returns true for SUPER_WHOLESALE');
  assert(isAnyWholesaleCustomer(wholesaleCust) === true, 'isAnyWholesaleCustomer returns true for WHOLESALE');
  assert(isAnyWholesaleCustomer(retailCust) === false, 'isAnyWholesaleCustomer returns false for RETAIL');

  // 6. Account Lifecycle (CRUD & Auth)
  console.log('\n6. Super Wholesale Account Management & Authentication:');
  const testShopName = `Test Shop ${Date.now()}`;
  const testPassword = 'Password123!';

  // Create
  const newAccount = await createSuperWholesaleAccount({
    shopName: testShopName,
    password: testPassword,
    phone: '03001234567',
    address: 'Shop #12, Hall Road, Lahore',
    status: 'active',
  });

  assert(newAccount.id.startsWith('cust-swh-'), 'Created account has super wholesale ID prefix');
  assert(newAccount.customerType === 'SUPER_WHOLESALE', 'Account type is SUPER_WHOLESALE');
  assert(newAccount.shopName === testShopName, 'Shop name matches');
  assert(newAccount.status === 'active', 'Account status is active');

  // Verify Listing
  const accounts = await getSuperWholesaleAccounts();
  const found = accounts.find((a) => a.id === newAccount.id);
  assert(!!found, 'Account is listed in getSuperWholesaleAccounts()');

  // Login Authentication Success
  const authCustomer = await authenticateCustomer(testShopName, testPassword);
  assert(authCustomer && authCustomer.customerType === 'SUPER_WHOLESALE', 'Login with Shop Name and Password succeeds as SUPER_WHOLESALE');
  assert(!('passwordHash' in authCustomer), 'Authenticated customer object does not expose passwordHash');

  // Login with Wrong Password Fails
  let badAuthFailed = false;
  try {
    await authenticateCustomer(testShopName, 'WrongPassword');
  } catch {
    badAuthFailed = true;
  }
  assert(badAuthFailed, 'Login with incorrect password throws error and is denied');

  // Status Deactivation
  const deactivated = await updateSuperWholesaleAccountStatus(newAccount.id, 'inactive');
  assert(deactivated === true, 'Account status updated to inactive successfully');

  let inactiveAuthFailed = false;
  try {
    await authenticateCustomer(testShopName, testPassword);
  } catch {
    inactiveAuthFailed = true;
  }
  assert(inactiveAuthFailed, 'Inactive account is denied login');

  // Status Reactivation
  const reactivated = await updateSuperWholesaleAccountStatus(newAccount.id, 'active');
  assert(reactivated === true, 'Account status restored to active successfully');

  const reactivatedAuth = await authenticateCustomer(testShopName, testPassword);
  assert(reactivatedAuth && reactivatedAuth.customerType === 'SUPER_WHOLESALE', 'Reactivated account login succeeds');

  // Password Reset / Update
  const newPass = 'NewSecret456!';
  await updateSuperWholesaleAccount(newAccount.id, { password: newPass });

  let oldPassFailed = false;
  try {
    await authenticateCustomer(testShopName, testPassword);
  } catch {
    oldPassFailed = true;
  }
  assert(oldPassFailed, 'Old password fails after reset');

  const newPassAuth = await authenticateCustomer(testShopName, newPass);
  assert(newPassAuth && newPassAuth.customerType === 'SUPER_WHOLESALE', 'New password succeeds after reset');

  // Account Deletion
  const deleteResult = await deleteSuperWholesaleAccount(newAccount.id);
  assert(deleteResult.success === true, 'Account deletion returns success true');

  let deletedAuthFailed = false;
  try {
    await authenticateCustomer(testShopName, newPass);
  } catch {
    deletedAuthFailed = true;
  }
  assert(deletedAuthFailed, 'Deleted account cannot log in');

  const afterDeleteAccounts = await getSuperWholesaleAccounts();
  const deletedFound = afterDeleteAccounts.find((a) => a.id === newAccount.id);
  assert(!deletedFound, 'Deleted account no longer present in listing');

  console.log('\n----------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('----------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
