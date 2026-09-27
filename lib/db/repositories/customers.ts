import { query, execute, isDbConfigured } from '../mysql';
import { Customer, CustomerType } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';
import crypto from 'crypto';

interface CustomerRow extends RowDataPacket {
  id: string;
  customer_type: CustomerType;
  shop_name: string | null;
  full_name: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string;
  password_hash: string | null;
  password_salt: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  total_orders: number;
  total_spent: number | string;
  status: 'active' | 'suspended' | 'deactivated' | 'inactive';
  created_at: string;
  updated_at: string;
}

export type SanitizedCustomer = Omit<Customer, 'passwordHash' | 'passwordSalt'>;

export function sanitizeCustomer(customer: Customer): SanitizedCustomer {
  const { passwordHash, passwordSalt, ...safe } = customer;
  return safe;
}

export function hashCustomerPassword(password: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${password}:${salt}:alhamd_customer_v1`)
    .digest('hex');
}

export function generateCustomerSalt(byteLength = 16): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export function verifyCustomerPassword(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  if (!password || !salt || !expectedHash) return false;
  if (hashCustomerPassword(password, salt) === expectedHash) return true;
  if (password.trim() !== password && hashCustomerPassword(password.trim(), salt) === expectedHash) {
    return true;
  }
  return false;
}

function mapRowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    customerType: row.customer_type,
    shopName: row.shop_name || undefined,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name || '',
    email: row.email || undefined,
    phone: row.phone,
    passwordHash: row.password_hash || undefined,
    passwordSalt: row.password_salt || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    province: row.province || undefined,
    postalCode: row.postal_code || undefined,
    dateOfBirth: row.date_of_birth || undefined,
    totalOrders: Number(row.total_orders),
    totalSpent: Number(row.total_spent),
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getAllCustomersFromDb(type?: CustomerType): Promise<Customer[]> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  let sql = 'SELECT * FROM customers';
  const params: any[] = [];

  if (type) {
    sql += ' WHERE customer_type = ?';
    params.push(type);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = await query<CustomerRow[]>(sql, params);
  return rows.map(mapRowToCustomer);
}

export async function getCustomerByIdFromDb(id: string): Promise<Customer | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const rows = await query<CustomerRow[]>(
    'SELECT * FROM customers WHERE id = ? OR (customer_type IN ("WHOLESALE", "SUPER_WHOLESALE") AND LOWER(shop_name) = LOWER(?)) LIMIT 1',
    [id, id]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToCustomer(rows[0]);
}

export async function getCustomerByEmailFromDb(email: string): Promise<Customer | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const normalized = email.trim().toLowerCase();
  const rows = await query<CustomerRow[]>(
    'SELECT * FROM customers WHERE LOWER(email) = ? AND customer_type NOT IN ("WHOLESALE", "SUPER_WHOLESALE") LIMIT 1',
    [normalized]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToCustomer(rows[0]);
}

export async function getCustomerByShopNameFromDb(shopName: string): Promise<Customer | null> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const normalized = shopName.trim().toLowerCase();
  const rows = await query<CustomerRow[]>(
    'SELECT * FROM customers WHERE LOWER(shop_name) = ? AND customer_type IN ("WHOLESALE", "SUPER_WHOLESALE") LIMIT 1',
    [normalized]
  );

  if (!rows || rows.length === 0) return null;
  return mapRowToCustomer(rows[0]);
}

export async function createWholesaleAccountInDb(data: {
  shopName: string;
  password: string;
  phone?: string;
  address?: string;
}): Promise<Customer> {
  const shopName = (data.shopName || '').trim();
  if (!shopName) {
    throw new Error('Shop Name is required.');
  }

  const rawPassword = (data.password || '').trim();
  if (!rawPassword || rawPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const existing = await getCustomerByShopNameFromDb(shopName);
  if (existing) {
    throw new Error('A wholesale account with this shop name already exists.');
  }

  const salt = generateCustomerSalt(16);
  const passwordHash = hashCustomerPassword(rawPassword, salt);
  const cleanSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = `cust-wh-${Date.now()}-${cleanSlug.slice(0, 15) || 'shop'}`;

  await execute(
    `INSERT INTO customers (
      id, customer_type, shop_name, full_name, first_name, last_name,
      phone, password_hash, password_salt, address, status, total_orders, total_spent
    ) VALUES (?, 'WHOLESALE', ?, ?, ?, '', ?, ?, ?, ?, 'active', 0, 0.00)`,
    [
      id,
      shopName,
      shopName,
      shopName,
      (data.phone || '').trim(),
      passwordHash,
      salt,
      (data.address || '').trim(),
    ]
  );

  return (await getCustomerByIdFromDb(id))!;
}

export async function createSuperWholesaleAccountInDb(data: {
  shopName: string;
  password: string;
  phone?: string;
  address?: string;
  status?: 'active' | 'inactive';
}): Promise<Customer> {
  const shopName = (data.shopName || '').trim();
  if (!shopName) {
    throw new Error('Shop Name is required.');
  }

  const rawPassword = (data.password || '').trim();
  if (!rawPassword || rawPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const existing = await getCustomerByShopNameFromDb(shopName);
  if (existing) {
    throw new Error('An account with this shop name already exists.');
  }

  const salt = generateCustomerSalt(16);
  const passwordHash = hashCustomerPassword(rawPassword, salt);
  const cleanSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = `cust-swh-${Date.now()}-${cleanSlug.slice(0, 15) || 'shop'}`;
  const initialStatus = data.status === 'inactive' ? 'inactive' : 'active';

  await execute(
    `INSERT INTO customers (
      id, customer_type, shop_name, full_name, first_name, last_name,
      phone, password_hash, password_salt, address, status, total_orders, total_spent
    ) VALUES (?, 'SUPER_WHOLESALE', ?, ?, ?, '', ?, ?, ?, ?, ?, 0, 0.00)`,
    [
      id,
      shopName,
      shopName,
      shopName,
      (data.phone || '').trim(),
      passwordHash,
      salt,
      (data.address || '').trim(),
      initialStatus,
    ]
  );

  return (await getCustomerByIdFromDb(id))!;
}

export async function updateWholesaleAccountInDb(
  id: string,
  updates: {
    shopName?: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'suspended' | 'deactivated' | 'inactive';
    password?: string;
  }
): Promise<Customer> {
  const existing = await getCustomerByIdFromDb(id);
  if (!existing) {
    throw new Error('Wholesale account not found.');
  }

  let newShopName = existing.shopName;
  if (
    updates.shopName &&
    updates.shopName.trim() &&
    updates.shopName.trim().toLowerCase() !== existing.shopName?.toLowerCase()
  ) {
    const duplicate = await getCustomerByShopNameFromDb(updates.shopName.trim());
    if (duplicate && duplicate.id !== existing.id) {
      throw new Error(`A wholesale account for "${updates.shopName.trim()}" already exists.`);
    }
    newShopName = updates.shopName.trim();
  }

  let newPasswordHash = existing.passwordHash;
  let newPasswordSalt = existing.passwordSalt;
  if (updates.password && updates.password.trim()) {
    if (updates.password.trim().length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }
    newPasswordSalt = generateCustomerSalt(16);
    newPasswordHash = hashCustomerPassword(updates.password.trim(), newPasswordSalt);
  }

  const fullName = newShopName || existing.fullName;
  const firstName = newShopName || existing.firstName;
  const phone = updates.phone !== undefined ? updates.phone.trim() : existing.phone;
  const address = updates.address !== undefined ? updates.address.trim() : existing.address;
  const status = updates.status || existing.status || 'active';

  await execute(
    `UPDATE customers SET
      shop_name = ?, full_name = ?, first_name = ?, phone = ?, address = ?, status = ?,
      password_hash = ?, password_salt = ?
     WHERE id = ?`,
    [
      newShopName,
      fullName,
      firstName,
      phone,
      address,
      status,
      newPasswordHash || null,
      newPasswordSalt || null,
      id,
    ]
  );

  return (await getCustomerByIdFromDb(id))!;
}

export async function registerCustomerInDb(params: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: string;
}): Promise<Customer> {
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

  const existing = await getCustomerByEmailFromDb(email);
  if (existing && existing.passwordHash) {
    throw new Error('An account with this email already exists. Please sign in.');
  }

  const salt = generateCustomerSalt(16);
  const passwordHash = hashCustomerPassword(params.password, salt);
  const customerId = existing?.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  if (existing) {
    await execute(
      `UPDATE customers SET
        full_name = ?, first_name = ?, last_name = ?, phone = ?,
        password_hash = ?, password_salt = ?, date_of_birth = ?, status = 'active'
       WHERE id = ?`,
      [fullName, firstName, lastName, phone, passwordHash, salt, params.dateOfBirth?.trim() || null, customerId]
    );
  } else {
    await execute(
      `INSERT INTO customers (
        id, customer_type, full_name, first_name, last_name, email, phone,
        password_hash, password_salt, date_of_birth, status, total_orders, total_spent
      ) VALUES (?, 'RETAIL', ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0.00)`,
      [
        customerId,
        fullName,
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
        salt,
        params.dateOfBirth?.trim() || null,
      ]
    );
  }

  return (await getCustomerByIdFromDb(customerId))!;
}

export async function authenticateCustomerInDb(
  identifier: string,
  password: string
): Promise<Customer> {
  const normalized = (identifier || '').trim().toLowerCase();
  const rawPassword = (password || '').trim();

  if (!normalized || !rawPassword) {
    if (normalized.includes('@')) {
      throw new Error('Invalid email address or password.');
    } else {
      throw new Error('Invalid shop name or password.');
    }
  }

  // 1. Check Wholesale account match by Shop Name first
  const wholesaleMatch = await getCustomerByShopNameFromDb(normalized);
  if (wholesaleMatch) {
    if (wholesaleMatch.status && wholesaleMatch.status !== 'active') {
      throw new Error('Your wholesale account is deactivated. Please contact customer support.');
    }

    if (!wholesaleMatch.passwordHash || !wholesaleMatch.passwordSalt) {
      throw new Error('This wholesale account has no password set. Please contact administration.');
    }

    const isValid = verifyCustomerPassword(
      rawPassword,
      wholesaleMatch.passwordSalt,
      wholesaleMatch.passwordHash
    );

    if (!isValid) {
      throw new Error('Invalid shop name or password.');
    }

    return wholesaleMatch;
  }

  // 2. Check Standard Retail Customer by Email
  const retailMatch = await getCustomerByEmailFromDb(normalized);
  if (retailMatch) {
    if (retailMatch.status && retailMatch.status !== 'active') {
      throw new Error('Your account is inactive or suspended. Please contact customer support.');
    }

    if (!retailMatch.passwordHash || !retailMatch.passwordSalt) {
      throw new Error(
        'This account was created via guest checkout and has no password set. Please use "Create Account" or reset your password.'
      );
    }

    const isValid = verifyCustomerPassword(
      rawPassword,
      retailMatch.passwordSalt,
      retailMatch.passwordHash
    );

    if (!isValid) {
      throw new Error('Invalid email address or password.');
    }

    return retailMatch;
  }

  if (normalized.includes('@')) {
    throw new Error('Invalid email address or password.');
  } else {
    throw new Error('Invalid shop name or password.');
  }
}

export async function deleteCustomerInDb(id: string): Promise<boolean> {
  const existing = await getCustomerByIdFromDb(id);
  if (!existing) return false;

  await execute('DELETE FROM customers WHERE id = ?', [id]);
  return true;
}
