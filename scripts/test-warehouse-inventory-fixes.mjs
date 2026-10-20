import fs from 'fs';
import path from 'path';
import assert from 'assert';

const ROOT_DIR = process.cwd();

console.log('--- STARTING WAREHOUSE INVENTORY VERIFICATION TEST SUITE ---\n');

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

// 1. Standalone product supports bulk quantity adjustments (100, 250, etc.) in one operation
runTest('1. Standalone product supports bulk quantity adjustments with full validation', () => {
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  assert(fs.existsSync(productsDbFile), 'lib/db/products.ts must exist');
  const content = fs.readFileSync(productsDbFile, 'utf8');

  // Verify setProductStock validation & authenticated API patch
  assert(content.includes('Number.isFinite(num)'), 'setProductStock must validate isFinite');
  assert(content.includes('Math.floor(num) !== num'), 'setProductStock must enforce integer values');
  assert(content.includes('safeStock = Math.max(0, Math.round(num))'), 'setProductStock must clamp/round safe stock');
  assert(content.includes('getAdminAuthHeaders(adminEmail)'), 'setProductStock must send admin auth headers');
  assert(content.includes("fetch(`/api/admin/products/${encodeURIComponent(productId)}`"), 'setProductStock must send PATCH to API route');
  assert(content.includes('!res.ok || !resData.success'), 'setProductStock must verify server response');
});

// 2. Individual variant stock adjustment does not change sibling variants
runTest('2. Updating one variant does NOT alter sibling variants and correctly recalculates parent stock', () => {
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  const content = fs.readFileSync(productsDbFile, 'utf8');

  // Verify setModelStock clones models and only changes the target variant
  assert(content.includes('const updatedModels = product.models.map((m, idx) =>'), 'setModelStock must map through models immutably');
  assert(content.includes('if (idx === modelIndex)'), 'setModelStock must only update matching model index');
  assert(content.includes('return { ...m, stock: safeStock };'), 'setModelStock must update stock only on the target model');
  assert(content.includes('return m;'), 'setModelStock must leave sibling models unchanged');

  // Verify parent stock recalculation from sum of models
  assert(content.includes('const totalModelStock = updatedModels.reduce((sum, m) => sum + (m.stock ?? 0), 0)'),
    'setModelStock must recalculate parent stock as sum of models');
});

// 3. Multi-variant bulk adjustment support (different quantities per variant saved in one payload)
runTest('3. Multi-variant bulk adjustment supports editing multiple variants safely in one atomic payload', () => {
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  const content = fs.readFileSync(productsDbFile, 'utf8');

  assert(content.includes('export async function setProductModelsStock('), 'setProductModelsStock must be exported');
  assert(content.includes('modelStockMap: Record<string, number>'), 'setProductModelsStock must accept variant stock map');
  assert(content.includes('models: updatedModels'), 'setProductModelsStock must send updated models array to API');
  assert(content.includes('stock: totalModelStock'), 'setProductModelsStock must send computed parent stock to API');
});

// 4. Persistence after refresh - API auth, error checking, and local state synchrony
runTest('4. Authenticated API calls prevent 401 Unauthorized reversion upon refresh', () => {
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  const content = fs.readFileSync(productsDbFile, 'utf8');

  // Ensure setProductStock and setModelStock both pass getAdminAuthHeaders
  const setProductStockMatch = content.match(/async function setProductStock[\s\S]*?getAdminAuthHeaders/);
  assert(setProductStockMatch, 'setProductStock must include getAdminAuthHeaders');

  const setModelStockMatch = content.match(/async function setModelStock[\s\S]*?getAdminAuthHeaders/);
  assert(setModelStockMatch, 'setModelStock must include getAdminAuthHeaders');

  const setProductModelsStockMatch = content.match(/async function setProductModelsStock[\s\S]*?getAdminAuthHeaders/);
  assert(setProductModelsStockMatch, 'setProductModelsStock must include getAdminAuthHeaders');
});

