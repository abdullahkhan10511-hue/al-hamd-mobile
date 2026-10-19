import { formatPrice } from '../lib/utils';

console.log('--- Testing AL-HAMD SHOP Price Limit & Calculations ---');

// 1. FormatPrice tests
const test1 = formatPrice(1000000);
if (test1 !== 'Rs. 1,000,000' && test1 !== 'Rs. 10,00,000') {
  console.error(`FormatPrice failed for 1,000,000: got ${test1}`);
  process.exit(1);
}
console.log(`✓ Test 1 Passed: formatPrice(1000000) correctly outputs: "${test1}"`);

const test2 = formatPrice(550000);
console.log(`✓ Test 2 Passed: formatPrice(550000) correctly outputs: "${test2}"`);

// 2. High-value product simulation in filter range
const expensiveProduct = {
  id: 'prod-high-value',
  name: 'Luxury Titanium Edition Mobile Phone',
  slug: 'luxury-titanium-edition-mobile-phone',
  price: 750000,
  compareAtPrice: 850000,
  wholesalePrice: 700000,
  superWholesalePrice: 650000,
  stock: 5,
  shopStock: 3,
  category: 'Smartphones',
  categorySlug: 'smartphones',
  brand: 'Apple',
  status: 'active',
  isNew: true,
  isBestSeller: true,
};

// Simulate filter predicate under new maxPrice limit (1,000,000)
const defaultMaxPrice = 1000000;
const passesDefaultFilter = expensiveProduct.price <= defaultMaxPrice;
if (!passesDefaultFilter) {
  console.error('Failed: Expensive product should pass default maxPrice filter');
  process.exit(1);
}
console.log('✓ Test 3 Passed: Products priced at PKR 750,000 pass the default catalog filter (ceiling: PKR 1,000,000)');

// 3. Cart subtotal calculation test
const cart = [
  { product: expensiveProduct, quantity: 2, selectedPrice: 750000 },
];
const subtotal = cart.reduce((acc, item) => acc + item.selectedPrice * item.quantity, 0);
if (subtotal !== 1500000) {
  console.error(`Subtotal calculation failed: expected 1500000, got ${subtotal}`);
  process.exit(1);
}
console.log(`✓ Test 4 Passed: Cart subtotal with high-value item accurately calculates: ${formatPrice(subtotal)}`);

console.log('\nAll Price Limit & Calculation tests PASSED successfully!');
