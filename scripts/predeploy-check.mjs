import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('AL-HAMD SHOP — PRODUCTION PRE-DEPLOYMENT SAFETY CHECK');
console.log('================================================================\n');

let failed = false;

function check(condition, message, details = '') {
  if (condition) {
    console.log(`  [PASS] ${message}`);
  } else {
    failed = true;
    console.error(`  [FAIL] ${message}${details ? ' - ' + details : ''}`);
  }
}

// 1. Check ALLOW_DATA_MIGRATION environment flag
const allowDataMigrationEnv = (process.env.ALLOW_DATA_MIGRATION || '').toLowerCase().trim();
check(
  allowDataMigrationEnv !== 'true',
  'ALLOW_DATA_MIGRATION is not enabled in environment',
  'ALLOW_DATA_MIGRATION=true detected! Must be unset/false before deployment to prevent live database overwrite.'
);

// Check if ALLOW_DATA_MIGRATION=true is written in production env files
const envProductionPath = path.join(projectRoot, '.env.production');
if (fs.existsSync(envProductionPath)) {
  const content = fs.readFileSync(envProductionPath, 'utf8');
  const hasDangerousFlag = /^\s*ALLOW_DATA_MIGRATION\s*=\s*true/im.test(content);
  check(
    !hasDangerousFlag,
    '.env.production does not enable ALLOW_DATA_MIGRATION',
    'ALLOW_DATA_MIGRATION=true found in .env.production!'
  );
}

// 2. Check ALLOW_PRODUCTION_SEED environment flag
const allowProdSeedEnv = (process.env.ALLOW_PRODUCTION_SEED || '').toLowerCase().trim();
check(
  allowProdSeedEnv !== 'true',
  'ALLOW_PRODUCTION_SEED is not enabled in environment',
  'ALLOW_PRODUCTION_SEED=true detected! Production seed must be permanently disabled.'
);

// 3. Check ALLOW_TEST_POOL override flag
const allowTestPoolEnv = (process.env.ALLOW_TEST_POOL || '').trim();
check(
  allowTestPoolEnv !== '1' && allowTestPoolEnv !== 'true',
  'ALLOW_TEST_POOL is not enabled in environment',
  'ALLOW_TEST_POOL detected! Test database pool override must never be enabled in production.'
);

