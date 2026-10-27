import crypto from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { query, execute, isDbConfigured } from '../mysql';
import {
  StoredPasswordResetToken,
  getStoredResetTokens,
  saveStoredResetToken,
  findStoredTokenByHash,
  findRecentRequestsByEmailOrIp,
} from '../passwordResetStorage';
import {
  hashCustomerPassword,
  generateCustomerSalt,
} from './customers';
import {
  hashStaffPassword,
  generateStaffSalt,
} from './staff';
import { getServerCustomers, saveServerCustomers } from '../customers-server';
import { getServerStaffUsers, saveServerStaffUsers } from '../staff-server';

export interface PasswordResetRow extends RowDataPacket {
  id: string;
  user_type: 'customer' | 'staff';
  user_id: string | null;
  email: string;
  token_hash: string;
  expires_at: string | Date;
  is_used: number | boolean;
  used_at: string | Date | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | Date;
}

export interface CreateResetTokenParams {
  email: string;
  userType: 'customer' | 'staff';
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresInMinutes?: number;
}

export interface SanitizedResetRequest {
  id: string;
  userType: 'customer' | 'staff';
  maskedEmail: string;
  isUsed: boolean;
  isExpired: boolean;
  expiresAt: string;
  usedAt: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}***@${domain}`;
  }
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

/**
 * Check if the MySQL password_reset_tokens table exists; if not, safely create it.
 */
let tableChecked = false;
async function ensureMysqlTable(): Promise<void> {
  if (tableChecked || !isDbConfigured()) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`user_type\` ENUM('customer', 'staff') NOT NULL DEFAULT 'customer',
        \`user_id\` VARCHAR(100) NULL,
        \`email\` VARCHAR(255) NOT NULL,
        \`token_hash\` VARCHAR(64) NOT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`is_used\` TINYINT(1) NOT NULL DEFAULT 0,
        \`used_at\` DATETIME NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`user_agent\` VARCHAR(500) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_prt_token_hash\` (\`token_hash\`),
        KEY \`idx_prt_email_type\` (\`email\`, \`user_type\`),
        KEY \`idx_prt_status_expires\` (\`is_used\`, \`expires_at\`),
        KEY \`idx_prt_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    tableChecked = true;
  } catch (err) {
    console.warn('[passwordReset] MySQL ensureTable notice:', err);
  }
}

/**
 * Create a new single-use password reset token with cryptographic SHA-256 hash storage.
 */
export async function createPasswordResetToken(
  params: CreateResetTokenParams
): Promise<{ success: boolean; rawToken?: string; expiresAt?: Date; rateLimited?: boolean }> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const expiresInMinutes = params.expiresInMinutes || 60;
  const ip = params.ipAddress || null;

  // Rate Limiting: Max 3 reset requests per 15 minutes per email/IP
  if (isDbConfigured()) {
    await ensureMysqlTable();
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const rows = await query<PasswordResetRow[]>(
        `SELECT id FROM password_reset_tokens
         WHERE created_at >= ? AND (LOWER(email) = ? OR (ip_address IS NOT NULL AND ip_address = ?))`,
        [fifteenMinutesAgo, normalizedEmail, ip]
      );
      if (rows && rows.length >= 3) {
        return { success: false, rateLimited: true };
      }
    } catch (err) {
      console.warn('[passwordReset] Rate limit check query failed:', err);
    }
  } else {
    const recent = findRecentRequestsByEmailOrIp(normalizedEmail, ip, 15);
    if (recent.length >= 3) {
      return { success: false, rateLimited: true };
    }
  }

  // 1. Generate 256 bits of cryptographic entropy (64 hex characters)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const tokenId = `prt-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  if (isDbConfigured()) {
    try {
      await execute(
        `INSERT INTO password_reset_tokens (
          id, user_type, user_id, email, token_hash, expires_at, is_used, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          tokenId,
          params.userType,
          params.userId || null,
          normalizedEmail,
          tokenHash,
          expiresAt,
          ip,
          params.userAgent ? params.userAgent.slice(0, 500) : null,
        ]
      );
      return { success: true, rawToken, expiresAt };
    } catch (err) {
      console.error('[passwordReset] Failed to insert token into MySQL:', err);
      // Fallback to local storage if DB insert fails
    }
  }

  // Storage fallback
  const stored: StoredPasswordResetToken = {
    id: tokenId,
    user_type: params.userType,
    user_id: params.userId || null,
    email: normalizedEmail,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    is_used: false,
    used_at: null,
    ip_address: ip,
    user_agent: params.userAgent ? params.userAgent.slice(0, 500) : null,
    created_at: new Date().toISOString(),
  };

  saveStoredResetToken(stored);
  return { success: true, rawToken, expiresAt };
}

/**
 * Verify a raw token without consuming it.
 */
export async function verifyPasswordResetToken(
  rawToken: string
): Promise<{
  valid: boolean;
  error?: string;
  email?: string;
  maskedEmail?: string;
  userType?: 'customer' | 'staff';
  userId?: string | null;
  id?: string;
}> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
    return { valid: false, error: 'Invalid or missing password reset link.' };
  }

  const cleanToken = rawToken.trim();
  const tokenHash = hashResetToken(cleanToken);

  let record: {
    id: string;
    email: string;
    userType: 'customer' | 'staff';
    userId: string | null;
    isUsed: boolean;
    expiresAt: Date;
  } | null = null;

  if (isDbConfigured()) {
    await ensureMysqlTable();
    try {
      const rows = await query<PasswordResetRow[]>(
        'SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1',
        [tokenHash]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        record = {
          id: r.id,
          email: r.email,
          userType: r.user_type,
          userId: r.user_id,
          isUsed: Boolean(r.is_used),
          expiresAt: new Date(r.expires_at),
        };
      }
    } catch (err) {
      console.warn('[passwordReset] MySQL query failed, falling back to local storage:', err);
    }
  }

  if (!record) {
    const local = findStoredTokenByHash(tokenHash);
    if (local) {
      record = {
        id: local.id,
        email: local.email,
        userType: local.user_type,
        userId: local.user_id,
        isUsed: local.is_used,
        expiresAt: new Date(local.expires_at),
      };
    }
  }

  if (!record) {
    return { valid: false, error: 'This password reset link is invalid or does not exist.' };
  }

  if (record.isUsed) {
    return { valid: false, error: 'This password reset link has already been used. Please request a new one.' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { valid: false, error: 'This password reset link has expired. Reset links are valid for 60 minutes.' };
  }

  return {
    valid: true,
    id: record.id,
    email: record.email,
    maskedEmail: maskEmail(record.email),
    userType: record.userType,
    userId: record.userId,
  };
}

/**
 * Execute password reset: hashes new password, updates account, and marks token as used.
 */
export async function completePasswordReset(
  rawToken: string,
  newPassword: string
): Promise<{ success: boolean; message: string; userType?: 'customer' | 'staff'; email?: string }> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const verification = await verifyPasswordResetToken(rawToken);
  if (!verification.valid || !verification.email || !verification.userType) {
    throw new Error(verification.error || 'Password reset token is invalid or expired.');
  }

  const { email, userType } = verification;
  const tokenHash = hashResetToken(rawToken.trim());
  const now = new Date();

  // 1. Update Password based on userType
  if (userType === 'customer') {
    const salt = generateCustomerSalt(16);
    const passwordHash = hashCustomerPassword(newPassword, salt);

    if (isDbConfigured()) {
      try {
        await execute(
          `UPDATE customers SET password_hash = ?, password_salt = ?, updated_at = NOW() WHERE LOWER(email) = ?`,
          [passwordHash, salt, email.toLowerCase()]
        );
      } catch (err) {
        console.error('[passwordReset] Failed to update customer in MySQL:', err);
        throw new Error('Failed to update password in database. Please try again.');
      }
    } else {
      const customers = await getServerCustomers();
      const updated = customers.map((c) => {
        if (c.email && c.email.toLowerCase() === email.toLowerCase()) {
          return {
            ...c,
            passwordHash,
            passwordSalt: salt,
          };
        }
        return c;
      });
      await saveServerCustomers(updated);
    }
  } else if (userType === 'staff') {
    const salt = generateStaffSalt(16);
    const passwordHash = hashStaffPassword(newPassword, salt);

    if (isDbConfigured()) {
      try {
        await execute(
          `UPDATE staff_users SET password_hash = ?, salt = ?, updated_at = NOW() WHERE LOWER(email) = ?`,
          [passwordHash, salt, email.toLowerCase()]
        );
      } catch (err) {
        console.error('[passwordReset] Failed to update staff in MySQL:', err);
        throw new Error('Failed to update staff password in database. Please try again.');
      }
    } else {
      const staffList = await getServerStaffUsers();
      const updated = staffList.map((s) => {
        if (s.email.toLowerCase() === email.toLowerCase()) {
          return {
            ...s,
            passwordHash,
            salt,
          };
        }
        return s;
      });
      await saveServerStaffUsers(updated);
    }
  }

  // 2. Invalidate / Consume the reset token
  if (isDbConfigured()) {
    try {
      await execute(
        `UPDATE password_reset_tokens SET is_used = 1, used_at = ? WHERE token_hash = ?`,
        [now, tokenHash]
      );
    } catch (err) {
      console.warn('[passwordReset] Error marking token used in MySQL:', err);
    }
  }

  // Also update local storage if present
  const local = findStoredTokenByHash(tokenHash);
  if (local) {
    saveStoredResetToken({
      ...local,
      is_used: true,
      used_at: now.toISOString(),
    });
  }

  return {
    success: true,
    message: 'Your password has been successfully reset. You can now sign in with your new password.',
    userType,
    email,
  };
}

/**
 * Admin Panel: List recent reset requests (Sanitized, NO tokens or passwords exposed).
 */
export async function getAllResetRequests(): Promise<SanitizedResetRequest[]> {
  const now = Date.now();

  if (isDbConfigured()) {
    await ensureMysqlTable();
    try {
      const rows = await query<PasswordResetRow[]>(
        `SELECT id, user_type, email, expires_at, is_used, used_at, ip_address, created_at
         FROM password_reset_tokens
         ORDER BY created_at DESC
         LIMIT 100`
      );
      return rows.map((r) => {
        const expTime = new Date(r.expires_at).getTime();
        return {
          id: r.id,
          userType: r.user_type,
          maskedEmail: maskEmail(r.email),
          isUsed: Boolean(r.is_used),
          isExpired: expTime < now && !r.is_used,
          expiresAt: new Date(r.expires_at).toISOString(),
          usedAt: r.used_at ? new Date(r.used_at).toISOString() : null,
          ipAddress: r.ip_address || null,
          createdAt: new Date(r.created_at).toISOString(),
        };
      });
    } catch (err) {
      console.warn('[passwordReset] MySQL getAllResetRequests query error:', err);
    }
  }

  const stored = getStoredResetTokens();
  return stored.map((s) => {
    const expTime = new Date(s.expires_at).getTime();
    return {
      id: s.id,
      userType: s.user_type,
      maskedEmail: maskEmail(s.email),
      isUsed: s.is_used,
      isExpired: expTime < now && !s.is_used,
      expiresAt: s.expires_at,
      usedAt: s.used_at,
      ipAddress: s.ip_address,
      createdAt: s.created_at,
    };
  });
}

/**
 * Admin Panel: Invalidate / Revoke a reset token by ID.
 */
export async function revokeResetToken(id: string): Promise<boolean> {
  const now = new Date();
  let updated = false;

  if (isDbConfigured()) {
    try {
      await execute(
        `UPDATE password_reset_tokens SET is_used = 1, used_at = ? WHERE id = ?`,
        [now, id]
      );
      updated = true;
    } catch (err) {
      console.warn('[passwordReset] MySQL revoke error:', err);
    }
  }

  const stored = getStoredResetTokens();
  const target = stored.find((t) => t.id === id);
  if (target) {
    saveStoredResetToken({
      ...target,
      is_used: true,
      used_at: now.toISOString(),
    });
    updated = true;
  }

  return updated;
}
