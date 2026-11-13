import 'server-only';
import { query, execute, isDbConfigured } from '../mysql';
import { StaffUser } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';
import crypto from 'crypto';
import { ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS } from '@/lib/constants/permissions';

interface StaffRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  role_id: string | null;
  permissions: any;
  avatar: string | null;
  status: 'active' | 'inactive';
  is_owner: number;
  password_hash: string;
  salt: string;
  last_login: string | null;
  totp_secret_enc?: string | null;
  totp_enabled?: number | null;
  totp_recovery_hashes?: string | null;
  totp_enrolled_at?: string | null;
  session_version?: number | null;
  created_at: string;
  updated_at: string;
}

export function hashStaffPassword(password: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${password}:${salt}:alhamd_staff_v1`)
    .digest('hex');
}

export function generateStaffSalt(byteLength = 16): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export function verifyStaffPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;

  if (hashStaffPassword(password, salt) === expectedHash) return true;

  if (password.trim() !== password && hashStaffPassword(password.trim(), salt) === expectedHash) {
    return true;
  }

  // Handle case variance on first letter
  if (password.length > 0) {
    const toggled =
      password[0] === password[0].toUpperCase()
        ? password[0].toLowerCase() + password.slice(1)
        : password[0].toUpperCase() + password.slice(1);
    if (hashStaffPassword(toggled, salt) === expectedHash) return true;
    if (hashStaffPassword(toggled.trim(), salt) === expectedHash) return true;
  }

  return false;
}

function parseJsonField<T>(field: any, fallback: T): T {
  if (!field) return fallback;
  if (typeof field === 'object') return field as T;
  try {
    return JSON.parse(field) as T;
  } catch {
    return fallback;
  }
}

function mapRowToStaff(row: StaffRow): StaffUser {
  const parsedPerms = parseJsonField<string[]>(row.permissions, []);
  const emailLower = (row.email || '').trim().toLowerCase();
  const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const isOwner = Boolean(
    row.is_owner ||
    (envAdminEmail && emailLower === envAdminEmail)
  );
  const role = row.role || (isOwner ? 'SUPER_ADMIN' : 'Manager');
  const fallbackPerms = isOwner || role === 'SUPER_ADMIN' || role === 'OWNER'
    ? [...ALL_PERMISSION_KEYS]
    : (ROLE_DEFAULT_PERMISSIONS[role] || []);

  const permissions = Array.isArray(parsedPerms) && parsedPerms.length > 0
    ? parsedPerms
    : fallbackPerms;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    role: role as any,
    roleId: row.role_id || undefined,
    permissions,
    avatar: row.avatar || undefined,
    status: row.status,
    isOwner,
    passwordHash: row.password_hash,
    salt: row.salt,
    lastLogin: row.last_login || undefined,
    totpSecretEnc: row.totp_secret_enc || undefined,
    totpEnabled: Boolean(row.totp_enabled),
    totpRecoveryHashes: parseJsonField<string[]>(row.totp_recovery_hashes, []),
    totpEnrolledAt: row.totp_enrolled_at || undefined,
    sessionVersion: typeof row.session_version === 'number' ? row.session_version : 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllStaffFromDb(): Promise<StaffUser[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<StaffRow[]>(
    'SELECT * FROM staff_users ORDER BY is_owner DESC, name ASC'
  );

  return rows.map(mapRowToStaff);
}

export async function getStaffByIdFromDb(id: string): Promise<StaffUser | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<StaffRow[]>(
    'SELECT * FROM staff_users WHERE id = ? LIMIT 1',
    [id]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToStaff(rows[0]);
}

export async function getStaffByEmailFromDb(email: string): Promise<StaffUser | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const normalized = email.trim().toLowerCase();
  const rows = await query<StaffRow[]>(
    'SELECT * FROM staff_users WHERE LOWER(email) = ? LIMIT 1',
    [normalized]
  );

  if (rows && rows.length > 0) {
    return mapRowToStaff(rows[0]);
  }

  return null;
}

export async function createStaffInDb(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
  phone?: string;
  avatar?: string;
  status?: 'active' | 'inactive';
  permissions?: string[];
}): Promise<StaffUser> {
  const normalizedEmail = (data.email || '').trim().toLowerCase();
  const existing = await getStaffByEmailFromDb(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const salt = generateStaffSalt(16);
  const passwordHash = hashStaffPassword(data.password, salt);
  const id = `staff-${Date.now()}`;
  const assignedRole = data.role || 'Manager';
  const assignedPermissions =
    Array.isArray(data.permissions)
      ? data.permissions
      : ROLE_DEFAULT_PERMISSIONS[assignedRole] || (assignedRole === 'SUPER_ADMIN' ? [...ALL_PERMISSION_KEYS] : []);

  await execute(
    `INSERT INTO staff_users (
      id, name, email, phone, role, permissions, avatar, status, is_owner, password_hash, salt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      data.name.trim(),
      normalizedEmail,
      (data.phone || '').trim() || null,
      assignedRole,
      JSON.stringify(assignedPermissions),
      (data.avatar || '').trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      data.status === 'inactive' ? 'inactive' : 'active',
      passwordHash,
      salt,
    ]
  );

  return (await getStaffByIdFromDb(id))!;
}