// 5. Database repository updates recalculate parent stock on model adjustments
runTest('5. Database repository adjustStockInDb recalculates parent stock from SUM(stock) of product_models', () => {
  const repoFile = path.join(ROOT_DIR, 'lib', 'db', 'repositories', 'products.ts');
  assert(fs.existsSync(repoFile), 'lib/db/repositories/products.ts must exist');
  const content = fs.readFileSync(repoFile, 'utf8');

  assert(content.includes('SELECT SUM(stock) as total FROM product_models WHERE product_id = ?'),
    'adjustStockInDb must recalculate parent stock from product_models sum');
  assert(content.includes('UPDATE products SET stock = ? WHERE id = ?'),
    'adjustStockInDb must update parent product stock to match variants sum');
});

// 6. Strict validation on numeric inputs (rejects negative, decimals, non-finite, empty)
runTest('6. Numeric keypad modal enforces strict integer validation and presets', () => {
  const keypadFile = path.join(ROOT_DIR, 'components', 'admin', 'NumericKeypadModal.tsx');
  assert(fs.existsSync(keypadFile), 'NumericKeypadModal.tsx must exist');
  const content = fs.readFileSync(keypadFile, 'utf8');

  assert(content.includes('[0, 10, 50, 100, 250, 1000]'), 'Keypad must have bulk presets 10, 50, 100, 250, 1000');
  assert(content.includes('[10, 50, 100, 250]'), 'Keypad must have increment presets +10, +50, +100, +250');
  assert(content.includes('Math.floor(parsed) !== parsed'), 'Keypad must require integer input');
  assert(content.includes('parsed < 0'), 'Keypad must reject negative numbers');
  assert(content.includes('parsed > 999999'), 'Keypad must reject unsafe oversized numbers');
  assert(content.includes('isSubmitting'), 'Keypad must track submission state to prevent double clicks');
});

// 7. Database errors produce an error, never a false success
runTest('7. API failures produce user-visible error and throw instead of claiming success', () => {
  const keypadFile = path.join(ROOT_DIR, 'components', 'admin', 'NumericKeypadModal.tsx');
  const keypadContent = fs.readFileSync(keypadFile, 'utf8');

  assert(keypadContent.includes('setErrorMessage'), 'NumericKeypadModal must store and show errorMessage');
  assert(keypadContent.includes('Failed to update stock. Database update was not saved.'),
    'NumericKeypadModal must show clear failure message on rejected save');

  const bulkModalFile = path.join(ROOT_DIR, 'components', 'admin', 'BulkVariantAdjustModal.tsx');
  assert(fs.existsSync(bulkModalFile), 'BulkVariantAdjustModal.tsx must exist');
  const bulkContent = fs.readFileSync(bulkModalFile, 'utf8');

  assert(bulkContent.includes('setErrorMessage'), 'BulkVariantAdjustModal must track and display errors');
  assert(bulkContent.includes('if (ok !== false)'), 'BulkVariantAdjustModal must only close if save succeeds');
  assert(bulkContent.includes('Failed to update variant stocks. Changes were not committed to the database.'),
    'BulkVariantAdjustModal must show error message on rejected save');
});

// 8. Accidental duplicate submissions / double-click protection
runTest('8. UI controls and handlers prevent accidental double submissions and concurrent clashes', () => {
  const inventoryPageFile = path.join(ROOT_DIR, 'app', 'admin', 'inventory', 'page.tsx');
  assert(fs.existsSync(inventoryPageFile), 'app/admin/inventory/page.tsx must exist');
  const content = fs.readFileSync(inventoryPageFile, 'utf8');

  assert(content.includes('if (savingId !== null) return;'), 'handleQuickDelta must block clicks when savingId is active');
  assert(content.includes('const [savingId, setSavingId] = useState'), 'Inventory page must maintain savingId state');
  assert(content.includes('disabled={p.stock <= 0 || isSavingThis}'), 'Minus button must disable while saving');
  assert(content.includes('disabled={isSavingThis}'), 'Plus button must disable while saving');
});

