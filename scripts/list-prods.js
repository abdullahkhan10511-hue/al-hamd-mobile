const fs = require('fs');
const content = fs.readFileSync('data/products.ts', 'utf8');
const idMatches = content.match(/id:\s*['"][^'"]+['"]/g) || [];
const nameMatches = content.match(/name:\s*['"][^'"]+['"]/g) || [];
console.log('Total IDs:', idMatches.length, 'Total Names:', nameMatches.length);
for (let i = 0; i < Math.min(idMatches.length, 25); i++) {
  console.log(idMatches[i], nameMatches[i]);
}

