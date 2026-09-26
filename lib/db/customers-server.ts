import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Customer, CustomerType } from '@/types/admin';

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

// In-memory cache for server-side operations
let memoryCustomers: Customer[] | null = null;

/**
 * Reads all customers from server persistent file (data/customers.json).
 * The JSON file is the authoritative single source of truth for the server.
 */
export function getServerCustomers(): Customer[] {
  try {
    if (fs.existsSync(CUSTOMERS_FILE)) {
      const content = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCustomers = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading customers.json:', err);
  }

  if (memoryCustomers && memoryCustomers.length > 0) {
    return memoryCustomers;
  }

  // Fallback only if database file does not exist or is empty
  const initial = [...INITIAL_CUSTOMERS];
  saveServerCustomers(initial);
  return initial;
}

/**
 * Saves all customers atomically to data/customers.json.
 */
export function saveServerCustomers(customers: Customer[]): void {
  memoryCustomers = customers;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing customers.json:', err);
  }
}

/**
 * Cryptographic customer password hashing (Web Crypto compatible SHA-256 with salt).
 */
export function hashCustomerPasswordServer(password: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${password}:${salt}:alhamd_customer_v1`)
    .digest('hex');
}

/**
 * Generates a random cryptographic salt.
 */
export function generateCustomerSaltServer(byteLength = 16): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Verifies a customer password against the stored salt and hash.
 */
export function verifyCustomerPasswordServer(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  if (!password || !salt || !expectedHash) return false;

  if (hashCustomerPasswordServer(password, salt) === expectedHash) return true;

  if (password.trim() !== password && hashCustomerPasswordServer(password.trim(), salt) === expectedHash) {
    return true;
  }

  return false;
}

/**
 * Look up wholesale accounts on the server.
 */
export function getServerWholesaleAccounts(): Customer[] {
  const all = getServerCustomers();
  return all.filter((c) => c.customerType === 'WHOLESALE');
}

/**
 * Look up customer by ID.
 */
export function getServerCustomerById(id: string): Customer | undefined {
  if (!id) return undefined;
  const all = getServerCustomers();
  return all.find(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );
}

/**
 * Look up wholesale account by Shop Name (case-insensitive, trimmed).
 */
export function getServerCustomerByShopName(shopName: string): Customer | undefined {
  if (!shopName) return undefined;
  const normalized = shopName.trim().toLowerCase();
  const all = getServerCustomers();
  return all.find(
    (c) =>
      c.customerType === 'WHOLESALE' &&
      Boolean(c.shopName) &&
      c.shopName!.trim().toLowerCase() === normalized
  );
}

/**
 * Look up retail customer by Email (case-insensitive, trimmed).
 */
export function getServerCustomerByEmail(email: string): Customer | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  const all = getServerCustomers();
  return all.find(
    (c) =>
      c.customerType !== 'WHOLESALE' &&
      Boolean(c.email) &&
      c.email!.trim().toLowerCase() === normalized
  );
}

/**
 * Creates a wholesale customer account securely on the server.
 * Required: Shop Name, Password.
 * Optional: Phone Number, Address.
 * Passwords are salted and SHA-256 hashed. Plaintext is never stored.
 */
export function createWholesaleAccountServer(
  data: {
    shopName: string;
    password: string;
    phone?: string;
    address?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Customer {
  const shopName = (data.shopName || '').trim();
  if (!shopName) {
    throw new Error('Shop Name is required.');
  }

  const rawPassword = (data.password || '').trim();
  if (!rawPassword) {
    throw new Error('Password is required.');
  }

  if (rawPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const existing = getServerCustomerByShopName(shopName);
  if (existing) {
    throw new Error('A wholesale account with this shop name already exists.');
  }

  const salt = generateCustomerSaltServer(16);
  const passwordHash = hashCustomerPasswordServer(rawPassword, salt);

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

  const customers = getServerCustomers();
  const updated = [newAccount, ...customers];
  saveServerCustomers(updated);

  return newAccount;
}

/**
 * Updates an existing wholesale customer account on the server.
 */
export function updateWholesaleAccountServer(
  id: string,
  updates: {
    shopName?: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'suspended' | 'deactivated' | 'inactive';
    password?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Customer {
  const customers = getServerCustomers();
  const index = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );

  if (index === -1) {
    throw new Error('Wholesale account not found.');
  }

  const target = customers[index];

  let newShopName = target.shopName;
  if (
    updates.shopName &&
    updates.shopName.trim() &&
    updates.shopName.trim().toLowerCase() !== target.shopName?.toLowerCase()
  ) {
    const existing = getServerCustomerByShopName(updates.shopName.trim());
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
    newPasswordSalt = generateCustomerSaltServer(16);
    newPasswordHash = hashCustomerPasswordServer(updates.password.trim(), newPasswordSalt);
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
  saveServerCustomers(customers);
  return updated;
}

/**
 * Activates or deactivates a wholesale account on the server.
 */
export function updateWholesaleAccountStatusServer(
  id: string,
  status: 'active' | 'inactive' | 'deactivated'
): boolean {
  const customers = getServerCustomers();
  const target = customers.find(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );

  if (!target) return false;
  target.status = status;
  saveServerCustomers(customers);
  return true;
}

/**
 * Safely deletes a wholesale account on the server.
 */
export function deleteWholesaleAccountServer(id: string): { success: boolean; error?: string } {
  const customers = getServerCustomers();
  const index = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName && c.shopName.toLowerCase() === id.toLowerCase())
  );

  if (index === -1) {
    return { success: false, error: 'Wholesale account not found.' };
  }

  customers.splice(index, 1);
  saveServerCustomers(customers);
  return { success: true };
}

/**
 * Authenticates either Retail Customer (Email + Password) or Wholesale Customer (Shop Name + Password)
 * on the server, enforcing exact error messages.
 */
export function authenticateCustomerServer(
  identifier: string,
  password: string
): Customer {
  const normalized = (identifier || '').trim().toLowerCase();
  const rawPassword = (password || '').trim();

  if (!normalized || !rawPassword) {
    if (normalized.includes('@')) {
      throw new Error('Invalid email address or password.');
    } else {
      throw new Error('Invalid shop name or password.');
    }
  }

  const customers = getServerCustomers();

  // 1. Check for Wholesale account match by Shop Name first
  const wholesaleMatch = customers.find(
    (c) =>
      c.customerType === 'WHOLESALE' &&
      Boolean(c.shopName) &&
      c.shopName!.trim().toLowerCase() === normalized
  );

  if (wholesaleMatch) {
    if (wholesaleMatch.status && wholesaleMatch.status !== 'active') {
      throw new Error('Your wholesale account is deactivated. Please contact customer support.');
    }

    if (!wholesaleMatch.passwordHash || !wholesaleMatch.passwordSalt) {
      throw new Error('This wholesale account has no password set. Please contact administration.');
    }

    const isValid = verifyCustomerPasswordServer(
      rawPassword,
      wholesaleMatch.passwordSalt,
      wholesaleMatch.passwordHash
    );

    if (!isValid) {
      throw new Error('Invalid shop name or password.');
    }

    return wholesaleMatch;
  }

  // 2. Check for Standard Retail Customer by Email
  const retailMatch = customers.find(
    (c) =>
      c.customerType !== 'WHOLESALE' &&
      Boolean(c.email) &&
      c.email!.trim().toLowerCase() === normalized
  );

  if (retailMatch) {
    if (retailMatch.status && retailMatch.status !== 'active') {
      throw new Error('Your account is inactive or suspended. Please contact customer support.');
    }

    if (!retailMatch.passwordHash || !retailMatch.passwordSalt) {
      throw new Error(
        'This account was created via guest checkout and has no password set. Please use "Create Account" or reset your password.'
      );
    }

    const isValid = verifyCustomerPasswordServer(
      rawPassword,
      retailMatch.passwordSalt,
      retailMatch.passwordHash
    );

    if (!isValid) {
      throw new Error('Invalid email address or password.');
    }

    return retailMatch;
  }

  // 3. No match found: return proper context-specific error message
  if (normalized.includes('@')) {
    throw new Error('Invalid email address or password.');
  } else {
    throw new Error('Invalid shop name or password.');
  }
}

/**
 * Register a new retail customer on the server.
 */
export function registerCustomerServer(params: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: string;
}): Customer {
  const fullName = (params.fullName || `${params.firstName || ''} ${params.lastName || ''}`).trim();
  if (!fullName) {
    throw new Error('Full Name is required.');
  }

  const email = params.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  const phone = params.phone?.trim();
  if (!phone) {
    throw new Error('Phone number is required.');
  }

  if (!params.password || params.password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const parts = fullName.split(/\s+/);
  const firstName = params.firstName?.trim() || parts[0] || fullName;
  const lastName = params.lastName !== undefined ? params.lastName.trim() : (parts.slice(1).join(' ') || '');

  const customers = getServerCustomers();
  const existing = customers.find((c) => c.email && c.email.toLowerCase() === email);

  if (existing && existing.passwordHash) {
    throw new Error('An account with this email already exists. Please sign in.');
  }

  const salt = generateCustomerSaltServer(16);
  const passwordHash = hashCustomerPasswordServer(params.password, salt);

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

  saveServerCustomers(customers);
  return newCustomer;
}
