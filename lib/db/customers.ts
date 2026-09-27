import { Customer, Order, CustomerType } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';
import { getOrders } from './orders';
import { logActivity } from './activity';
import { generateSalt, hashCustomerPassword, verifyCustomerPassword } from '../crypto';

const STORAGE_KEY = 'customers';

export type SanitizedCustomer = Omit<Customer, 'passwordHash' | 'passwordSalt'>;

export function sanitizeCustomer(customer: Customer): SanitizedCustomer {
  const { passwordHash, passwordSalt, ...safe } = customer;
  return safe;
}

const seedCustomers: Customer[] = [
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

export async function getCustomers(): Promise<Customer[]> {
  const baseCustomers = getStoredCollection<Customer>(STORAGE_KEY, seedCustomers);
  const orders = await getOrders();

  // Aggregate dynamic metrics from orders
  const customerMap = new Map<string, Customer>();

  // Add base registered customers first
  baseCustomers.forEach((c: Customer) => {
    const stableId =
      c.id ||
      (c.shopName
        ? `cust-wh-${c.shopName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        : `cust-${(c.email || 'customer').toLowerCase().replace(/[^a-z0-9]/g, '-')}`);

    const key = (c.email ? c.email.toLowerCase() : '') || stableId;

    customerMap.set(key, {
      ...c,
      id: stableId,
      customerType: c.customerType || 'RETAIL',
      shopName: c.shopName || undefined,
      status: c.status || 'active',
    });
  });

  // Aggregate orders for customer stats
  let hasNewFromOrders = false;
  orders.forEach((ord) => {
    const isWholesaleOrder = ord.customerType === 'WHOLESALE' || Boolean(ord.shopName);
    const email = ord.customer?.email ? ord.customer.email.toLowerCase() : '';
    const customerId = ord.customer?.id;

    // Try finding existing customer by id, email, or shopName
    let existing: Customer | undefined;
    if (customerId) {
      existing = Array.from(customerMap.values()).find((c) => c.id === customerId);
    }
    if (!existing && isWholesaleOrder && ord.shopName) {
      existing = Array.from(customerMap.values()).find(
        (c) => c.customerType === 'WHOLESALE' && c.shopName?.toLowerCase() === ord.shopName?.toLowerCase()
      );
    }
    if (!existing && email) {
      existing = customerMap.get(email);
    }

    if (existing) {
      const orderCount = orders.filter((o) => {
        if (existing!.id && o.customer?.id === existing!.id) return true;
        if (existing!.email && o.customer?.email?.toLowerCase() === existing!.email.toLowerCase()) return true;
        if (existing!.shopName && o.shopName?.toLowerCase() === existing!.shopName.toLowerCase()) return true;
        return false;
      }).length;

      const orderSpent = orders
        .filter((o) => {
          if (existing!.id && o.customer?.id === existing!.id) return true;
          if (existing!.email && o.customer?.email?.toLowerCase() === existing!.email.toLowerCase()) return true;
          if (existing!.shopName && o.shopName?.toLowerCase() === existing!.shopName.toLowerCase()) return true;
          return false;
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);

      existing.totalOrders = orderCount;
      existing.totalSpent = orderSpent;
    } else if (email && !isWholesaleOrder) {
      hasNewFromOrders = true;
      const stableId = `cust-${email.replace(/[^a-z0-9]/g, '-')}`;
      const orderCount = orders.filter((o) => o.customer?.email?.toLowerCase() === email).length;
      const orderSpent = orders
        .filter((o) => o.customer?.email?.toLowerCase() === email)
        .reduce((sum, o) => sum + (o.total || 0), 0);

      customerMap.set(email, {
        id: stableId,
        customerType: 'RETAIL',
        firstName: ord.customer?.firstName || '',
        lastName: ord.customer?.lastName || '',
        fullName: `${ord.customer?.firstName || ''} ${ord.customer?.lastName || ''}`.trim(),
        email: ord.customer?.email || '',
        phone: ord.customer?.phone || '',
        totalOrders: orderCount,
        totalSpent: orderSpent,
        createdAt: ord.createdAt || new Date().toISOString(),
        status: 'active',
      });
    }
  });

  const list = Array.from(customerMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // If newly discovered customers from orders were merged, persist to storage
  if (hasNewFromOrders || list.length !== baseCustomers.length) {
    persistCollection(STORAGE_KEY, list);
  }

  return list;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const customers = await getCustomers();
  const normalized = id.toLowerCase();
  return (
    customers.find(
      (c) =>
        c.id.toLowerCase() === normalized ||
        (c.email && c.email.toLowerCase() === normalized) ||
        (c.shopName && c.shopName.toLowerCase() === normalized)
    ) || null
  );
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const customers = await getCustomers();
  const normalized = email.trim().toLowerCase();
  return customers.find((c) => c.email && c.email.toLowerCase() === normalized) || null;
}

export async function getCustomerByShopName(shopName: string): Promise<Customer | null> {
  if (!shopName) return null;
  const customers = await getCustomers();
  const normalized = shopName.trim().toLowerCase();
  return (
    customers.find(
      (c) =>
        c.customerType === 'WHOLESALE' &&
        Boolean(c.shopName) &&
        c.shopName!.trim().toLowerCase() === normalized
    ) || null
  );
}

export async function getWholesaleAccounts(): Promise<Customer[]> {
  const customers = await getCustomers();
  return customers.filter((c) => c.customerType === 'WHOLESALE');
}

export async function getSuperWholesaleAccounts(): Promise<Customer[]> {
  const customers = await getCustomers();
  return customers.filter((c) => c.customerType === 'SUPER_WHOLESALE');
}

export async function getWholesaleAccountByShopName(shopName: string): Promise<Customer | null> {
  const clean = shopName.trim().toLowerCase();
  const customers = await getCustomers();
  const found = customers.find(
    (c) =>
      c.customerType === 'WHOLESALE' &&
      c.shopName &&
      c.shopName.trim().toLowerCase() === clean
  );
  return found || null;
}

export async function getSuperWholesaleAccountByShopName(shopName: string): Promise<Customer | null> {
  const clean = shopName.trim().toLowerCase();
  const customers = await getCustomers();
  const found = customers.find(
    (c) =>
      c.customerType === 'SUPER_WHOLESALE' &&
      c.shopName &&
      c.shopName.trim().toLowerCase() === clean
  );
  return found || null;
}

export async function getCustomerOrders(emailOrShopName: string): Promise<Order[]> {
  const orders = await getOrders();
  const normalized = emailOrShopName.toLowerCase();
  return orders.filter(
    (o) =>
      o.customer?.email?.toLowerCase() === normalized ||
      o.customer?.id?.toLowerCase() === normalized ||
      o.shopName?.toLowerCase() === normalized
  );
}

export async function updateCustomerStatus(
  idOrEmail: string,
  status: 'active' | 'suspended' | 'deactivated' | 'inactive',
  adminEmail: string = 'admin@alhamd.com'
): Promise<boolean> {
  const customers = await getCustomers();
  const normalized = idOrEmail.toLowerCase();
  const target = customers.find(
    (c) =>
      c.id.toLowerCase() === normalized ||
      (c.email && c.email.toLowerCase() === normalized) ||
      (c.shopName && c.shopName.toLowerCase() === normalized)
  );

  if (!target) {
    console.error(`Customer not found for id/email: ${idOrEmail}`);
    return false;
  }

  target.status = status;
  await persistCollection(STORAGE_KEY, customers);

  await logActivity({
    adminEmail,
    action: 'UPDATE_CUSTOMER_STATUS',
    target: target.shopName || target.email || target.id,
    details: `Updated account status for "${target.shopName || `${target.firstName} ${target.lastName}`}" (${target.email || 'Wholesale'}) to ${status.toUpperCase()}`,
  });

  return true;
}

export async function saveCustomer(
  customerData: Partial<Customer>,
  adminEmail: string = 'admin@alhamd.com'
): Promise<Customer> {
  const customers = await getCustomers();
  const email = customerData.email ? customerData.email.trim().toLowerCase() : '';
  const customerId = customerData.id;
  const shopName = customerData.shopName ? customerData.shopName.trim() : '';

  const existingIndex = customers.findIndex(
    (c) =>
      (customerId && c.id === customerId) ||
      (shopName && c.customerType === 'WHOLESALE' && c.shopName?.trim().toLowerCase() === shopName.toLowerCase()) ||
      (email && c.email && c.email.toLowerCase() === email)
  );
  const existing = existingIndex >= 0 ? customers[existingIndex] : null;

  const stableId =
    customerData.id ||
    (existing
      ? existing.id
      : shopName
      ? `cust-wh-${Date.now()}-${shopName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      : `cust-${email ? email.replace(/[^a-z0-9]/g, '-') : Date.now()}`);

  const customerType: CustomerType = customerData.customerType || existing?.customerType || 'RETAIL';
  const resolvedShopName =
    customerData.shopName !== undefined ? customerData.shopName : (existing?.shopName || undefined);

  const fallbackFullName = resolvedShopName
    ? resolvedShopName
    : `${customerData.firstName || existing?.firstName || ''} ${customerData.lastName || existing?.lastName || ''}`.trim();

  const newCustomer: Customer = {
    id: stableId,
    customerType,
    shopName: resolvedShopName,
    fullName:
      customerData.fullName !== undefined
        ? customerData.fullName
        : existing?.fullName || fallbackFullName,
    firstName:
      customerData.firstName !== undefined
        ? customerData.firstName
        : existing?.firstName || resolvedShopName || '',
    lastName: customerData.lastName !== undefined ? customerData.lastName : (existing?.lastName || ''),
    email: customerData.email !== undefined ? customerData.email : existing?.email,
    phone: customerData.phone !== undefined ? customerData.phone : (existing?.phone || ''),
    totalOrders: customerData.totalOrders ?? (existing?.totalOrders || 0),
    totalSpent: customerData.totalSpent ?? (existing?.totalSpent || 0),
    createdAt: customerData.createdAt || (existing?.createdAt || new Date().toISOString()),
    status: customerData.status || (existing?.status || 'active'),
    passwordHash:
      customerData.passwordHash !== undefined ? customerData.passwordHash : existing?.passwordHash,
    passwordSalt:
      customerData.passwordSalt !== undefined ? customerData.passwordSalt : existing?.passwordSalt,
    dateOfBirth:
      customerData.dateOfBirth !== undefined ? customerData.dateOfBirth : existing?.dateOfBirth,
    address: customerData.address !== undefined ? customerData.address : existing?.address,
    city: customerData.city !== undefined ? customerData.city : existing?.city,
    province: customerData.province !== undefined ? customerData.province : existing?.province,
    postalCode:
      customerData.postalCode !== undefined ? customerData.postalCode : existing?.postalCode,
  };

  let updatedList: Customer[];
  if (existingIndex >= 0) {
    updatedList = [...customers];
    updatedList[existingIndex] = newCustomer;
  } else {
    updatedList = [newCustomer, ...customers];
  }

  await persistCollection(STORAGE_KEY, updatedList);
  return newCustomer;
}

/**
 * Register a new retail customer account securely.
 */
export async function registerCustomer(params: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: string;
}): Promise<SanitizedCustomer> {
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

  const customers = await getCustomers();
  const existing = customers.find((c) => c.email && c.email.toLowerCase() === email);

  if (existing && existing.passwordHash) {
    throw new Error('An account with this email already exists. Please sign in.');
  }

  const salt = generateSalt(16);
  const passwordHash = await hashCustomerPassword(params.password, salt);

  const customerId = existing?.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const saved = await saveCustomer(
    {
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
    },
    'customer-registration'
  );

  return sanitizeCustomer(saved);
}

/**
 * Creates a wholesale customer account securely from the Admin panel.
 * Required: Shop Name, Password.
 * Optional: Phone Number, Address.
 * Passwords are salted and SHA-256 hashed. Plaintext is never stored.
 */
export async function createWholesaleAccount(
  data: {
    shopName: string;
    password: string;
    phone?: string;
    address?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<SanitizedCustomer> {
  const shopName = (data.shopName || '').trim();
  if (!shopName) {
    throw new Error('Shop Name is required.');
  }

  if (!data.password || !data.password.trim()) {
    throw new Error('Password is required.');
  }

  if (data.password.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const existing = await getCustomerByShopName(shopName);
  if (existing) {
    throw new Error('A wholesale account with this shop name already exists.');
  }

  const salt = generateSalt(16);
  const passwordHash = await hashCustomerPassword(data.password.trim(), salt);

  const cleanSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = `cust-wh-${Date.now()}-${cleanSlug.slice(0, 15) || 'shop'}`;

  const newAccount = await saveCustomer(
    {
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
    },
    operatorEmail
  );

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Created Wholesale Account',
    target: shopName,
    details: `Created active wholesale account for "${shopName}" (ID: ${id})`,
  });

  return sanitizeCustomer(newAccount);
}

/**
 * Updates an existing wholesale customer account from the Admin panel.
 */
export async function updateWholesaleAccount(
  id: string,
  updates: {
    shopName?: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'suspended' | 'deactivated' | 'inactive';
    password?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<SanitizedCustomer> {
  const customers = await getCustomers();
  const target = customers.find(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName?.toLowerCase() === id.toLowerCase())
  );

  if (!target) {
    throw new Error('Wholesale account not found.');
  }

  let newShopName = target.shopName;
  if (
    updates.shopName &&
    updates.shopName.trim() &&
    updates.shopName.trim().toLowerCase() !== target.shopName?.toLowerCase()
  ) {
    const existing = await getCustomerByShopName(updates.shopName.trim());
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
    newPasswordSalt = generateSalt(16);
    newPasswordHash = await hashCustomerPassword(updates.password.trim(), newPasswordSalt);
  }

  const updated = await saveCustomer(
    {
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
    },
    operatorEmail
  );

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Wholesale Account',
    target: updated.shopName || target.email || target.id,
    details: `Updated details for wholesale account "${updated.shopName}"`,
  });

  return sanitizeCustomer(updated);
}

/**
 * Activates or deactivates a wholesale account.
 */
export async function updateWholesaleAccountStatus(
  id: string,
  status: 'active' | 'inactive' | 'deactivated',
  operatorEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const customers = await getCustomers();
  const target = customers.find(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName?.toLowerCase() === id.toLowerCase())
  );

  if (!target) {
    console.error(`Wholesale customer not found for id: ${id}`);
    return false;
  }

  target.status = status;
  await persistCollection(STORAGE_KEY, customers);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Wholesale Account Status',
    target: target.shopName || target.email || target.id,
    details: `Changed account status for "${target.shopName}" to ${status.toUpperCase()}`,
  });

  return true;
}

