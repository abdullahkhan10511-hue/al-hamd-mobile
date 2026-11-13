import fs from 'fs';

let content = fs.readFileSync('_security_backups/step6b_20261106/lib/db/pos.ts', 'utf8');

// Remove imports
content = content.replace(/import\s*\{\s*db\s*\}\s*from\s*['"]\.\.\/firebase['"];\r?\n?/, '');
content = content.replace(/import\s*\{\s*doc,\s*setDoc\s*\}\s*from\s*['"]firebase\/firestore['"];\r?\n?/, '');

// Block 1
const b1 = `    // Direct Firestore sync for products
    if (db && typeof (db as any).type === 'string') {
      try {
        for (const item of validatedItems) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod) {
            const docRef = doc(db, 'products', prod.id);
            setDoc(docRef, { stock: prod.stock, models: prod.models }, { merge: true }).catch(() => {});
          }
        }
      } catch {}
    }`;

// Block 2
const b2 = `    // Direct Firestore sync for order
    if (db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'orders', newOrder.id);
        setDoc(docRef, newOrder, { merge: true }).catch(() => {});
      } catch {}
    }`;

// Block 3
const b3 = `    // Direct Firestore sync
    if (db && typeof (db as any).type === 'string') {
      try {
        const docRef = doc(db, 'orders', orderId);
        setDoc(docRef, updatedOrder, { merge: true }).catch(() => {});
      } catch {}
    }`;

content = content.replace(b1.replace(/\r?\n/g, '\r\n'), '');
content = content.replace(b1.replace(/\r?\n/g, '\n'), '');
content = content.replace(b2.replace(/\r?\n/g, '\r\n'), '');
content = content.replace(b2.replace(/\r?\n/g, '\n'), '');
content = content.replace(b3.replace(/\r?\n/g, '\r\n'), '');
content = content.replace(b3.replace(/\r?\n/g, '\n'), '');

fs.writeFileSync('lib/db/pos.ts', content, 'utf8');
console.log('Cleaned pos.ts successfully from backup');

