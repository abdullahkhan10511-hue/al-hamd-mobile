import { PromoCode, PromoCodeUsage } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';
import { getOrders } from './orders';
import { getProducts } from './products';
import { logActivity } from './activity';

const PROMO_CODES_KEY = 'promo_codes';
const PROMO_USAGES_KEY = 'promo_code_usages';

export const seedPromoCodes: PromoCode[] = [];

export function getPromoCodes(): PromoCode[] {
  const list = getStoredCollection<PromoCode>(PROMO_CODES_KEY, seedPromoCodes);
  // Sanitize any legacy hardcoded demo promo codes (e.g. ABDULLAH)
  const cleaned = list.filter((p) => p.code?.toUpperCase() !== 'ABDULLAH' && p.id !== 'promo-abdullah');
  if (cleaned.length !== list.length) {
    persistCollection(PROMO_CODES_KEY, cleaned).catch(() => {});
  }
  return cleaned;
}

export function getPromoCodeById(id: string): PromoCode | undefined {
  return getPromoCodes().find((p) => p.id === id);
}

export function getPromoCodeByCode(code: string): PromoCode | undefined {
  if (!code) return undefined;
  const clean = code.trim().toUpperCase();
  return getPromoCodes().find((p) => p.code.toUpperCase() === clean);
}

export async function savePromoCodes(promos: PromoCode[]): Promise<void> {
  await persistCollection(PROMO_CODES_KEY, promos);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: PROMO_CODES_KEY, value: promos },
      })
    );
  }
}