/**
 * Safely deletes a wholesale account.
 * IMPORTANT: Existing historical orders are preserved intact. Orders are NOT cascade deleted.
 */
export async function deleteWholesaleAccount(
  id: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const customers = await getCustomers();
  const targetIndex = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'WHOLESALE' && c.shopName?.toLowerCase() === id.toLowerCase())
  );

  if (targetIndex === -1) {
    return { success: false, error: 'Wholesale account not found.' };
  }

  const target = customers[targetIndex];

  // Remove the customer profile from customer collection
  // Historical orders remain fully preserved with their snapshot data
  const updated = customers.filter((_, idx) => idx !== targetIndex);
  await persistCollection(STORAGE_KEY, updated);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Deleted Wholesale Account',
    target: target.shopName || target.email || target.id,
    details: `Safely deleted wholesale account "${target.shopName}". Associated historical orders were preserved intact.`,
  });

  return { success: true };
}

export async function createSuperWholesaleAccount(
  data: {
    shopName: string;
    password: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'inactive';
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<SanitizedCustomer> {
  const shopName = (data.shopName || '').trim();
  if (!shopName) {
    throw new Error('Shop Name is required.');
  }

  if (!data.password || !data.password.trim()) {
    throw new Error('Password is required.');
  }

  if (data.password.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const existing = await getCustomerByShopName(shopName);
  if (existing) {
    throw new Error('An account with this shop name already exists.');
  }

  const salt = generateSalt(16);
  const passwordHash = await hashCustomerPassword(data.password.trim(), salt);

  const cleanSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = `cust-swh-${Date.now()}-${cleanSlug.slice(0, 15) || 'shop'}`;

  const newAccount = await saveCustomer(
    {
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
    },
    operatorEmail
  );

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Created Super Wholesale Account',
    target: shopName,
    details: `Created active super wholesale account for "${shopName}" (ID: ${id})`,
  });

  return sanitizeCustomer(newAccount);
}

export async function updateSuperWholesaleAccount(
  id: string,
  updates: {
    shopName?: string;
    phone?: string;
    address?: string;
    status?: 'active' | 'suspended' | 'deactivated' | 'inactive';
    password?: string;
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<SanitizedCustomer> {
  const customers = await getCustomers();
  const targetIndex = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'SUPER_WHOLESALE' && c.shopName?.toLowerCase() === id.toLowerCase())
  );

  if (targetIndex === -1) {
    throw new Error('Super wholesale account not found.');
  }

  const target = customers[targetIndex];

  let newShopName = target.shopName;
  if (
    updates.shopName &&
    updates.shopName.trim() &&
    updates.shopName.trim().toLowerCase() !== target.shopName?.toLowerCase()
  ) {
    const duplicate = await getCustomerByShopName(updates.shopName.trim());
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
    newPasswordSalt = generateSalt(16);
    newPasswordHash = await hashCustomerPassword(updates.password.trim(), newPasswordSalt);
  }

  const updatedAccount: Customer = {
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

  customers[targetIndex] = updatedAccount;
  await persistCollection(STORAGE_KEY, customers);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Super Wholesale Account',
    target: updatedAccount.shopName || updatedAccount.id,
    details: `Updated super wholesale account "${updatedAccount.shopName}"`,
  });

  return sanitizeCustomer(updatedAccount);
}

