import fs from 'fs';
import path from 'path';
import { StaffUser } from '@/types/admin';
import { INITIAL_STAFF_USERS } from './staff';
import { isDbConfigured } from './mysql';
import {
  getAllStaffFromDb,
  getStaffByEmailFromDb,
  hashStaffPassword,
  generateStaffSalt,
  verifyStaffPassword,
  createStaffInDb,
  updateStaffInDb,
  deleteStaffInDb,
} from './repositories/staff';

const DATA_DIR = path.join(process.cwd(), 'data');
const STAFF_FILE = path.join(DATA_DIR, 'staff-users.json');

let memoryStaffUsers: StaffUser[] | null = null;
let lastStaffFileMtime: number = 0;

function loadLocalFileStaff(): StaffUser[] {
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

function saveLocalFileStaff(users: StaffUser[]): void {
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
 * Returns all staff users. Queries MySQL database when configured.
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

  if (!shouldReloadFromFile() && memoryStaffUsers && memoryStaffUsers.length > 0) {
    return memoryStaffUsers;
  }

  const loaded = loadLocalFileStaff();
  memoryStaffUsers = loaded;
  return loaded;
}

export function getServerStaffUsersSync(): StaffUser[] {
  if (isDbConfigured()) {
    if (memoryStaffUsers && memoryStaffUsers.length > 0) {
      return memoryStaffUsers;
    }
    const fallback = loadLocalFileStaff();
    if (fallback.length > 0) {
      memoryStaffUsers = fallback;
    }
    return fallback;
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
  if (!isDbConfigured()) {
    saveLocalFileStaff(users);
  }
}

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

  const allUsers = getServerStaffUsersSync();
  const directMatch = allUsers.find((u) => u.email.toLowerCase() === normalized);
  if (directMatch) return directMatch;

  if (normalized === 'admin@alhamdmobile.com' || normalized === 'admin@alhamd.com') {
    return allUsers.find(
      (u) => u.isOwner || u.id === 'staff-owner-1' || u.email.toLowerCase() === 'admin@alhamdmobile.com'
    );
  }

  return undefined;
}

export function getServerStaffByEmailSync(email: string): StaffUser | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  const allUsers = getServerStaffUsersSync();

  const directMatch = allUsers.find((u) => u.email.toLowerCase() === normalized);
  if (directMatch) return directMatch;

  if (normalized === 'admin@alhamdmobile.com' || normalized === 'admin@alhamd.com') {
    return allUsers.find(
      (u) => u.isOwner || u.id === 'staff-owner-1' || u.email.toLowerCase() === 'admin@alhamdmobile.com'
    );
  }

  return undefined;
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
