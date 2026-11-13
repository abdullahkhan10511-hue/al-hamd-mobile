import fs from 'fs';

// 1. lib/db/storage.ts
{
  let s = fs.readFileSync('lib/db/storage.ts', 'utf8');
  s = s.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/g, '');
  s = s.replace(/import\s*\{\s*doc,\s*setDoc,?\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/g, '');
  // Clean persistCollection
  s = s.replace(
    /\s*\/\/ Attempt Firestore sync only if real Firebase credentials are provided[\s\S]*?\}\s*\}\s*\}/,
    '\n}'
  );
  fs.writeFileSync('lib/db/storage.ts', s, 'utf8');
  console.log('Cleaned lib/db/storage.ts');
}

// 2. lib/db/categories.ts
{
  let s = fs.readFileSync('lib/db/categories.ts', 'utf8');
  s = s.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/g, '');
  s = s.replace(/import\s*\{\s*doc,\s*setDoc,\s*deleteDoc\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync only if real Firebase credentials exist[\s\S]*?console\.warn\('Firestore create category notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc deletion only if real Firebase credentials exist[\s\S]*?console\.warn\('Firestore category deletion notice:', err\);\s*\}\s*\}/g, '');
  fs.writeFileSync('lib/db/categories.ts', s, 'utf8');
  console.log('Cleaned lib/db/categories.ts');
}

// 3. lib/db/locations.ts
{
  let s = fs.readFileSync('lib/db/locations.ts', 'utf8');
  s = s.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/g, '');
  s = s.replace(/import\s*\{\s*doc,\s*deleteDoc\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore document deletion if available and real credentials exist[\s\S]*?console\.warn\('Firestore shopLocations direct deletion notice:', err\);\s*\}\s*\}/g, '');
  fs.writeFileSync('lib/db/locations.ts', s, 'utf8');
  console.log('Cleaned lib/db/locations.ts');
}

// 4. lib/db/orders.ts
{
  let s = fs.readFileSync('lib/db/orders.ts', 'utf8');
  s = s.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/g, '');
  s = s.replace(/import\s*\{\s*doc,\s*setDoc\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync[\s\S]*?console\.warn\('Firestore create order notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync[\s\S]*?console\.warn\('Firestore update order notice:', err\);\s*\}\s*\}/g, '');
  fs.writeFileSync('lib/db/orders.ts', s, 'utf8');
  console.log('Cleaned lib/db/orders.ts');
}

// 5. lib/db/pos.ts
{
  let s = fs.readFileSync('lib/db/pos.ts', 'utf8');
  s = s.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/g, '');
  s = s.replace(/import\s*\{\s*doc,\s*setDoc\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore sync for products[\s\S]*?console\.warn\('Firestore sync product notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore sync for order[\s\S]*?console\.warn\('Firestore sync order notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore sync[\s\S]*?console\.warn\('Firestore void sync notice:', err\);\s*\}\s*\}/g, '');
  fs.writeFileSync('lib/db/pos.ts', s, 'utf8');
  console.log('Cleaned lib/db/pos.ts');
}

// 6. lib/db/products.ts
{
  let s = fs.readFileSync('lib/db/products.ts', 'utf8');
  s = s.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/g, '');
  s = s.replace(/import\s*\{\s*doc,\s*setDoc,\s*deleteDoc\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync[\s\S]*?console\.warn\('Firestore create product notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync[\s\S]*?console\.warn\('Firestore update product notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ 7\. Delete Firestore document directly[\s\S]*?console\.warn\('Firestore product deletion notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync[\s\S]*?console\.warn\('Firestore stock sync notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync[\s\S]*?console\.warn\('Firestore model stock sync notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync if configured[\s\S]*?console\.warn\('Firestore stock sync notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Direct Firestore doc sync if configured[\s\S]*?console\.warn\('Firestore lowStockThreshold sync notice:', err\);\s*\}\s*\}/g, '');
  fs.writeFileSync('lib/db/products.ts', s, 'utf8');
  console.log('Cleaned lib/db/products.ts');
}

// 7. lib/db/settings.ts
{
  let s = fs.readFileSync('lib/db/settings.ts', 'utf8');
  s = s.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/g, '');
  s = s.replace(/import\s*\{\s*doc,\s*setDoc\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/g, '');
  s = s.replace(/\s*\/\/ Attempt Firestore sync with non-destructive merge[\s\S]*?console\.warn\('Firestore update store settings notice:', err\);\s*\}\s*\}/g, '');
  s = s.replace(/\s*\/\/ Firestore sync if available[\s\S]*?console\.warn\('Firestore shopLocations direct sync notice:', err\);\s*\}\s*\}/g, '');
  fs.writeFileSync('lib/db/settings.ts', s, 'utf8');
  console.log('Cleaned lib/db/settings.ts');
}

// 8. app/admin/media/page.tsx
{
  let s = fs.readFileSync('app/admin/media/page.tsx', 'utf8');
  s = s.replace(/stored in Firebase Storage for/g, 'stored for');
  fs.writeFileSync('app/admin/media/page.tsx', s, 'utf8');
  console.log('Cleaned app/admin/media/page.tsx');
}

// 9. .env.example
{
  let s = fs.readFileSync('.env.example', 'utf8');
  s = s.replace(/# Firebase \(Optional Client \/ Cloud Configuration\)[\s\S]*?NEXT_PUBLIC_FIREBASE_APP_ID=[^\r\n]*\r?\n?/g, '');
  fs.writeFileSync('.env.example', s, 'utf8');
  console.log('Cleaned .env.example');
}

// 10. package.json
{
  let s = fs.readFileSync('package.json', 'utf8');
  s = s.replace(/\s*"firebase":\s*"[^"]*",?\r?\n?/g, '\n');
  fs.writeFileSync('package.json', s, 'utf8');
  console.log('Cleaned package.json');
}