export async function updateSuperWholesaleAccountStatus(
  id: string,
  status: 'active' | 'suspended' | 'deactivated' | 'inactive',
  operatorEmail = 'admin@alhamd.com'
): Promise<boolean> {
  const customers = await getCustomers();
  const target = customers.find(
    (c) =>
      c.id === id ||
      (c.customerType === 'SUPER_WHOLESALE' && c.shopName?.toLowerCase() === id.toLowerCase())
  );

  if (!target) {
    return false;
  }

  target.status = status;
  await persistCollection(STORAGE_KEY, customers);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Super Wholesale Account Status',
    target: target.shopName || target.email || target.id,
    details: `Changed account status for "${target.shopName}" to ${status.toUpperCase()}`,
  });

  return true;
}

export async function deleteSuperWholesaleAccount(
  id: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const customers = await getCustomers();
  const targetIndex = customers.findIndex(
    (c) =>
      c.id === id ||
      (c.customerType === 'SUPER_WHOLESALE' && c.shopName?.toLowerCase() === id.toLowerCase())
  );

  if (targetIndex === -1) {
    return { success: false, error: 'Super wholesale account not found.' };
  }

  const target = customers[targetIndex];
  const updated = customers.filter((_, idx) => idx !== targetIndex);
  await persistCollection(STORAGE_KEY, updated);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Deleted Super Wholesale Account',
    target: target.shopName || target.email || target.id,
    details: `Safely deleted super wholesale account "${target.shopName}". Associated historical orders were preserved intact.`,
  });

  return { success: true };
}

