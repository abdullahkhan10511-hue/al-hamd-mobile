/**
 * Server-Side Admin Password Reset Utility
 *
 * Usage:
 *   ADMIN_NEW_PASSWORD="your-strong-password" node scripts/reset-admin-password.js [email]
 *
 * Or:
 *   ADMIN_EMAIL="admin@example.com" ADMIN_NEW_PASSWORD="your-strong-password" node scripts/reset-admin-password.js
 *
 * Notice: For security, the password must ONLY be passed via the ADMIN_NEW_PASSWORD
 * environment variable to avoid exposure in process lists (`ps`).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length > 0) {
          const key = k.trim();
          const val = v.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

// Load .env.local and .env
loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

function validatePasswordComplexity(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length < 12) {
    return 'Password must be at least 12 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return 'Password must contain at least one symbol.';
  }
  return null;
}

function generateSalt(byteLength = 16) {
  return crypto.randomBytes(byteLength).toString('hex');
}

function hashPassword(password, salt) {
  const saltBytes = Buffer.isBuffer(salt)
    ? salt
    : (typeof salt === 'string' && salt.length === 32 ? Buffer.from(salt, 'hex') : crypto.randomBytes(16));
  const derived = crypto.scryptSync(password, saltBytes, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
  return `scrypt$32768$8$1${saltBytes.toString('base64url')}${derived.toString('base64url')}`;
}

async function updateDatabaseIfConfigured(email, passwordHash, salt) {
  const dbUrl = process.env.DATABASE_URL;
  const dbHost = process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST;
  const dbUser = process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQLUSER;
  const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE;

  if (!dbUrl && (!dbHost || !dbUser || !dbName)) {
    return;
  }

  try {
    const mysql = require('mysql2/promise');
    let pool;
    if (dbUrl && dbUrl.startsWith('mysql')) {
      pool = mysql.createPool(dbUrl);
    } else {
      pool = mysql.createPool({
        host: dbHost,
        port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10),
        user: dbUser,
        password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
        database: dbName,
        connectTimeout: 5000,
      });
    }

    await pool.execute(
      'UPDATE staff_users SET password_hash = ?, salt = ?, updated_at = NOW() WHERE LOWER(email) = LOWER(?)',
      [passwordHash, salt, email]
    );
    await pool.end();
  } catch (err) {
    // MySQL error silent or logged safely without credentials
  }
}

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const newPassword = process.env.ADMIN_NEW_PASSWORD;

  if (!email) {
    console.error('ERROR: Admin email must be provided as CLI arg or ADMIN_EMAIL.');
    process.exit(1);
  }

  if (!newPassword) {
    console.error('ERROR: ADMIN_NEW_PASSWORD environment variable is required.');
    process.exit(1);
  }

  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) {
    console.error(`ERROR: Password complexity requirements not met: ${complexityError}`);
    process.exit(1);
  }

  const salt = generateSalt(16);
  const passwordHash = hashPassword(newPassword, salt);

  // Update data/staff-users.json
  const staffJsonPath = path.join(__dirname, '..', 'data', 'staff-users.json');
  if (fs.existsSync(staffJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(staffJsonPath, 'utf8'));
      if (Array.isArray(data)) {
        let found = false;
        const updated = data.map((u) => {
          if (
            (u.email && u.email.toLowerCase() === email) ||
            (u.isOwner && !found)
          ) {
            found = true;
            return {
              ...u,
              email: email,
              salt: salt,
              passwordHash: passwordHash,
              updatedAt: new Date().toISOString(),
            };
          }
          return u;
        });

        if (!found) {
          updated.push({
            id: `staff-${Date.now()}`,
            name: 'Administrator',
            email: email,
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
      }
    } catch (e) {
      console.error('Error updating staff-users.json:', e.message);
      process.exit(1);
    }
  }

  await updateDatabaseIfConfigured(email, passwordHash, salt);

  console.log(`[OK] Admin password for ${email} has been reset.`);
}

main().catch((err) => {
  console.error('Password reset failed:', err.message);
  process.exit(1);
});