export async function createPromoCode(
  data: Omit<PromoCode, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>,
  operatorEmail = 'admin@alhamd-mobile.com'
): Promise<{ success: boolean; promo?: PromoCode; error?: string }> {
  const promos = getPromoCodes();
  const cleanCode = (data.code || '').trim().toUpperCase();

  if (!cleanCode) {
    return { success: false, error: 'Promo code string is required.' };
  }

  if (promos.some((p) => p.code.toUpperCase() === cleanCode)) {
    return { success: false, error: `Promo code "${cleanCode}" already exists.` };
  }

  const discountVal = Number(data.discountValue) || 0;
  if (discountVal <= 0) {
    return { success: false, error: 'Discount value must be greater than 0.' };
  }

  if (data.discountType === 'percentage' && discountVal > 100) {
    return { success: false, error: 'Percentage discount cannot exceed 100%.' };
  }

  const nowIso = new Date().toISOString();
  const newPromo: PromoCode = {
    id: `promo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    code: cleanCode,
    description: data.description?.trim() || '',
    discountType: data.discountType || 'percentage',
    discountValue: discountVal,
    maximumDiscount: data.maximumDiscount ? Number(data.maximumDiscount) : null,
    minimumOrderAmount: Math.max(0, Number(data.minimumOrderAmount) || 0),
    startDate: data.startDate || undefined,
    expiryDate: data.expiryDate || undefined,
    usageLimit: data.usageLimit ? Math.max(1, Number(data.usageLimit)) : null,
    perCustomerLimit: data.perCustomerLimit ? Math.max(1, Number(data.perCustomerLimit)) : null,
    isActive: data.isActive ?? true,
    applicableType: data.applicableType || 'all',
    applicableProducts: data.applicableProducts || [],
    applicableCategories: data.applicableCategories || [],
    customerRestrictions: data.customerRestrictions || 'all',
    specificCustomerEmails: data.specificCustomerEmails || [],
    posAllowed: data.posAllowed ?? true,
    onlineAllowed: data.onlineAllowed ?? true,
    usedCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const updated = [newPromo, ...promos];
  await savePromoCodes(updated);



  await logActivity({
    adminEmail: operatorEmail,
    action: 'Created Promo Code',
    target: newPromo.code,
    details: `Discount: ${newPromo.discountValue}${newPromo.discountType === 'percentage' ? '%' : ' PKR'} | Min Order: Rs. ${newPromo.minimumOrderAmount}`,
  });

  return { success: true, promo: newPromo };
}

export async function updatePromoCode(
  id: string,
  updates: Partial<Omit<PromoCode, 'id' | 'usedCount' | 'createdAt'>>,
  operatorEmail = 'admin@alhamd-mobile.com'
): Promise<{ success: boolean; promo?: PromoCode; error?: string }> {
  const promos = getPromoCodes();
  const index = promos.findIndex((p) => p.id === id);

  if (index === -1) {
    return { success: false, error: 'Promo code not found.' };
  }

  const current = promos[index];

  if (updates.code) {
    const cleanCode = updates.code.trim().toUpperCase();
    if (promos.some((p) => p.id !== id && p.code.toUpperCase() === cleanCode)) {
      return { success: false, error: `Promo code "${cleanCode}" is already in use.` };
    }
    updates.code = cleanCode;
  }

  const updatedPromo: PromoCode = {
    ...current,
    ...updates,
    discountValue: updates.discountValue !== undefined ? Number(updates.discountValue) : current.discountValue,
    minimumOrderAmount: updates.minimumOrderAmount !== undefined ? Math.max(0, Number(updates.minimumOrderAmount)) : current.minimumOrderAmount,
    updatedAt: new Date().toISOString(),
  };

  promos[index] = updatedPromo;
  await savePromoCodes(promos);



  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Promo Code',
    target: updatedPromo.code,
    details: `Updated attributes: ${Object.keys(updates).join(', ')}`,
  });

  return { success: true, promo: updatedPromo };
}

export async function togglePromoCodeStatus(
  id: string,
  operatorEmail = 'admin@alhamd-mobile.com'
): Promise<{ success: boolean; promo?: PromoCode; error?: string }> {
  const promos = getPromoCodes();
  const index = promos.findIndex((p) => p.id === id);

  if (index === -1) {
    return { success: false, error: 'Promo code not found.' };
  }

  const current = promos[index];
  const newStatus = !current.isActive;

  promos[index] = {
    ...current,
    isActive: newStatus,
    updatedAt: new Date().toISOString(),
  };

  await savePromoCodes(promos);

  await logActivity({
    adminEmail: operatorEmail,
    action: newStatus ? 'Activated Promo Code' : 'Deactivated Promo Code',
    target: current.code,
    details: `Status changed to: ${newStatus ? 'Active' : 'Inactive'}`,
  });

  return { success: true, promo: promos[index] };
}

export async function deletePromoCode(
  id: string,
  operatorEmail = 'admin@alhamd-mobile.com'
): Promise<{ success: boolean; error?: string }> {
  const promos = getPromoCodes();
  const target = promos.find((p) => p.id === id);

  if (!target) {
    return { success: false, error: 'Promo code not found.' };
  }

  const remaining = promos.filter((p) => p.id !== id);
  await savePromoCodes(remaining);



  await logActivity({
    adminEmail: operatorEmail,
    action: 'Deleted Promo Code',
    target: target.code,
    details: `Removed code with historical usage count: ${target.usedCount}`,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// USAGE HISTORY
// ---------------------------------------------------------------------------

export function getPromoCodeUsages(filter?: {
  promoCodeId?: string;
  code?: string;
  customerEmail?: string;
  customerPhone?: string;
  channel?: 'ONLINE' | 'POS';
}): PromoCodeUsage[] {
  const usages = getStoredCollection<PromoCodeUsage>(PROMO_USAGES_KEY, []);

  if (!filter) return usages;

  return usages.filter((u) => {
    if (filter.promoCodeId && u.promoCodeId !== filter.promoCodeId) return false;
    if (filter.code && u.code.toUpperCase() !== filter.code.toUpperCase()) return false;
    if (filter.customerEmail && u.customerEmail && u.customerEmail.toLowerCase() !== filter.customerEmail.toLowerCase()) return false;
    if (filter.customerPhone && u.customerPhone && normalizePhone(u.customerPhone) !== normalizePhone(filter.customerPhone)) return false;
    if (filter.channel && u.channel !== filter.channel) return false;
    return true;
  });
}

export async function recordPromoUsage(
  data: Omit<PromoCodeUsage, 'id' | 'createdAt'>
): Promise<PromoCodeUsage> {
  const usages = getStoredCollection<PromoCodeUsage>(PROMO_USAGES_KEY, []);
  const nowIso = new Date().toISOString();

  const newUsage: PromoCodeUsage = {
    id: `usage-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...data,
    code: data.code.trim().toUpperCase(),
    createdAt: nowIso,
  };

  const updatedUsages = [newUsage, ...usages];
  await persistCollection(PROMO_USAGES_KEY, updatedUsages);



  // Increment usedCount on PromoCode
  const promos = getPromoCodes();
  const promoIndex = promos.findIndex((p) => p.code.toUpperCase() === newUsage.code.toUpperCase());
  if (promoIndex !== -1) {
    promos[promoIndex] = {
      ...promos[promoIndex],
      usedCount: (promos[promoIndex].usedCount || 0) + 1,
      updatedAt: nowIso,
    };
    await savePromoCodes(promos);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: PROMO_USAGES_KEY, value: updatedUsages },
      })
    );
  }

  return newUsage;
}

