import 'server-only';
// Server-only runtime boundary: prevent client bundle exposure
if (typeof window !== 'undefined') {
  throw new Error('lib/security/password can only be imported on the server.');
}
import crypto from 'crypto';
import { isKnownWeakHash } from './knownWeakHashes';

const SCRYPT_N = 32768; // 2^15
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAXMEM = 128 * 1024 * 1024; // 128MB

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'alhamd123',
  'alhamd1234',
  'alhamdshop',
  'alhamdmobile',
  'alhamd',
  'admin123',
  'admin1234',
  'admin2026',
  'admin@123',
  'qwerty1234',
  'welcome123',
]);

/**
 * Validates password strength against policy:
 * - Minimum 10 characters
 * - At least 3 of 4 character classes: uppercase, lowercase, numbers, special characters
 * - Not in common passwords denylist
 */
export function validatePasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }

  if (password.length < 10) {
    return { valid: false, error: 'Password must be at least 10 characters long.' };
  }

  if (password.length > 256) {
    return { valid: false, error: 'Password cannot exceed 256 characters.' };
  }

  const lower = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(lower) || lower.includes('alhamd123') || lower.includes('password123')) {
    return {
      valid: false,
      error: 'Password is too common or easily guessable. Please choose a more complex password.',
    };
  }

  let classesCount = 0;
  if (/[a-z]/.test(password)) classesCount++;
  if (/[A-Z]/.test(password)) classesCount++;
  if (/[0-9]/.test(password)) classesCount++;
  if (/[^a-zA-Z0-9]/.test(password)) classesCount++;

  if (classesCount < 3) {
    return {
      valid: false,
      error:
        'Password must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, and special symbols.',
    };
  }

  return { valid: true };
}

/**
 * Derives scrypt key asynchronously.
 */