// 4. Static scan: Ensure zero DROP or TRUNCATE statements in HTTP routes
const dropGrep = spawnSync('git', ['grep', '-i', '-E', 'DROP TABLE|DROP DATABASE|TRUNCATE', 'app/api/'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
const dropMatches = (dropGrep.stdout || '').trim();
check(
  !dropMatches,
  'Zero DROP or TRUNCATE statements in app/api HTTP routes',
  dropMatches
);

// 5. Static scan: Ensure zero calls to setPool() in production app/lib/components code
const setPoolGrep = spawnSync('git', ['grep', '-n', 'setPool(', 'app/', 'lib/', 'components/'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
const setPoolMatches = (setPoolGrep.stdout || '')
  .trim()
  .split('\n')
  .filter((line) => Boolean(line) && !line.startsWith('lib/db/mysql.ts:'));
check(
  setPoolMatches.length === 0,
  'Zero calls to setPool() in production code (test-only helper isolated)',
  setPoolMatches.join('\n')
);

// 6. Static scan: Ensure unrestricted DELETE statements do not exist in app/api
const deleteGrep = spawnSync('git', ['grep', '-i', '-n', 'DELETE FROM', 'app/api/'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
const deleteMatches = (deleteGrep.stdout || '').trim();
check(
  !deleteMatches,
  'Zero raw DELETE FROM statements directly inside app/api routes (delegated to audited repositories)',
  deleteMatches
);

// 7. Verify .env.example contains warning documentation for ALLOW_DATA_MIGRATION
const envExamplePath = path.join(projectRoot, '.env.example');
let envExampleHasWarning = false;
if (fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  envExampleHasWarning =
    envContent.includes('ALLOW_DATA_MIGRATION') &&
    envContent.includes('MUST STAY UNSET OR FALSE ON THE LIVE PRODUCTION SERVER');
}
check(
  envExampleHasWarning,
  '.env.example contains documented warning for ALLOW_DATA_MIGRATION'
);

// 8. Static & runtime scan: Ensure no secrets leaked in NEXT_PUBLIC_ variables
const nextPublicKeys = Object.keys(process.env).filter((k) => k.startsWith('NEXT_PUBLIC_'));
const dangerousNextPublicKeys = nextPublicKeys.filter((k) =>
  /SECRET|PASSWORD|PRIVATE|TOKEN|KEY|PASS/i.test(k)
);
check(
  dangerousNextPublicKeys.length === 0,
  'Zero secret names in runtime NEXT_PUBLIC_ environment variables',
  dangerousNextPublicKeys.join(', ')
);

const nextPublicGrep = spawnSync(
  'git',
  ['grep', '-E', 'NEXT_PUBLIC_(SECRET|PASSWORD|PRIVATE|DB_PASSWORD|ADMIN_PASS)', 'app/', 'components/', 'lib/'],
  { cwd: projectRoot, encoding: 'utf8' }
);
const nextPublicSourceMatches = (nextPublicGrep.stdout || '').trim();
check(
  !nextPublicSourceMatches,
  'Zero NEXT_PUBLIC_ secret references in client/app source code',
  nextPublicSourceMatches
);

// 9. Git repository scan: Ensure sensitive environment and dump files are not tracked
const trackedEnvGrep = spawnSync('git', ['ls-files', '.env*'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
const trackedEnvFiles = (trackedEnvGrep.stdout || '')
  .trim()
  .split('\n')
  .filter((f) => Boolean(f) && f !== '.env.example');
check(
  trackedEnvFiles.length === 0,
  'Zero secret .env files tracked in git (only .env.example allowed)',
  trackedEnvFiles.join(', ')
);

const trackedDumpGrep = spawnSync('git', ['ls-files', '*.dump.sql', 'backup*.sql', '*dump*.sql'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
const trackedDumpFiles = (trackedDumpGrep.stdout || '').trim().split('\n').filter(Boolean);
check(
  trackedDumpFiles.length === 0,
  'Zero SQL production database dump files tracked in git',
  trackedDumpFiles.join(', ')
);

// 10. Production runtime safety checks (when NODE_ENV === 'production')
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  console.log('\n--- Production Runtime Configuration Verification ---');

  // 10.1 SESSION_SECRET check
  const sessionSecret = process.env.SESSION_SECRET || '';
  check(
    sessionSecret.length >= 32,
    'SESSION_SECRET is configured with at least 32 characters in production',
    sessionSecret ? `Current length: ${sessionSecret.length} chars` : 'SESSION_SECRET is empty/unset'
  );

  // 10.2 ADMIN_EMAIL check
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  check(
    Boolean(adminEmail) && adminEmail.includes('@'),
    'ADMIN_EMAIL is configured with a valid email in production',
    adminEmail ? 'Invalid email format' : 'ADMIN_EMAIL is empty/unset'
  );

  // 10.3 Database credentials check
  const hasDbUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasDiscreteDb = Boolean(
    process.env.DB_HOST?.trim() &&
    process.env.DB_USER?.trim() &&
    process.env.DB_PASSWORD !== undefined &&
    process.env.DB_NAME?.trim()
  );
  check(
    hasDbUrl || hasDiscreteDb,
    'Database connection credentials configured in production',
    'Neither DATABASE_URL nor complete DB_HOST/DB_USER/DB_PASSWORD/DB_NAME provided'
  );

  // 10.4 Reverse proxy notice
  const trustProxy = (process.env.TRUST_PROXY || '').toLowerCase().trim();
  if (trustProxy !== 'true' && trustProxy !== '1') {
    console.warn(
      '  [NOTICE] TRUST_PROXY is not enabled. If deploying behind Hostinger/Nginx/Cloudflare reverse proxy, set TRUST_PROXY=true.'
    );
  } else {
    console.log('  [PASS] TRUST_PROXY is enabled for reverse proxy deployment');
  }

  // 10.5 Persistent DATA_DIR warning (Task D1 - optional warning, not failure)
  const dataDirEnv = (process.env.DATA_DIR || '').trim();
  if (!dataDirEnv) {
    console.warn(
      '  [WARNING] DATA_DIR is not set. Settings files live inside the app folder and may be lost on redeploy. Set DATA_DIR to an external persistent folder outside the app root.'
    );
  } else {
    console.log(`  [PASS] DATA_DIR is configured for persistent settings (${dataDirEnv})`);
  }

  // 10.6 Persistent uploads directory warning (Task D2 - warning, not failure)
  const uploadsDirEnv = (
    process.env.PERSISTENT_UPLOADS_DIR ||
    process.env.MEDIA_STORAGE_PATH ||
    process.env.UPLOADS_DIR ||
    ''
  ).trim();
  if (!uploadsDirEnv) {
    console.warn(
      '  [WARNING] PERSISTENT_UPLOADS_DIR is not set. Uploads live inside the app folder and may be lost on redeploy. Set PERSISTENT_UPLOADS_DIR to an external persistent folder outside the app root.'
    );
  } else {
    console.log(`  [PASS] PERSISTENT_UPLOADS_DIR is configured for persistent uploads (${uploadsDirEnv})`);
  }
} else {
  console.log(
    `\n  [INFO] Running in non-production mode (NODE_ENV=${process.env.NODE_ENV || 'development'}).`
  );
  console.log(
    '         Strict production secret checks (SESSION_SECRET, ADMIN_EMAIL, DB credentials) apply when NODE_ENV=production.'
  );
}

console.log('\n================================================================');
if (failed) {
  console.error('>>> PRE-DEPLOYMENT SAFETY CHECK FAILED! Resolve errors above before deploying. <<<\n');
  process.exit(1);
} else {
  console.log('>>> PRE-DEPLOYMENT SAFETY CHECK PASSED! Production deployment is safe. <<<\n');
  process.exit(0);
}

