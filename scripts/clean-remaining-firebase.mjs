import fs from 'fs';

// 1. lib/db/categories.ts
{
  let s = fs.readFileSync('lib/db/categories.ts', 'utf8');
  s = s.replace(/\s*\/\/ Direct Firestore doc deletion only if real Firebase credentials exist[\s\S]*?console\.warn\('Firestore delete category notice:', err\);\s*\}\s*\}/, '');
  fs.writeFileSync('lib/db/categories.ts', s, 'utf8');
}

// 2. lib/db/pos.ts
{
  let s = fs.readFileSync('lib/db/pos.ts', 'utf8');
  s = s.replace(/\s*\/\/ Direct Firestore sync for products[\s\S]*?\}\s*\}\s*\}/, '');
  s = s.replace(/\s*\/\/ Direct Firestore sync for order[\s\S]*?\}\s*\}\s*\}/, '');
  s = s.replace(/\s*\/\/ Direct Firestore sync[\s\S]*?\}\s*\}\s*\}/, '');
  fs.writeFileSync('lib/db/pos.ts', s, 'utf8');
}

// 3. lib/db/products.ts
{
  let s = fs.readFileSync('lib/db/products.ts', 'utf8');
  s = s.replace(/\s*if \(db && typeof \(db as any\)\.type === 'string'\) \{\s*try \{\s*const docRef = doc\(db, 'products', productId\);[\s\S]*?console\.warn\('Firestore model stock sync notice:', err\);\s*\}\s*\}/g, '');
  fs.writeFileSync('lib/db/products.ts', s, 'utf8');
}

// 4. lib/db/settings.ts
{
  let s = fs.readFileSync('lib/db/settings.ts', 'utf8');
  s = s.replace(/\s*\/\/ Attempt Firestore sync with non-destructive merge[\s\S]*?\/\/ Offline or permission restriction; local persistence is already guaranteed\s*\}\s*\}/, '');
  s = s.replace(/\s*\/\/ Firestore sync if available[\s\S]*?\/\/ ignore\s*\}\s*\}/, '');
  fs.writeFileSync('lib/db/settings.ts', s, 'utf8');
}

console.log('Cleaned remaining Firestore blocks');

