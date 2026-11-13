import fs from 'fs';
import path from 'path';

const staticDir = '.next/static';
if (!fs.existsSync(staticDir)) {
  console.error('.next/static does not exist');
  process.exit(1);
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const jsFiles = getAllFiles(staticDir);
console.log(`Scanning ${jsFiles.length} JavaScript files in ${staticDir}...`);

const searchPatterns = [
  { name: 'scrypt$', regex: /scrypt\$/i },
  { name: '64-hex hash/salt', regex: /[a-f0-9]{64}/i },
  { name: 'SESSION_SECRET', regex: /SESSION_SECRET/ },
  { name: 'ADMIN_PASSWORD', regex: /ADMIN_PASSWORD/ },
  { name: 'DB_PASSWORD', regex: /DB_PASSWORD/ },
  { name: 'MYSQL_PASSWORD', regex: /MYSQL_PASSWORD/ },
  { name: 'admin@alhamdmobile.com', regex: /admin@alhamdmobile\.com/i },
  { name: 'owner@example.com', regex: /owner@example\.com/i },
];

let leaksFound = 0;

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const p of searchPatterns) {
    if (p.regex.test(content)) {
      // Exclude build hashes if 64-hex (webpack uses 20 or 32 hex usually)
      console.warn(`[LEAK DETECTED] Pattern "${p.name}" found in ${file}`);
      leaksFound++;
    }
  }
}

if (leaksFound === 0) {
  console.log('>>> ZERO LEAKS DETECTED in client bundles! All secrets and hashes are clean. <<<');
} else {
  console.warn(`>>> Total potential leaks detected: ${leaksFound} <<<`);
}