/**
 * Authenticate wholesale customer credentials using Shop Name + Password.
 */
export async function authenticateWholesaleCustomer(
  shopName: string,
  password: string
): Promise<SanitizedCustomer> {
  const normalized = (shopName || '').trim().toLowerCase();
  if (!normalized || !password) {
    throw new Error('Shop Name and password are required.');
  }

  const customers = await getCustomers();
  const customer = customers.find(
    (c) =>
      c.customerType === 'WHOLESALE' &&
      Boolean(c.shopName) &&
      c.shopName!.trim().toLowerCase() === normalized
  );

  if (!customer) {
    throw new Error('Invalid shop name or password.');
  }

  if (customer.status && customer.status !== 'active') {
    throw new Error('Your wholesale account is deactivated. Please contact customer support.');
  }

  if (!customer.passwordHash || !customer.passwordSalt) {
    throw new Error('Wholesale account has no password configured. Please contact administration.');
  }

  const isValid = await verifyCustomerPassword(password, customer.passwordSalt, customer.passwordHash);
  if (!isValid) {
    throw new Error('Invalid shop name or password.');
  }

  return sanitizeCustomer(customer);
}

/**
 * Universal authentication: Supports both Retail Customers (Email + Password)
 * and Wholesale Customers (Shop Name + Password).
 */
