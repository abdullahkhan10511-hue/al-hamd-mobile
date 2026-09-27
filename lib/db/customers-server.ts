import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Customer, CustomerType } from '@/types/admin';
import { isDbConfigured } from './mysql';
import {
  getAllCustomersFromDb,
  getCustomerByIdFromDb,
  getCustomerByEmailFromDb,
  getCustomerByShopNameFromDb,
  createWholesaleAccountInDb,
  createSuperWholesaleAccountInDb,
  updateWholesaleAccountInDb,
  registerCustomerInDb,
  authenticateCustomerInDb,
  deleteCustomerInDb,
  hashCustomerPassword,
  generateCustomerSalt,
  verifyCustomerPassword,
} from './repositories/customers';

const DATA_DIR = path.join(process.cwd(), 'data');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

export type SanitizedCustomer = Omit<Customer, 'passwordHash' | 'passwordSalt'>;

export function sanitizeCustomer(customer: Customer): SanitizedCustomer {
  const { passwordHash, passwordSalt, ...safe } = customer;
  return safe;
}

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    customerType: 'RETAIL',
    firstName: 'Hamza',
    lastName: 'Khan',
    fullName: 'Hamza Khan',
    email: 'hamza.khan@gmail.com',
    phone: '+92 300 9876543',
    totalOrders: 1,
    totalSpent: 11998,
    createdAt: '2026-03-01T14:32:00.000Z',
    status: 'active',
    passwordHash: '03eb5dccd47c06ff75998f5dfbd03859808725fd5e03da842896a1a0a26d45a7',
    passwordSalt: 'salt_hamza_demo_01',
    address: 'House 42, Street 8, Sector F-7/2',
    city: 'Islamabad',
    province: 'Federal Capital',
    postalCode: '44000',
    dateOfBirth: '1996-05-14',
  },
  {
    id: 'cust-2',
    customerType: 'RETAIL',
    firstName: 'Ayesha',
    lastName: 'Malik',
    fullName: 'Ayesha Malik',
    email: 'ayesha.malik@outlook.com',
    phone: '+92 321 4567890',
    totalOrders: 1,
    totalSpent: 28999,
    createdAt: '2026-02-18T10:15:00.000Z',
    status: 'active',
    passwordHash: 'a36b62ed71b7dd14e11e30aa605da39ca5602bb609609fecb5b4b858222d847a',
    passwordSalt: 'salt_hamza_demo_01',
    address: 'Apartment 4B, Gulberg Heights',
    city: 'Lahore',
    province: 'Punjab',
    postalCode: '54000',
  },
];

let memoryCustomers: Customer[] | null = null;