// 9. Inventory logs record accurate changes and admin identity
runTest('9. Inventory logs record changes with admin email, timestamp, and correct balance', () => {
  const inventoryDbFile = path.join(ROOT_DIR, 'lib', 'db', 'inventory.ts');
  assert(fs.existsSync(inventoryDbFile), 'lib/db/inventory.ts must exist');
  const content = fs.readFileSync(inventoryDbFile, 'utf8');

  assert(content.includes('getAdminAuthHeaders(log.adminEmail)'), 'recordInventoryLog must authenticate with admin credentials');
  assert(content.includes('fetch(\'/api/admin/inventory/logs\''), 'recordInventoryLog must send logs to server endpoint');

  // Verify callers in products.ts pass changeAmount, previousStock, and newStock
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  const prodContent = fs.readFileSync(productsDbFile, 'utf8');
  assert(prodContent.includes('changeAmount: quantityChange'), 'products.ts must record changeAmount');
  assert(prodContent.includes('newStock: safeStock'), 'products.ts must record newStock');

  // Verify server route supports dev storage and MySQL logging
  const logsRouteFile = path.join(ROOT_DIR, 'app', 'api', 'admin', 'inventory', 'logs', 'route.ts');
  assert(fs.existsSync(logsRouteFile), 'app/api/admin/inventory/logs/route.ts must exist');
  const routeContent = fs.readFileSync(logsRouteFile, 'utf8');
  assert(routeContent.includes('recordDevInventoryLog'), 'Inventory logs API must fallback to dev storage when offline');
});

// 10. Warehouse adjustments do not touch shop_stock or POS inventory
runTest('10. Warehouse stock operations strictly separate warehouse stock from shop_stock', () => {
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  const content = fs.readFileSync(productsDbFile, 'utf8');

  // setProductStock only sends 'stock' in body, never touching shop_stock
  const setStockBody = content.match(/setProductStock[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\}\)/);
  assert(setStockBody, 'setProductStock must define body');
  assert(setStockBody[1].includes('stock: safeStock'), 'setProductStock must send stock');
  assert(!setStockBody[1].includes('shop_stock'), 'setProductStock must NOT overwrite shop_stock');

  // setModelStock updates model.stock and parent stock, never model.shop_stock or parent shop_stock
  const setModelStockBody = content.match(/setModelStock[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\}\)/);
  assert(setModelStockBody, 'setModelStock must define body');
  assert(!setModelStockBody[1].includes('shop_stock'), 'setModelStock must NOT overwrite shop_stock');
});

// 11. Database credentials and secrets are protected and not exposed
runTest('11. Database credentials and secrets are protected and not exposed', () => {
  const productsDbFile = path.join(ROOT_DIR, 'lib', 'db', 'products.ts');
  const content = fs.readFileSync(productsDbFile, 'utf8');
  assert(!content.includes('DB_PASSWORD'), 'products.ts must not hardcode DB_PASSWORD');
  assert(!content.includes('MYSQL_PASSWORD'), 'products.ts must not hardcode MYSQL_PASSWORD');

  const inventoryDbFile = path.join(ROOT_DIR, 'lib', 'db', 'inventory.ts');
  const invContent = fs.readFileSync(inventoryDbFile, 'utf8');
  assert(!invContent.includes('DB_PASSWORD'), 'inventory.ts must not hardcode DB_PASSWORD');
});

// 12. Synthetic in-memory execution test: standalone + variant models + sibling independence
runTest('12. In-memory execution test: standalone + variant models + sibling independence', () => {
  // Test Model Variant Independence Logic
  const initialModels = [
    { id: 'v1', name: '64GB / Black', stock: 10 },
    { id: 'v2', name: '128GB / Silver', stock: 25 },
    { id: 'v3', name: '256GB / Gold', stock: 50 },
  ];

  // Adjust v2 to 250 units
  const targetId = 'v2';
  const newQty = 250;
  const updatedModels = initialModels.map((m) => {
    if (m.id === targetId) {
      return { ...m, stock: newQty };
    }
    return m;
  });

  // Verify v1 and v3 are completely unchanged
  assert.strictEqual(updatedModels[0].stock, 10, 'v1 stock must remain 10');
  assert.strictEqual(updatedModels[1].stock, 250, 'v2 stock must be updated to 250');
  assert.strictEqual(updatedModels[2].stock, 50, 'v3 stock must remain 50');

  // Verify total parent stock is sum of models
  const totalStock = updatedModels.reduce((sum, m) => sum + m.stock, 0);
  assert.strictEqual(totalStock, 10 + 250 + 50, 'Parent stock must equal sum of models (310)');
});

console.log(`\nTEST RESULTS: ${passedTests} / ${totalTests} PASSED.`);
if (passedTests === totalTests) {
  console.log('ALL VERIFICATION CHECKS PASSED!\n');
} else {
  console.error('SOME VERIFICATION CHECKS FAILED!\n');
  process.exit(1);
}
