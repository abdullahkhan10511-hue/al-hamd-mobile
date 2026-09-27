import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

async function main() {
  console.log('====================================================');
  console.log(' AL-HAMD MOBILE ACCESSORIES - CLI DATA IMPORT TOOL');
  console.log(' Single Source of Truth Migration');
  console.log('====================================================\n');

  const { runProductionMigration, getDatabaseTableCounts } = await import('../../lib/db/migration');
  const { isDbConfigured, getDbConfig } = await import('../../lib/db/mysql');

  if (!isDbConfigured()) {
    const cfg = getDbConfig();
    console.error('ERROR: MySQL database configuration is missing in environment.');
    console.error(`  DB_HOST: ${cfg.host ? 'SET' : 'MISSING'}`);
    console.error(`  DB_USER: ${cfg.user ? 'SET' : 'MISSING'}`);
    console.error(`  DB_NAME: ${cfg.database ? 'SET' : 'MISSING'}`);
    console.error('\nNOTE: If migrating on production, run via the Admin Portal or verify Hostinger environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MySQL and executing safe data migration...\n');
  const result = await runProductionMigration();

  console.log('====================================================');
  console.log(' MIGRATION SUMMARY REPORT');
  console.log('====================================================');
  console.log('Entity                      | Imported | Skipped | Errors');
  console.log('----------------------------|----------|---------|-------');

  for (const s of result.stats) {
    const entityPad = s.entity.padEnd(27, ' ');
    const impPad = String(s.imported).padStart(8, ' ');
    const skipPad = String(s.skipped).padStart(7, ' ');
    const errPad = String(s.errors).padStart(6, ' ');
    console.log(`${entityPad} | ${impPad} | ${skipPad} | ${errPad}`);
    if (s.message) {
      console.log(`  -> Note: ${s.message}`);
    }
  }

  console.log('====================================================\n');
  console.log(result.summary);

  const counts = await getDatabaseTableCounts();
  console.log('\nLive MySQL Table Counts:');
  for (const [tbl, cnt] of Object.entries(counts)) {
    console.log(`  ${tbl.padEnd(25, ' ')} : ${cnt}`);
  }

  console.log('\nMigration process finished successfully.\n');
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error('Migration failed with unexpected error:', err);
  process.exit(1);
});