function scryptAsync(
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hashes a password using Node.js crypto.scrypt.
 * Output format: scrypt$N$r$p$<saltB64>$<hashB64>
 */
export async function hashPasswordSecure(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }

  const saltBytes = crypto.randomBytes(SCRYPT_SALT_BYTES);
  const derivedKey = await scryptAsync(password, saltBytes, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

  const saltB64 = saltBytes.toString('base64url');
  const hashB64 = derivedKey.toString('base64url');

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${saltB64}$${hashB64}`;
}

/**
 * Checks if a stored hash needs to be upgraded/rehashed to modern scrypt parameters.
 */
export function needsRehash(storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return true;
  if (!storedHash.startsWith('scrypt$')) return true;

  const parts = storedHash.split('$');
  if (parts.length !== 6) return true;

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);

  return N !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P;
}

/**
 * Verifies a password against a stored scrypt hash in format:
 * scrypt$N$r$p$<saltB64>$<hashB64>
 */
export async function verifyPasswordSecure(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  if (!storedHash.startsWith('scrypt$')) return false;

  const parts = storedHash.split('$');
  if (parts.length !== 6) return false;

  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const N = parseInt(nStr, 10);
  const r = parseInt(rStr, 10);
  const p = parseInt(pStr, 10);

  if (isNaN(N) || isNaN(r) || isNaN(p) || !saltB64 || !hashB64) {
    return false;
  }

  try {
    const saltBytes = Buffer.from(saltB64, 'base64url');
    const expectedHashBytes = Buffer.from(hashB64, 'base64url');

    const derivedKey = await scryptAsync(password, saltBytes, expectedHashBytes.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });

    if (derivedKey.length !== expectedHashBytes.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedHashBytes);
  } catch {
    return false;
  }
}

// Pre-computed dummy scrypt hash to normalize timing for non-existent accounts
const DUMMY_SCRYPT_SALT = 'e6f9b2d3c1a8e4f0';
const DUMMY_SCRYPT_HASH =
  'scrypt$32768$8$1$ZTY5OWIyZDNjMWE4ZTRmMA$j4q1rYt2Vv7Xm8nPq9w0e1r2t3y4u5i6o7p8a9s0d1f2g3h4j5k6l7z8x9c0v1b2n3m4Q5W6E7R8T9Y0U1I2';

/**
 * Runs a dummy scrypt computation against an invalid password to prevent account enumeration via timing attacks.
 */
export async function runDummyPasswordComputation(password = 'dummy-pass-alhamd-timing'): Promise<void> {
  try {
    const salt = Buffer.from(DUMMY_SCRYPT_SALT, 'hex');
    await scryptAsync(password, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {}
}

export interface UnifiedVerifyOptions {
  password: string;
  storedHash?: string | null;
  salt?: string | null;
  userType: 'staff' | 'customer' | 'wholesale';
  userId?: string;
  email?: string;
}

/**
 * Unified verification function used by every login/authentication path:
 * 1. If stored hash starts with "scrypt$", verifies using scrypt.
 * 2. If legacy salted SHA-256 hash:
 *    - Rejects known weak/default seed hashes via denylist.
 *    - Verifies exact password, then trimmed password.
 *    - Automatically upgrades user record to scrypt in MySQL/storage on success.
 */
export async function verifyUserPasswordUnified(
  options: UnifiedVerifyOptions
): Promise<{ valid: boolean; upgraded: boolean }> {
  const { password, storedHash, salt, userType, userId, email } = options;

  if (!password || !storedHash) {
    await runDummyPasswordComputation(password);
    return { valid: false, upgraded: false };
  }

  // 1. Scrypt Hash
  if (storedHash.startsWith('scrypt$')) {
    const isValid = await verifyPasswordSecure(password, storedHash);
    return { valid: isValid, upgraded: false };
  }

  // 2. Legacy Salted SHA-256 Hash
  // Enforce known weak hashes denylist
  if (isKnownWeakHash(storedHash)) {
    console.warn(`[SECURITY] Rejected login with denylisted legacy seed hash for ${email || userId || 'user'}`);
    return { valid: false, upgraded: false };
  }

  let isLegacyValid = false;
  let matchingPassword = password;

  const { hashPassword, hashCustomerPassword } = await import('../crypto');

  if (userType === 'customer' || userType === 'wholesale') {
    const computedExact = await hashCustomerPassword(password, salt || '');
    if (computedExact === storedHash) {
      isLegacyValid = true;
      matchingPassword = password;
    } else if (password.trim() !== password) {
      const computedTrimmed = await hashCustomerPassword(password.trim(), salt || '');
      if (computedTrimmed === storedHash) {
        isLegacyValid = true;
        matchingPassword = password.trim();
      }
    }
  } else {
    // Staff / Admin
    const computedExact = await hashPassword(password, salt || '');
    if (computedExact === storedHash) {
      isLegacyValid = true;
      matchingPassword = password;
    } else if (password.trim() !== password) {
      const computedTrimmed = await hashPassword(password.trim(), salt || '');
      if (computedTrimmed === storedHash) {
        isLegacyValid = true;
        matchingPassword = password.trim();
      }
    }
  }

  if (!isLegacyValid) {
    return { valid: false, upgraded: false };
  }

  // 3. Silent Scrypt Upgrade on Successful Legacy Verification
  let upgraded = false;
  try {
    const upgradedHash = await hashPasswordSecure(matchingPassword);

    const { isDbConfigured } = await import('../db/mysql');
    if (isDbConfigured()) {
      const { execute } = await import('../db/mysql');
      if (userType === 'staff') {
        if (userId) {
          await execute('UPDATE staff_users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [
            upgradedHash,
            userId,
          ]);
          upgraded = true;
        } else if (email) {
          await execute(
            'UPDATE staff_users SET password_hash = ?, updated_at = NOW() WHERE LOWER(email) = LOWER(?)',
            [upgradedHash, email.trim()]
          );
          upgraded = true;
        }
      } else {
        // Customers / Wholesale
        if (userId) {
          await execute('UPDATE customers SET password_hash = ?, updated_at = NOW() WHERE id = ?', [
            upgradedHash,
            userId,
          ]);
          upgraded = true;
        } else if (email) {
          await execute(
            'UPDATE customers SET password_hash = ?, updated_at = NOW() WHERE LOWER(email) = LOWER(?)',
            [upgradedHash, email.trim()]
          );
          upgraded = true;
        }
      }
    }

    // Also update server memory/dev fallback store if applicable
    if (userType === 'staff') {
      const { getServerStaffUsers, saveServerStaffUsers } = await import('../db/staff-server');
      const staffList = await getServerStaffUsers();
      const staffMember = staffList.find(
        (s) => (userId && s.id === userId) || (email && s.email.toLowerCase() === email.toLowerCase())
      );
      if (staffMember) {
        staffMember.passwordHash = upgradedHash;
        await saveServerStaffUsers(staffList);
        upgraded = true;
      }
    } else {
      const { getServerCustomers, saveServerCustomers } = await import('../db/customers-server');
      const custList = await getServerCustomers();
      const customer = custList.find(
        (c) => (userId && c.id === userId) || (email && c.email?.toLowerCase() === email.toLowerCase())
      );
      if (customer) {
        customer.passwordHash = upgradedHash;
        await saveServerCustomers(custList);
        upgraded = true;
      }
    }

    if (upgraded) {
      console.log(`[SECURITY] Successfully auto-upgraded password hash to scrypt for account`);
    }
  } catch (err: any) {
    // Fail open for login: Never fail a valid user login if the background upgrade write fails
    console.warn(`[SECURITY WARN] Automatic password upgrade write encountered an issue: ${err?.message || 'unknown error'}`);
  }

  return { valid: true, upgraded };
}