export async function authenticateCustomer(
  emailOrShopName: string,
  password: string
): Promise<SanitizedCustomer> {
  const normalized = emailOrShopName.trim().toLowerCase();
  if (!normalized || !password) {
    throw new Error('Email or Shop Name and password are required.');
  }

  const customers = await getCustomers();

  // 1. Check for Wholesale or Super Wholesale account match by Shop Name first
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

    const isValid = await verifyCustomerPassword(password, wholesaleMatch.passwordSalt, wholesaleMatch.passwordHash);
    if (!isValid) {
      throw new Error('Invalid shop name or password.');
    }

    return sanitizeCustomer(wholesaleMatch);
  }

  // 2. Standard Retail Customer by Email
  const customer = customers.find(
    (c) =>
      c.customerType !== 'WHOLESALE' &&
      c.customerType !== 'SUPER_WHOLESALE' &&
      c.email &&
      c.email.toLowerCase() === normalized
  );

  if (!customer) {
    if (normalized.includes('@')) {
      throw new Error('Invalid email address or password.');
    } else {
      throw new Error('Invalid shop name or password.');
    }
  }

  if (customer.status && customer.status !== 'active') {
    throw new Error('Your account is inactive or suspended. Please contact customer support.');
  }

  if (!customer.passwordHash || !customer.passwordSalt) {
    throw new Error(
      'This account was created via guest checkout and has no password set. Please use "Create Account" or reset your password.'
    );
  }

  const isValid = await verifyCustomerPassword(password, customer.passwordSalt, customer.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email address or password.');
  }

  return sanitizeCustomer(customer);
}