export async function updateStaffInDb(
  id: string,
  updates: Partial<StaffUser> & { newPassword?: string }
): Promise<StaffUser> {
  const existing = await getStaffByIdFromDb(id);
  if (!existing) {
    throw new Error('Staff member not found.');
  }

  let salt = existing.salt;
  let passwordHash = existing.passwordHash;
  let sessionVersion = existing.sessionVersion || 1;

  // Invalidate sessions immediately on password, role, permission, status, or 2FA change
  const shouldBumpSession =
    Boolean(updates.newPassword) ||
    (updates.role !== undefined && updates.role !== existing.role) ||
    (updates.permissions !== undefined) ||
    (updates.status !== undefined && updates.status !== existing.status) ||
    (updates.totpEnabled !== undefined) ||
    (updates.sessionVersion !== undefined);

  if (shouldBumpSession) {
    sessionVersion = (existing.sessionVersion || 1) + 1;
  }

  if (updates.newPassword && updates.newPassword.trim().length >= 4) {
    salt = generateStaffSalt(16);
    passwordHash = hashStaffPassword(updates.newPassword.trim(), salt);
  }

  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const email = updates.email !== undefined ? updates.email.trim().toLowerCase() : existing.email;
  const phone = updates.phone !== undefined ? updates.phone.trim() : (existing.phone || null);
  const avatar = updates.avatar !== undefined ? updates.avatar.trim() : (existing.avatar || null);
  const status = updates.status !== undefined ? updates.status : existing.status;
  const role = updates.role !== undefined ? updates.role : existing.role;
  const permissions = updates.permissions !== undefined ? updates.permissions : existing.permissions;
  const totpSecretEnc = updates.totpSecretEnc !== undefined ? updates.totpSecretEnc : (existing.totpSecretEnc || null);
  const totpEnabled = updates.totpEnabled !== undefined ? (updates.totpEnabled ? 1 : 0) : (existing.totpEnabled ? 1 : 0);
  const totpRecoveryHashes = updates.totpRecoveryHashes !== undefined ? JSON.stringify(updates.totpRecoveryHashes) : (existing.totpRecoveryHashes ? JSON.stringify(existing.totpRecoveryHashes) : null);
  const totpEnrolledAt = updates.totpEnrolledAt !== undefined ? updates.totpEnrolledAt : (existing.totpEnrolledAt || null);

  try {
    await execute(
      `UPDATE staff_users SET
        name = ?, email = ?, phone = ?, avatar = ?, status = ?, role = ?,
        permissions = ?, salt = ?, password_hash = ?, session_version = ?,
        totp_secret_enc = ?, totp_enabled = ?, totp_recovery_hashes = ?, totp_enrolled_at = ?
       WHERE id = ?`,
      [
        name,
        email,
        phone,
        avatar,
        status,
        role,
        JSON.stringify(permissions),
        salt,
        passwordHash,
        sessionVersion,
        totpSecretEnc,
        totpEnabled,
        totpRecoveryHashes,
        totpEnrolledAt,
        id,
      ]
    );
  } catch (err: any) {
    // If migration add_staff_2fa.sql has not been run yet, gracefully fallback to basic columns
    if (err?.message?.includes('Unknown column') || err?.code === 'ER_BAD_FIELD_ERROR') {
      await execute(
        `UPDATE staff_users SET
          name = ?, email = ?, phone = ?, avatar = ?, status = ?, role = ?,
          permissions = ?, salt = ?, password_hash = ?
         WHERE id = ?`,
        [
          name,
          email,
          phone,
          avatar,
          status,
          role,
          JSON.stringify(permissions),
          salt,
          passwordHash,
          id,
        ]
      );
    } else {
      throw err;
    }
  }

  return (await getStaffByIdFromDb(id))!;
}

export async function deleteStaffInDb(id: string): Promise<boolean> {
  const existing = await getStaffByIdFromDb(id);
  if (!existing) return false;

  await execute('DELETE FROM staff_users WHERE id = ?', [id]);
  return true;
}
