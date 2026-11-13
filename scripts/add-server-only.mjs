import fs from 'fs';

const targetFiles = [
  'lib/db/mysql.ts',
  'lib/db/sessionToken.ts',
  'lib/db/customerSession.ts',
  'lib/db/adminAuth.ts',
  'lib/db/staff-server.ts',
  'lib/db/customers-server.ts',
  'lib/db/serverDevStorage.ts',
  'lib/db/serverCatalog.ts',
  'lib/db/serverMedia.ts',
  'lib/db/migration.ts',
  'lib/db/staff.ts',
  'lib/mediaStorage.ts',
  'lib/security/password.ts',
  'lib/security/knownWeakHashes.ts',
  'lib/security/csrf.ts'
];

// Add all repositories
const repoFiles = fs.readdirSync('lib/db/repositories');
for (const rf of repoFiles) {
  if (rf.endsWith('.ts')) {
    targetFiles.push('lib/db/repositories/' + rf);
  }
}

for (const f of targetFiles) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes("import 'server-only'") && !content.includes('import "server-only"')) {
      content = "import 'server-only';\n" + content;
      fs.writeFileSync(f, content, 'utf8');
      console.log('Added server-only to:', f);
    } else {
      console.log('Already has server-only:', f);
    }
  }
}

