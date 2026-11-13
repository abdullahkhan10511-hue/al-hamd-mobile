import 'server-only';
import fs from 'fs';
import path from 'path';
import { StaffUser } from '@/types/admin';
import { INITIAL_STAFF_USERS } from './staff';
import { isDbConfigured } from './mysql';
import {
  getAllStaffFromDb,
  getStaffByEmailFromDb,
  getStaffByIdFromDb,
  hashStaffPassword,
  generateStaffSalt,
  verifyStaffPassword,
  createStaffInDb,
  updateStaffInDb,
  deleteStaffInDb,
} from './repositories/staff';
import { getDataDir } from '@/lib/storage/dataDir';

const DATA_DIR = getDataDir();
const STAFF_FILE = path.join(DATA_DIR, 'staff-users.json');

let memoryStaffUsers: StaffUser[] | null = null;
let lastStaffFileMtime: number = 0;

/**
 * Loads staff users from data/staff-users.json.
 * Strict Security Policy: The JSON file may be used only when MySQL is NOT configured
 * and NODE_ENV !== 'production'. In production or when MySQL is configured, returns [].
 */
function loadLocalFileStaff(): StaffUser[] {
  if (isDbConfigured() || process.env.NODE_ENV === 'production') {
    return [];
  }
  try {
    if (fs.existsSync(STAFF_FILE)) {
      const stat = fs.statSync(STAFF_FILE);
      lastStaffFileMtime = stat.mtimeMs;
      const content = fs.readFileSync(STAFF_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading staff-users.json:', err);
  }
  return [...INITIAL_STAFF_USERS];
}

/**
 * Saves staff users to local fallback JSON file.
 * The JSON file may be used only when MySQL is NOT configured and NODE_ENV !== 'production'.
 */
function saveLocalFileStaff(users: StaffUser[]): void {
  if (isDbConfigured() || process.env.NODE_ENV === 'production') {
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STAFF_FILE, JSON.stringify(users, null, 2), 'utf8');
    if (fs.existsSync(STAFF_FILE)) {
      lastStaffFileMtime = fs.statSync(STAFF_FILE).mtimeMs;
    }
  } catch (err) {
    console.error('Error writing staff-users.json fallback:', err);
  }
}

function shouldReloadFromFile(): boolean {
  if (isDbConfigured() || process.env.NODE_ENV === 'production') return false;
  if (!memoryStaffUsers || memoryStaffUsers.length === 0) return true;
  try {
    if (fs.existsSync(STAFF_FILE)) {
      const stat = fs.statSync(STAFF_FILE);
      if (stat.mtimeMs > lastStaffFileMtime) {
        return true;
      }
    }
  } catch {}
  return false;
}

/**
 * Returns all staff users. Queries MySQL database with async query when configured.
 * Never reads from data/staff-users.json in production or when MySQL is configured.
 */
export async function getServerStaffUsers(): Promise<StaffUser[]> {
  if (isDbConfigured()) {
    try {
      const users = await getAllStaffFromDb();
      memoryStaffUsers = users;
      return users;
    } catch (err) {
      console.warn('MySQL error in getServerStaffUsers:', err);
      return [];
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return memoryStaffUsers || [];
  }

  if (!shouldReloadFromFile() && memoryStaffUsers && memoryStaffUsers.length > 0) {
    return memoryStaffUsers;
  }

  const loaded = loadLocalFileStaff();
  memoryStaffUsers = loaded;
  return loaded;
}

/**
 * Synchronous staff users getter.
 * The JSON file may be used only when MySQL is NOT configured and NODE_ENV !== 'production'.
 */
export function getServerStaffUsersSync(): StaffUser[] {
  if (isDbConfigured() || process.env.NODE_ENV === 'production') {
    return memoryStaffUsers || [];
  }
  if (!shouldReloadFromFile() && memoryStaffUsers && memoryStaffUsers.length > 0) {
    return memoryStaffUsers;
  }
  const loaded = loadLocalFileStaff();
  memoryStaffUsers = loaded;
  return loaded;
}

export async function saveServerStaffUsers(users: StaffUser[]): Promise<void> {
  memoryStaffUsers = users;
  if (!isDbConfigured() && process.env.NODE_ENV !== 'production') {
    saveLocalFileStaff(users);
  }
}

/**
 * Check if 2FA migration table columns are present in MySQL.
 */
export async function isStaff2faColumnAvailable(): Promise<boolean> {
  if (!isDbConfigured()) return true; // Local dev supports mock 2fa
  try {
    const { query } = require('./mysql');
    const cols = await query('SHOW COLUMNS FROM staff_users LIKE "totp_secret_enc"');
    return Array.isArray(cols) && cols.length > 0;
  } catch {
    return false;
  }
}


/**
 * Async lookup by email.
 * When MySQL is configured, queries MySQL with an async query, never reading data/staff-users.json.
 */
export async function getServerStaffByEmail(email: string): Promise<StaffUser | undefined> {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();

  if (isDbConfigured()) {
    try {
      const found = await getStaffByEmailFromDb(normalized);
      if (found) {
        if (!memoryStaffUsers) memoryStaffUsers = [];
        const idx = memoryStaffUsers.findIndex((u) => u.email.toLowerCase() === normalized);
        if (idx >= 0) memoryStaffUsers[idx] = found;
        else memoryStaffUsers.push(found);
      }
      return found || undefined;
    } catch (err) {
      console.warn('MySQL error in getServerStaffByEmail:', err);
      throw err;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return (memoryStaffUsers || []).find((u) => u.email.toLowerCase() === normalized);
  }

  const allUsers = getServerStaffUsersSync();
  return allUsers.find((u) => u.email.toLowerCase() === normalized);
}

/**
 * Async lookup by id.
 * When MySQL is configured, queries MySQL with an async query, never reading data/staff-users.json.
 */
export async function getServerStaffById(id: string): Promise<StaffUser | undefined> {
  if (!id) return undefined;

  if (isDbConfigured()) {
    try {
      const found = await getStaffByIdFromDb(id);
      if (found) {
        if (!memoryStaffUsers) memoryStaffUsers = [];
        const idx = memoryStaffUsers.findIndex((u) => u.id === id);
        if (idx >= 0) memoryStaffUsers[idx] = found;
        else memoryStaffUsers.push(found);
      }
      return found || undefined;
    } catch (err) {
      console.warn('MySQL error in getServerStaffById:', err);
      throw err;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return (memoryStaffUsers || []).find((u) => u.id === id);
  }

  const allUsers = getServerStaffUsersSync();
  return allUsers.find((u) => u.id === id);
}

/**
 * Synchronous lookup by id.
 * Uses in-memory state when DB is configured or in production.
 */
export function getServerStaffByIdSync(id: string): StaffUser | undefined {
  if (!id) return undefined;
  if (isDbConfigured() || process.env.NODE_ENV === 'production') {
    return (memoryStaffUsers || []).find((u) => u.id === id);
  }
  const allUsers = getServerStaffUsersSync();
  return allUsers.find((u) => u.id === id);
}

/**
 * Synchronous lookup by email.
 * Uses in-memory state when DB is configured or in production.
 */
export function getServerStaffByEmailSync(email: string): StaffUser | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  if (isDbConfigured() || process.env.NODE_ENV === 'production') {
    return (memoryStaffUsers || []).find((u) => u.email.toLowerCase() === normalized);
  }
  const allUsers = getServerStaffUsersSync();
  return allUsers.find((u) => u.email.toLowerCase() === normalized);
}

export function hashServerPassword(password: string, salt: string): string {
  return hashStaffPassword(password, salt);
}

export function generateServerSalt(byteLength = 16): string {
  return generateStaffSalt(byteLength);
}

export function verifyServerPassword(password: string, salt: string, expectedHash: string): boolean {
  return verifyStaffPassword(password, salt, expectedHash);
}

export { createStaffInDb, updateStaffInDb, deleteStaffInDb };