function normalizePhone(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

// ---------------------------------------------------------------------------
// VALIDATION & CALCULATION ENGINE
// ---------------------------------------------------------------------------

export interface ValidatePromoItemInput {
  productId: string;
  quantity: number;
  price?: number;
  category?: string;
  categorySlug?: string;
}

export interface ValidatePromoCustomerInput {
  id?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface ValidatePromoParams {
  code: string;
  subtotal: number;
  items?: ValidatePromoItemInput[];
  channel: 'ONLINE' | 'POS';
  customer?: ValidatePromoCustomerInput;
}

export interface PromoValidationResult {
  valid: boolean;
  error?: string;
  promoCode?: PromoCode;
  code?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  eligibleSubtotal?: number;
  subtotal?: number;
  grandTotal?: number;
  description?: string;
}

/**
 * Validates promo code and calculates discount strictly on server.
 */
export async function validatePromoCode(
  params: ValidatePromoParams,
  promoOverride?: PromoCode
): Promise<PromoValidationResult> {
  const cleanCode = (params.code || '').trim().toUpperCase();

  if (!cleanCode) {
    return { valid: false, error: 'Please enter a promo code.' };
  }

  const promo = promoOverride || getPromoCodeByCode(cleanCode);
  if (!promo) {
    return { valid: false, error: 'Invalid promo code.' };
  }

  // 1. Check Active Status
  if (!promo.isActive) {
    return { valid: false, error: 'Promo code is not active.' };
  }

  // 2. Check Start Date
  const now = new Date();
  if (promo.startDate) {
    const start = new Date(promo.startDate);
    if (now < start) {
      return { valid: false, error: 'Promo code is not active.' };
    }
  }

  // 3. Check Expiry Date
  if (promo.expiryDate) {
    const expiry = new Date(promo.expiryDate);
    if (promo.expiryDate.length === 10) {
      expiry.setHours(23, 59, 59, 999);
    }
    if (now > expiry) {
      return { valid: false, error: 'Promo code has expired.' };
    }
  }

  // 4. Check Global Usage Limit
  if (promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usageLimit > 0) {
    if ((promo.usedCount || 0) >= promo.usageLimit) {
      return { valid: false, error: 'This promo code has reached its usage limit.' };
    }
  }

  // 5. Check Channel Allowed
  if (params.channel === 'ONLINE' && !promo.onlineAllowed) {
    return { valid: false, error: 'This promo code is not available for this checkout type.' };
  }
  if (params.channel === 'POS' && !promo.posAllowed) {
    return { valid: false, error: 'This promo code is not available for this checkout type.' };
  }

  // 6. Check Minimum Order Amount
  const inputSubtotal = Math.max(0, Number(params.subtotal) || 0);
  if (promo.minimumOrderAmount && promo.minimumOrderAmount > 0) {
    if (inputSubtotal < promo.minimumOrderAmount) {
      return {
        valid: false,
        error: `Minimum order amount is Rs. ${promo.minimumOrderAmount.toLocaleString('en-PK')}.`,
      };
    }
  }

  // 7. Check Customer Restrictions & Per-Customer Usage Limits
  const existingOrders = getOrders();
  const pastUsages = getPromoCodeUsages({ code: promo.code });

  const custId = params.customer?.id?.trim();
  const custEmail = params.customer?.email?.trim().toLowerCase();
  const custPhone = normalizePhone(params.customer?.phone);

  // Check New vs Existing Customer rules
  if (promo.customerRestrictions && promo.customerRestrictions !== 'all') {
    let pastOrderCount = 0;

    if (custId || custEmail || custPhone) {
      pastOrderCount = existingOrders.filter((o) => {
        if (o.status === 'Cancelled') return false;
        if (custId && o.customer?.id === custId) return true;
        if (custEmail && o.customer?.email && o.customer.email.toLowerCase() === custEmail) return true;
        if (custPhone && o.customer?.phone && normalizePhone(o.customer.phone) === custPhone) return true;
        return false;
      }).length;
    }

    if (promo.customerRestrictions === 'new' && pastOrderCount > 0) {
      return { valid: false, error: 'This promo code is only valid for first-time customers.' };
    }

    if (promo.customerRestrictions === 'existing' && pastOrderCount === 0) {
      return { valid: false, error: 'This promo code is only valid for existing customers.' };
    }

    if (promo.customerRestrictions === 'specific') {
      const allowedEmails = (promo.specificCustomerEmails || []).map((e) => e.toLowerCase());
      if (!custEmail || !allowedEmails.includes(custEmail)) {
        return { valid: false, error: 'This promo code is not available for this account.' };
      }
    }
  }

  // Check Per Customer Usage Limit
  if (promo.perCustomerLimit && promo.perCustomerLimit > 0) {
    let customerUsageCount = 0;

    if (custId || custEmail || custPhone) {
      customerUsageCount = pastUsages.filter((u) => {
        if (custId && u.customerId === custId) return true;
        if (custEmail && u.customerEmail && u.customerEmail.toLowerCase() === custEmail) return true;
        if (custPhone && u.customerPhone && normalizePhone(u.customerPhone) === custPhone) return true;
        return false;
      }).length;
    }

    if (customerUsageCount >= promo.perCustomerLimit) {
      return {
        valid: false,
        error: 'You have already used this promo code the maximum number of times.',
      };
    }
  }

  // 8. Product / Category Restrictions & Eligible Subtotal
  let eligibleSubtotal = inputSubtotal;

  if (params.items && params.items.length > 0 && promo.applicableType !== 'all') {
    const productsCatalog = getProducts();
    let eligibleSum = 0;
    let matchedAny = false;

    for (const item of params.items) {
      const prod = productsCatalog.find((p) => p.id === item.productId);
      const catSlug = (item.categorySlug || prod?.categorySlug || prod?.category || '').toLowerCase();
      const itemPrice = item.price !== undefined ? item.price : (prod?.price || 0);
      const lineTotal = itemPrice * item.quantity;

      let isEligible = false;

      if (promo.applicableType === 'products' && promo.applicableProducts && promo.applicableProducts.length > 0) {
        if (promo.applicableProducts.includes(item.productId)) {
          isEligible = true;
        }
      } else if (promo.applicableType === 'categories' && promo.applicableCategories && promo.applicableCategories.length > 0) {
        const targetCats = promo.applicableCategories.map((c) => c.toLowerCase());
        if (targetCats.some((tc) => catSlug.includes(tc) || tc.includes(catSlug))) {
          isEligible = true;
        }
      }

      if (isEligible) {
        eligibleSum += lineTotal;
        matchedAny = true;
      }
    }

    if (!matchedAny || eligibleSum <= 0) {
      return {
        valid: false,
        error: 'This promo code is not applicable to these products.',
      };
    }

    eligibleSubtotal = eligibleSum;
  }

  // 9. Calculate Discount Amount
  let discountAmount = 0;
  if (promo.discountType === 'percentage') {
    const pct = Math.min(100, Math.max(0, promo.discountValue));
    discountAmount = Math.round((eligibleSubtotal * pct) / 100);

    // Apply optional maximum discount cap
    if (promo.maximumDiscount !== null && promo.maximumDiscount !== undefined && promo.maximumDiscount > 0) {
      discountAmount = Math.min(discountAmount, promo.maximumDiscount);
    }
  } else {
    // Fixed amount discount
    discountAmount = Math.min(eligibleSubtotal, Math.round(promo.discountValue));
  }

  const grandTotal = Math.max(0, inputSubtotal - discountAmount);

  return {
    valid: true,
    promoCode: promo,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountAmount,
    eligibleSubtotal,
    subtotal: inputSubtotal,
    grandTotal,
    description: promo.description,
  };
}
