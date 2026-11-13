const fs = require('fs');
const path = require('path');

const results = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'dist') continue;
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.json') || f.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('images.unsplash.com')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('images.unsplash.com')) {
            results.push({ file: fullPath, line: idx + 1, content: line.trim() });
          }
        });
      }
    }
  }
}

scanDir('.');
console.log('Total Unsplash references found:', results.length);
const files = [...new Set(results.map(r => r.file))];
console.log('Distinct files:', files.length);
files.forEach(f => console.log('-', f));
fs.writeFileSync('unsplash-audit.json', JSON.stringify(results, null, 2), 'utf8');