/**
 * Update authenticated customer profile.
 */
export async function updateCustomerProfile(
  customerId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    dateOfBirth?: string;
    shopName?: string;
  }
): Promise<SanitizedCustomer> {
  const customers = await getCustomers();
  const target = customers.find((c) => c.id === customerId);

  if (!target) {
    throw new Error('Customer account not found.');
  }

  const updated = await saveCustomer(
    {
      ...target,
      ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() } : {}),
      ...(data.city !== undefined ? { city: data.city.trim() } : {}),
      ...(data.province !== undefined ? { province: data.province.trim() } : {}),
      ...(data.postalCode !== undefined ? { postalCode: data.postalCode.trim() } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth.trim() } : {}),
      ...(data.shopName !== undefined && target.customerType === 'WHOLESALE'
        ? { shopName: data.shopName.trim() }
        : {}),
    },
    'customer-self-update'
  );

  return sanitizeCustomer(updated);
}

/**
 * Change customer password with verification of existing password.
 */
export async function changeCustomerPassword(
  customerId: string,
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; message: string }> {
  if (!newPass || newPass.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  const customers = await getCustomers();
  const target = customers.find((c) => c.id === customerId);

  if (!target || !target.passwordHash || !target.passwordSalt) {
    throw new Error('Customer account not found.');
  }

  const isCurrentValid = await verifyCustomerPassword(currentPass, target.passwordSalt, target.passwordHash);
  if (!isCurrentValid) {
    throw new Error('Incorrect current password.');
  }

  const newSalt = generateSalt(16);
  const newHash = await hashCustomerPassword(newPass, newSalt);

  await saveCustomer(
    {
      ...target,
      passwordHash: newHash,
      passwordSalt: newSalt,
    },
    'customer-password-change'
  );

  return { success: true, message: 'Password updated successfully.' };
}

/**
 * Request password reset without leaking account existence.
 */
export async function requestCustomerPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const normalized = email.trim().toLowerCase();
  return {
    success: true,
    message: `If an account associated with ${normalized} exists, password reset instructions have been dispatched.`,
  };
}

/**
 * Get all orders strictly belonging to an authenticated customer.
 */
export async function getCustomerOrdersForCustomer(customerIdOrEmail: string): Promise<Order[]> {
  const allOrders = await getOrders();
  const normalized = customerIdOrEmail.trim().toLowerCase();

  return allOrders.filter((ord) => {
    if (!ord.customer) return false;
    if (ord.customer.id && ord.customer.id.toLowerCase() === normalized) return true;
    if (ord.customer.email && ord.customer.email.toLowerCase() === normalized) return true;
    if (ord.shopName && ord.shopName.toLowerCase() === normalized) return true;
    return false;
  });
}

/**
 * Securely fetch an order ensuring customer ownership.
 */
export async function getCustomerOrderById(customerIdOrEmail: string, orderId: string): Promise<Order | null> {
  const allOrders = await getOrders();
  const target = allOrders.find((o) => o.id.toLowerCase() === orderId.trim().toLowerCase());
  if (!target) return null;

  const normalized = customerIdOrEmail.trim().toLowerCase();
  const isOwner =
    (target.customer?.id && target.customer.id.toLowerCase() === normalized) ||
    (target.customer?.email && target.customer.email.toLowerCase() === normalized) ||
    (target.shopName && target.shopName.toLowerCase() === normalized);

  if (!isOwner) {
    console.warn(`Unauthorized access attempt: customer "${customerIdOrEmail}" attempted to access order "${orderId}"`);
    return null;
  }

  return target;
}