function loadLocalFileCustomers(): Customer[] {
  try {
    if (fs.existsSync(CUSTOMERS_FILE)) {
      const content = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading customers.json:', err);
  }
  return [...INITIAL_CUSTOMERS];
}

function saveLocalFileCustomers(customers: Customer[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing customers.json fallback:', err);
  }
}

/**
 * Returns all customers. When MySQL is configured, queries MySQL database.
 */
export async function getServerCustomers(): Promise<Customer[]> {
  if (isDbConfigured()) {
    try {
      const customers = await getAllCustomersFromDb();
      memoryCustomers = customers;
      return customers;
    } catch (err) {
      console.warn('MySQL error in getServerCustomers, falling back to local storage:', err);
    }
  }

  if (memoryCustomers && memoryCustomers.length > 0) {
    return memoryCustomers;
  }

  const loaded = loadLocalFileCustomers();
  memoryCustomers = loaded;
  return loaded;
}

export function getServerCustomersSync(): Customer[] {
  if (memoryCustomers && memoryCustomers.length > 0) {
    return memoryCustomers;
  }
  const loaded = loadLocalFileCustomers();
  memoryCustomers = loaded;
  return loaded;
}

export async function saveServerCustomers(customers: Customer[]): Promise<void> {
  memoryCustomers = customers;
  // Always update local file for safe rollback
  saveLocalFileCustomers(customers);
}

export function hashCustomerPasswordServer(password: string, salt: string): string {
  return hashCustomerPassword(password, salt);
}

export function generateCustomerSaltServer(byteLength = 16): string {
  return generateCustomerSalt(byteLength);
}

export function verifyCustomerPasswordServer(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  return verifyCustomerPassword(password, salt, expectedHash);
}

export async function getServerWholesaleAccounts(): Promise<Customer[]> {
  if (isDbConfigured()) {
    try {
      return await getAllCustomersFromDb('WHOLESALE');
    } catch (err) {
      console.warn('MySQL error in getServerWholesaleAccounts:', err);
    }
  }
  const all = getServerCustomersSync();
  return all.filter((c) => c.customerType === 'WHOLESALE');
}

export async function getServerSuperWholesaleAccounts(): Promise<Customer[]> {
  if (isDbConfigured()) {
    try {
      return await getAllCustomersFromDb('SUPER_WHOLESALE');
    } catch (err) {
      console.warn('MySQL error in getServerSuperWholesaleAccounts:', err);
    }
  }
  const all = getServerCustomersSync();
  return all.filter((c) => c.customerType === 'SUPER_WHOLESALE');
}

export async function getServerCustomerById(id: string): Promise<Customer | undefined> {
  if (!id) return undefined;
  if (isDbConfigured()) {
    try {
      const found = await getCustomerByIdFromDb(id);
      if (found) return found;
    } catch (err) {
      console.warn('MySQL error in getServerCustomerById:', err);
    }
  }
  const all = getServerCustomersSync();
  return all.find(
    (c) =>
      c.id === id ||
      ((c.customerType === 'WHOLESALE' || c.customerType === 'SUPER_WHOLESALE') &&
        c.shopName &&
        c.shopName.toLowerCase() === id.toLowerCase())
  );
}

export async function getServerCustomerByShopName(shopName: string): Promise<Customer | undefined> {
  if (!shopName) return undefined;
  const normalized = shopName.trim().toLowerCase();
  if (isDbConfigured()) {
    try {
      const found = await getCustomerByShopNameFromDb(normalized);
      if (found) return found;
    } catch (err) {
      console.warn('MySQL error in getServerCustomerByShopName:', err);
    }
  }
  const all = getServerCustomersSync();
  return all.find(
    (c) =>
      (c.customerType === 'WHOLESALE' || c.customerType === 'SUPER_WHOLESALE') &&
      Boolean(c.shopName) &&
      c.shopName!.trim().toLowerCase() === normalized
  );
}

export async function getServerCustomerByEmail(email: string): Promise<Customer | undefined> {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  if (isDbConfigured()) {
    try {
      const found = await getCustomerByEmailFromDb(normalized);
      if (found) return found;
    } catch (err) {
      console.warn('MySQL error in getServerCustomerByEmail:', err);
    }
  }
  const all = getServerCustomersSync();
  return all.find(
    (c) =>
      c.customerType !== 'WHOLESALE' &&
      c.customerType !== 'SUPER_WHOLESALE' &&
      Boolean(c.email) &&
      c.email!.trim().toLowerCase() === normalized
  );
}

export async function createWholesaleAccountServer(
  data: {
    shopName: string;
    password: string;
    phone?: string;
    address?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<Customer> {
  if (isDbConfigured()) {
    const created = await createWholesaleAccountInDb(data);
    // Sync to local file for safe rollback
    const all = getServerCustomersSync();
    saveLocalFileCustomers([created, ...all]);
    return created;
  }

  // Fallback when DB not configured
  const shopName = (data.shopName || '').trim();
  if (!shopName) throw new Error('Shop Name is required.');
  const rawPassword = (data.password || '').trim();
  if (!rawPassword || rawPassword.length < 4) throw new Error('Password must be at least 4 characters long.');

  const existing = await getServerCustomerByShopName(shopName);
  if (existing) throw new Error('A wholesale account with this shop name already exists.');

  const salt = generateCustomerSalt(16);
  const passwordHash = hashCustomerPassword(rawPassword, salt);
  const cleanSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = `cust-wh-${Date.now()}-${cleanSlug.slice(0, 15) || 'shop'}`;

  const newAccount: Customer = {
    id,
    customerType: 'WHOLESALE',
    shopName,
    fullName: shopName,
    firstName: shopName,
    lastName: '',
    phone: (data.phone || '').trim(),
    address: (data.address || '').trim(),
    passwordHash,
    passwordSalt: salt,
    status: 'active',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: new Date().toISOString(),
  };

  const customers = getServerCustomersSync();
  const updated = [newAccount, ...customers];
  saveLocalFileCustomers(updated);
  memoryCustomers = updated;
  return newAccount;
}

export async function updateWholesaleAccountServer(
  id: string,
  updates: {
    shopName?: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'suspended' | 'deactivated' | 'inactive';
    password?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<Customer> {
  if (isDbConfigured()) {
    const updated = await updateWholesaleAccountInDb(id, updates);
    // Keep local file updated for rollback
    const all = getServerCustomersSync().map((c) => (c.id === id ? updated : c));
    saveLocalFileCustomers(all);
    return updated;
  }

  const customers = getServerCustomersSync();
  const index = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );

  if (index === -1) throw new Error('Wholesale account not found.');
  const target = customers[index];

  let newShopName = target.shopName;
  if (
    updates.shopName &&
    updates.shopName.trim() &&
    updates.shopName.trim().toLowerCase() !== target.shopName?.toLowerCase()
  ) {
    const existing = await getServerCustomerByShopName(updates.shopName.trim());
    if (existing && existing.id !== target.id) {
      throw new Error(`A wholesale account for "${updates.shopName.trim()}" already exists.`);
    }
    newShopName = updates.shopName.trim();
  }

  let newPasswordHash = target.passwordHash;
  let newPasswordSalt = target.passwordSalt;
  if (updates.password && updates.password.trim()) {
    if (updates.password.trim().length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }
    newPasswordSalt = generateCustomerSalt(16);
    newPasswordHash = hashCustomerPassword(updates.password.trim(), newPasswordSalt);
  }

  const updated: Customer = {
    ...target,
    customerType: 'WHOLESALE',
    shopName: newShopName,
    fullName: newShopName || target.fullName,
    firstName: newShopName || target.firstName,
    phone: updates.phone !== undefined ? updates.phone.trim() : target.phone,
    address: updates.address !== undefined ? updates.address.trim() : target.address,
    status: updates.status || target.status || 'active',
    passwordHash: newPasswordHash,
    passwordSalt: newPasswordSalt,
  };

  customers[index] = updated;
  saveLocalFileCustomers(customers);
  memoryCustomers = customers;
  return updated;
}

export async function updateWholesaleAccountStatusServer(
  id: string,
  status: 'active' | 'inactive' | 'deactivated'
): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      await updateWholesaleAccountInDb(id, { status });
      return true;
    } catch {
      return false;
    }
  }

  const customers = getServerCustomersSync();
  const target = customers.find(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );
  if (!target) return false;
  target.status = status;
  saveLocalFileCustomers(customers);
  memoryCustomers = customers;
  return true;
}

export async function deleteWholesaleAccountServer(id: string): Promise<{ success: boolean; error?: string }> {
  if (isDbConfigured()) {
    try {
      const ok = await deleteCustomerInDb(id);
      if (!ok) return { success: false, error: 'Wholesale account not found.' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete wholesale account.' };
    }
  }

  const customers = getServerCustomersSync();
  const index = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );
  if (index === -1) return { success: false, error: 'Wholesale account not found.' };
  customers.splice(index, 1);
  saveLocalFileCustomers(customers);
  memoryCustomers = customers;
  return { success: true };
}

export async function createSuperWholesaleAccountServer(
  data: {
    shopName: string;
    password: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'inactive';
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<Customer> {
  if (isDbConfigured()) {
    const created = await createSuperWholesaleAccountInDb(data);
    const all = getServerCustomersSync();
    saveLocalFileCustomers([created, ...all]);
    return created;
  }

  const shopName = (data.shopName || '').trim();
  if (!shopName) throw new Error('Shop Name is required.');
  const rawPassword = (data.password || '').trim();
  if (!rawPassword || rawPassword.length < 4) throw new Error('Password must be at least 4 characters long.');

  const existing = await getServerCustomerByShopName(shopName);
  if (existing) throw new Error('An account with this shop name already exists.');

  const salt = generateCustomerSalt(16);
  const passwordHash = hashCustomerPassword(rawPassword, salt);
  const cleanSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = `cust-swh-${Date.now()}-${cleanSlug.slice(0, 15) || 'shop'}`;

  const newAccount: Customer = {
    id,
    customerType: 'SUPER_WHOLESALE',
    shopName,
    fullName: shopName,
    firstName: shopName,
    lastName: '',
    phone: (data.phone || '').trim(),
    address: (data.address || '').trim(),
    passwordHash,
    passwordSalt: salt,
    status: data.status === 'inactive' ? 'inactive' : 'active',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: new Date().toISOString(),
  };

  const customers = getServerCustomersSync();
  const updated = [newAccount, ...customers];
  saveLocalFileCustomers(updated);
  memoryCustomers = updated;
  return newAccount;
}

export async function updateSuperWholesaleAccountServer(
  id: string,
  updates: {
    shopName?: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'suspended' | 'deactivated' | 'inactive';
    password?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<Customer> {
  if (isDbConfigured()) {
    const updated = await updateWholesaleAccountInDb(id, updates);
    const all = getServerCustomersSync().map((c) => (c.id === id ? updated : c));
    saveLocalFileCustomers(all);
    return updated;
  }

  const customers = getServerCustomersSync();
  const index = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'SUPER_WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );
  if (index === -1) throw new Error('Super wholesale account not found.');

  const target = customers[index];
  let newShopName = target.shopName;
  if (
    updates.shopName &&
    updates.shopName.trim() &&
    updates.shopName.trim().toLowerCase() !== target.shopName?.toLowerCase()
  ) {
    const duplicate = await getServerCustomerByShopName(updates.shopName.trim());
    if (duplicate && duplicate.id !== target.id) {
      throw new Error(`An account for "${updates.shopName.trim()}" already exists.`);
    }
    newShopName = updates.shopName.trim();
  }

  let newPasswordHash = target.passwordHash;
  let newPasswordSalt = target.passwordSalt;
  if (updates.password && updates.password.trim()) {
    if (updates.password.trim().length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }
    newPasswordSalt = generateCustomerSalt(16);
    newPasswordHash = hashCustomerPassword(updates.password.trim(), newPasswordSalt);
  }

  const updated: Customer = {
    ...target,
    shopName: newShopName,
    fullName: newShopName || target.fullName,
    firstName: newShopName || target.firstName,
    phone: updates.phone !== undefined ? updates.phone.trim() : target.phone,
    address: updates.address !== undefined ? updates.address.trim() : target.address,
    status: updates.status || target.status || 'active',
    passwordHash: newPasswordHash,
    passwordSalt: newPasswordSalt,
  };

  customers[index] = updated;
  saveLocalFileCustomers(customers);
  memoryCustomers = customers;
  return updated;
}

export async function updateSuperWholesaleAccountStatusServer(
  id: string,
  status: 'active' | 'inactive' | 'deactivated'
): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      await updateWholesaleAccountInDb(id, { status });
      return true;
    } catch {
      return false;
    }
  }

  const customers = getServerCustomersSync();
  const target = customers.find(
    (c) =>
      c.id === id ||
      (c.customerType === 'SUPER_WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );
  if (!target) return false;
  target.status = status;
  saveLocalFileCustomers(customers);
  memoryCustomers = customers;
  return true;
}

export async function deleteSuperWholesaleAccountServer(id: string): Promise<{ success: boolean; error?: string }> {
  if (isDbConfigured()) {
    try {
      const ok = await deleteCustomerInDb(id);
      if (!ok) return { success: false, error: 'Super wholesale account not found.' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete super wholesale account.' };
    }
  }

  const customers = getServerCustomersSync();
  const index = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'SUPER_WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );
  if (index === -1) return { success: false, error: 'Super wholesale account not found.' };
  customers.splice(index, 1);
  saveLocalFileCustomers(customers);
  memoryCustomers = customers;
  return { success: true };
}

export async function authenticateCustomerServer(
  identifier: string,
  password: string
): Promise<Customer> {
  if (isDbConfigured()) {
    return await authenticateCustomerInDb(identifier, password);
  }

  // Fallback to memory / local file
  const normalized = (identifier || '').trim().toLowerCase();
  const rawPassword = (password || '').trim();

  if (!normalized || !rawPassword) {
    if (normalized.includes('@')) throw new Error('Invalid email address or password.');
    else throw new Error('Invalid shop name or password.');
  }

  const customers = getServerCustomersSync();
  const wholesaleMatch = customers.find(
    (c) =>
      (c.customerType === 'WHOLESALE' || c.customerType === 'SUPER_WHOLESALE') &&
      Boolean(c.shopName) &&
      c.shopName!.trim().toLowerCase() === normalized
  );

  if (wholesaleMatch) {
    if (wholesaleMatch.status && wholesaleMatch.status !== 'active') {
      throw new Error('Your account is deactivated. Please contact customer support.');
    }
    if (!wholesaleMatch.passwordHash || !wholesaleMatch.passwordSalt) {
      throw new Error('This account has no password set. Please contact administration.');
    }
    const isValid = verifyCustomerPassword(rawPassword, wholesaleMatch.passwordSalt, wholesaleMatch.passwordHash);
    if (!isValid) throw new Error('Invalid shop name or password.');
    return wholesaleMatch;
  }

  const retailMatch = customers.find(
    (c) =>
      c.customerType !== 'WHOLESALE' &&
      c.customerType !== 'SUPER_WHOLESALE' &&
      Boolean(c.email) &&
      c.email!.trim().toLowerCase() === normalized
  );

  if (retailMatch) {
    if (retailMatch.status && retailMatch.status !== 'active') {
      throw new Error('Your account is inactive or suspended. Please contact customer support.');
    }
    if (!retailMatch.passwordHash || !retailMatch.passwordSalt) {
      throw new Error('This account was created via guest checkout and has no password set. Please use "Create Account" or reset your password.');
    }
    const isValid = verifyCustomerPassword(rawPassword, retailMatch.passwordSalt, retailMatch.passwordHash);
    if (!isValid) throw new Error('Invalid email address or password.');
    return retailMatch;
  }

  if (normalized.includes('@')) throw new Error('Invalid email address or password.');
  else throw new Error('Invalid shop name or password.');
}

export async function registerCustomerServer(params: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: string;
}): Promise<Customer> {
  if (isDbConfigured()) {
    const created = await registerCustomerInDb(params);
    // Keep local file updated for safe rollback
    const all = getServerCustomersSync();
    saveLocalFileCustomers([created, ...all]);
    return created;
  }

  const fullName = (params.fullName || `${params.firstName || ''} ${params.lastName || ''}`).trim();
  if (!fullName) throw new Error('Full Name is required.');
  const email = params.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Please provide a valid email address.');
  const phone = params.phone?.trim();
  if (!phone) throw new Error('Phone number is required.');
  if (!params.password || params.password.length < 6) throw new Error('Password must be at least 6 characters long.');

  const parts = fullName.split(/\s+/);
  const firstName = params.firstName?.trim() || parts[0] || fullName;
  const lastName = params.lastName !== undefined ? params.lastName.trim() : (parts.slice(1).join(' ') || '');

  const customers = getServerCustomersSync();
  const existing = customers.find((c) => c.email && c.email.toLowerCase() === email);
  if (existing && existing.passwordHash) {
    throw new Error('An account with this email already exists. Please sign in.');
  }

  const salt = generateCustomerSalt(16);
  const passwordHash = hashCustomerPassword(params.password, salt);
  const customerId = existing?.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newCustomer: Customer = {
    id: customerId,
    customerType: 'RETAIL',
    fullName,
    firstName,
    lastName,
    email,
    phone,
    passwordHash,
    passwordSalt: salt,
    dateOfBirth: params.dateOfBirth?.trim() || existing?.dateOfBirth || '',
    status: 'active',
    totalOrders: existing?.totalOrders || 0,
    totalSpent: existing?.totalSpent || 0,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  const existingIndex = customers.findIndex((c) => c.id === customerId);
  if (existingIndex >= 0) {
    customers[existingIndex] = newCustomer;
  } else {
    customers.unshift(newCustomer);
  }

  saveLocalFileCustomers(customers);
  memoryCustomers = customers;
  return newCustomer;
}
