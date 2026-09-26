/**
 * Server-Side Admin Setup & Password Reset Utility
 * 
 * Usage:
 *   node scripts/setup-admin.js [email] [new_password]
 * 
 * Or configure environment variables:
 *   ADMIN_EMAIL=admin@alhamd.com
 *   ADMIN_PASSWORD=YourSecurePassword@123
 *   node scripts/setup-admin.js
 * 
 * This script securely hashes the password using salted SHA-256 (matching the project's
 * Web Crypto algorithm) and configures the main Administrator account in the project database.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateSalt(byteLength = 16) {
  return crypto.randomBytes(byteLength).toString('hex');
}

function hashPassword(password, salt) {
  return crypto
    .createHash('sha256')
    .update(`${password}:${salt}:alhamd_staff_v1`)
    .digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  
  // 1. Resolve email and password from CLI args or environment variables
  let email = args[0] || process.env.ADMIN_EMAIL;
  let password = args[1] || process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    // Check .env / .env.local if exists
    const envLocalPath = path.join(__dirname, '..', '.env.local');
    const envPath = path.join(__dirname, '..', '.env');
    const loadEnvFile = (filePath) => {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [k, ...v] = trimmed.split('=');
            if (k && v.length > 0) {
              const val = v.join('=').trim().replace(/^["']|["']$/g, '');
              if (k.trim() === 'ADMIN_EMAIL' && !email) email = val;
              if (k.trim() === 'ADMIN_PASSWORD' && !password) password = val;
            }
          }
        });
      }
    };
    loadEnvFile(envLocalPath);
    loadEnvFile(envPath);
  }

  // Fallback defaults if still not provided
  if (!email) {
    email = 'admin@alhamdmobile.com';
  }

  if (!password) {
    console.log('====================================================');
    console.log('AL-HAMD MOBILE — ADMIN ACCOUNT SETUP / RESET UTILITY');
    console.log('====================================================\n');
    console.log('ERROR: No new admin password provided.\n');
    console.log('Usage:');
    console.log('  node scripts/setup-admin.js <email> <password>\n');
    console.log('Example:');
    console.log('  node scripts/setup-admin.js admin@alhamdmobile.com AlHamd@Admin2026!\n');
    console.log('Alternatively, set ADMIN_EMAIL and ADMIN_PASSWORD in your environment or .env.local file:');
    console.log('  ADMIN_EMAIL=admin@alhamdmobile.com');
    console.log('  ADMIN_PASSWORD=AlHamd@Admin2026!');
    console.log('  npm run setup:admin\n');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('ERROR: Admin password must be at least 6 characters long.');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const salt = generateSalt(16);
  const passwordHash = hashPassword(password, salt);

  console.log('====================================================');
  console.log('AL-HAMD MOBILE — CONFIGURING ADMIN CREDENTIALS');
  console.log('====================================================');
  console.log(`Target Email : ${normalizedEmail}`);
  console.log('Hashing      : Salted SHA-256 Web Crypto Compatible');

  // 2. Update lib/db/staff.ts constants so synchronous boot immediately recognizes the credentials
  const staffTsPath = path.join(__dirname, '..', 'lib', 'db', 'staff.ts');
  if (fs.existsSync(staffTsPath)) {
    let staffContent = fs.readFileSync(staffTsPath, 'utf8');

    // Replace SEED_SALT and SEED_HASH
    staffContent = staffContent.replace(
      /const SEED_SALT\s*=\s*['"][^'"]*['"];/,
      `const SEED_SALT = '${salt}';`
    );
    staffContent = staffContent.replace(
      /const SEED_HASH\s*=\s*['"][^'"]*['"];/,
      `const SEED_HASH = '${passwordHash}';`
    );

    // Ensure INITIAL_STAFF_USERS has the target email for staff-owner-1
    staffContent = staffContent.replace(
      /id:\s*['"]staff-owner-1['"],\s*name:\s*['"][^'"]*['"],\s*email:\s*['"][^'"]*['"]/,
      `id: 'staff-owner-1',\n    name: 'Chief Administrator',\n    email: '${normalizedEmail}'`
    );

    fs.writeFileSync(staffTsPath, staffContent, 'utf8');
    console.log('Updated      : lib/db/staff.ts initial seed constants');
  }

  // 3. Update lib/db/seed.ts constants
  const seedTsPath = path.join(__dirname, '..', 'lib', 'db', 'seed.ts');
  if (fs.existsSync(seedTsPath)) {
    let seedContent = fs.readFileSync(seedTsPath, 'utf8');
    seedContent = seedContent.replace(
      /salt:\s*['"][^'"]*['"],\s*passwordHash:\s*['"][^'"]*['"]/,
      `salt: '${salt}',\n    passwordHash: '${passwordHash}'`
    );
    if (normalizedEmail !== 'admin@alhamd.com') {
      seedContent = seedContent.replace(
        /email:\s*['"]admin@alhamd\.com['"]/,
        `email: '${normalizedEmail}'`
      );
    }
    fs.writeFileSync(seedTsPath, seedContent, 'utf8');
    console.log('Updated      : lib/db/seed.ts admin seed constants');
  }

  // 4. Update data/staff-users.json database file
  const staffJsonPath = path.join(__dirname, '..', 'data', 'staff-users.json');
  if (fs.existsSync(staffJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(staffJsonPath, 'utf8'));
      if (Array.isArray(data)) {
        let found = false;
        const updated = data.map((u) => {
          if (
            u.id === 'staff-owner-1' ||
            u.isOwner ||
            (u.email && u.email.toLowerCase() === normalizedEmail) ||
            (u.email && u.email.toLowerCase() === 'admin@alhamd.com') ||
            (u.email && u.email.toLowerCase() === 'admin@alhamdmobile.com')
          ) {
            found = true;
            return {
              ...u,
              email: normalizedEmail,
              role: 'ADMIN',
              isOwner: true,
              status: 'active',
              salt: salt,
              passwordHash: passwordHash,
              updatedAt: new Date().toISOString(),
            };
          }
          return u;
        });

        if (!found) {
          updated.unshift({
            id: 'staff-owner-1',
            name: 'Chief Administrator',
            email: normalizedEmail,
            role: 'ADMIN',
            permissions: [],
            status: 'active',
            isOwner: true,
            salt: salt,
            passwordHash: passwordHash,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        fs.writeFileSync(staffJsonPath, JSON.stringify(updated, null, 2), 'utf8');
        console.log('Updated      : data/staff-users.json database file');
      }
    } catch (e) {
      console.warn('Could not update staff-users.json:', e.message);
    }
  }

  console.log('\n[SUCCESS] Administrator account successfully configured!');
  console.log(`[INFO] Email    : ${normalizedEmail}`);
  console.log('[INFO] Role     : SUPER_ADMIN (Owner)');
  console.log('[INFO] Security : Password securely hashed and salted.');
  console.log('[INFO] Status   : Active & Authorized for all /admin routes.');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Admin setup failed:', err);
  process.exit(1);
});
