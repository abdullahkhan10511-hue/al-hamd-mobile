import { z } from 'zod';

// =============================================================================
// ZOD SCHEMAS & DEFAULT VALUES
// =============================================================================

export const MarqueeSectionSettingsSchema = z.object({
  style: z.enum(['continuous', 'step', 'static']).default('continuous'),
  direction: z.enum(['ltr', 'rtl']).default('rtl'),
  speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
  speedSeconds: z.coerce.number().min(15).max(120).default(35),
  stepSeconds: z.coerce.number().min(1.5).max(6).default(2.5),
  pauseOnHover: z.boolean().default(true),
  edgeFade: z.boolean().default(true),
  cardHover: z.enum(['tilt', 'lift', 'none']).default('tilt'),
});

export type MarqueeSectionSettings = z.infer<typeof MarqueeSectionSettingsSchema>;

export const DEFAULT_CATEGORIES_ANIMATION: MarqueeSectionSettings = {
  style: 'continuous',
  direction: 'rtl',
  speed: 'normal',
  speedSeconds: 35,
  stepSeconds: 2.5,
  pauseOnHover: true,
  edgeFade: true,
  cardHover: 'tilt',
};

export const DEFAULT_BRANDS_ANIMATION: MarqueeSectionSettings = {
  style: 'continuous',
  direction: 'ltr',
  speed: 'normal',
  speedSeconds: 25,
  stepSeconds: 2.5,
  pauseOnHover: true,
  edgeFade: true,
  cardHover: 'tilt',
};

export const HomepageAnimationsSettingsSchema = z.object({
  categories: MarqueeSectionSettingsSchema.default(DEFAULT_CATEGORIES_ANIMATION),
  brands: MarqueeSectionSettingsSchema.default(DEFAULT_BRANDS_ANIMATION),
});

export type HomepageAnimationsSettings = z.infer<typeof HomepageAnimationsSettingsSchema>;

export const DEFAULT_HOMEPAGE_ANIMATIONS: HomepageAnimationsSettings = {
  categories: DEFAULT_CATEGORIES_ANIMATION,
  brands: DEFAULT_BRANDS_ANIMATION,
};

export const WhatsAppButtonSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  phoneNumber: z.string().refine((val) => normalizePakistaniMobileNumber(val) !== null, {
    message: 'Must be a valid 12-digit Pakistani mobile number (923XXXXXXXXX)',
  }).default('923432200995'),
  defaultMessage: z.string().max(300).default('Assalam o Alaikum! I need help with {page}'),
  showOn: z.enum(['all', 'except_checkout_cart', 'homepage_only']).default('all'),
  homepageBehavior: z.enum(['after_hero', 'always']).default('after_hero'),
  position: z.enum(['bottom_right', 'bottom_left']).default('bottom_right'),
  labelText: z.string().max(50).default(''),
});

export type WhatsAppButtonSettings = z.infer<typeof WhatsAppButtonSettingsSchema>;

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppButtonSettings = {
  enabled: true,
  phoneNumber: '923432200995',
  defaultMessage: 'Assalam o Alaikum! I need help with {page}',
  showOn: 'all',
  homepageBehavior: 'after_hero',
  position: 'bottom_right',
  labelText: '',
};

// =============================================================================
// ORDER SUCCESS PAGE SETTINGS
// =============================================================================

function isValidSafeLink(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  // Relative internal link starting with /
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  // Absolute HTTPS link
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const OrderSuccessPageSettingsSchema = z.object({
  badgeText: z.string().trim().max(60).default('ORDER PLACED SUCCESSFULLY'),
  heading: z.string().trim().max(120).default('Thank You for Your Order!'),
  message: z.string().trim().max(600).default(
    "Thank you for choosing AL-HAMD SHOP. We truly appreciate your trust and support. Your order has been received successfully, and we're grateful for the opportunity to serve you. We look forward to making your shopping experience wonderful!"
  ),
  labelOrderNumber: z.string().trim().max(60).default('Order Number'),
  labelInvoiceNumber: z.string().trim().max(60).default('Invoice Number'),
  labelOrderStatus: z.string().trim().max(60).default('Order Status'),
  labelPaymentMethod: z.string().trim().max(60).default('Payment Method'),
  labelPaymentReference: z.string().trim().max(60).default('Payment Reference (TID)'),
  labelTotalAmount: z.string().trim().max(60).default('Total Amount'),

  showFootnote: z.boolean().default(false),
  footnoteText: z.string().trim().max(200).default('A confirmation has also been dispatched to {phone}.'),

  primaryButtonLabel: z.string().trim().max(40).default('CONTINUE SHOPPING'),
  primaryButtonLink: z.string().trim().max(300).refine(isValidSafeLink, {
    message: 'Must be a relative link starting with "/" or an absolute https:// URL.',
  }).default('/shop'),

  secondaryButtonEnabled: z.boolean().default(false),
  secondaryButtonLabel: z.string().trim().max(40).default('VIEW ACCOUNT'),
  secondaryButtonLink: z.string().trim().max(300).refine((val) => !val || isValidSafeLink(val), {
    message: 'Must be a relative link starting with "/" or an absolute https:// URL.',
  }).default('/account'),
});

export type OrderSuccessPageSettings = z.infer<typeof OrderSuccessPageSettingsSchema>;

export const DEFAULT_ORDER_SUCCESS_SETTINGS: OrderSuccessPageSettings = {
  badgeText: 'ORDER PLACED SUCCESSFULLY',
  heading: 'Thank You for Your Order!',
  message:
    "Thank you for choosing AL-HAMD SHOP. We truly appreciate your trust and support. Your order has been received successfully, and we're grateful for the opportunity to serve you. We look forward to making your shopping experience wonderful!",
  labelOrderNumber: 'Order Number',
  labelInvoiceNumber: 'Invoice Number',
  labelOrderStatus: 'Order Status',
  labelPaymentMethod: 'Payment Method',
  labelPaymentReference: 'Payment Reference (TID)',
  labelTotalAmount: 'Total Amount',

  showFootnote: false,
  footnoteText: 'A confirmation has also been dispatched to {phone}.',

  primaryButtonLabel: 'CONTINUE SHOPPING',
  primaryButtonLink: '/shop',

  secondaryButtonEnabled: false,
  secondaryButtonLabel: 'VIEW ACCOUNT',
  secondaryButtonLink: '/account',
};

/**
 * Escapes plain text for safe rendering and prevents HTML/script injection.
 */
export function sanitizePlainText(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely replaces dynamic placeholders {customerName}, {orderNumber}, {invoiceNumber}, {total}, {phone}, {paymentMethod}.
 * All replacements are strictly plain-text sanitized before insertion.
 */
export function replaceOrderSuccessPlaceholders(
  template: string,
  data: {
    customerName?: string;
    orderNumber?: string;
    invoiceNumber?: string;
    total?: string;
    phone?: string;
    paymentMethod?: string;
  }
): string {
  if (!template) return '';
  const customerName = data.customerName ? String(data.customerName) : '';
  const orderNumber = data.orderNumber ? String(data.orderNumber) : '';
  const invoiceNumber = data.invoiceNumber ? String(data.invoiceNumber) : '';
  const total = data.total ? String(data.total) : '';
  const phone = data.phone ? String(data.phone) : '';
  const paymentMethod = data.paymentMethod ? String(data.paymentMethod) : '';

  return template
    .replace(/\{customerName\}/gi, customerName)
    .replace(/\{orderNumber\}/gi, orderNumber)
    .replace(/\{invoiceNumber\}/gi, invoiceNumber)
    .replace(/\{total\}/gi, total)
    .replace(/\{phone\}/gi, phone)
    .replace(/\{paymentMethod\}/gi, paymentMethod);
}

// =============================================================================
// PAKISTANI MOBILE NUMBER VALIDATOR & NORMALIZER
// Accepts: 03XXXXXXXXX, +92 3XX XXXXXXX, 923XXXXXXXXX
// Normalizes and stores as: 923XXXXXXXXX (12 digits starting with 923)
// =============================================================================

export function normalizePakistaniMobileNumber(input?: string | null): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Remove whitespace, dashes, parens, and dots
  let clean = input.trim().replace(/[\s\-\(\)\.]/g, '');

  if (clean.startsWith('+')) {
    clean = clean.slice(1);
  }

  // 03XXXXXXXXX (11 digits local mobile)
  if (clean.startsWith('03') && clean.length === 11) {
    clean = '92' + clean.slice(1);
  } else if (clean.startsWith('3') && clean.length === 10) {
    clean = '92' + clean;
  }

  // Valid Pakistani mobile prefixes: 9230x through 9235x (Jazz, Zong, Ufone, Telenor, Scom)
  if (/^923[0-5]\d{8}$/.test(clean)) {
    return clean;
  }

  return null;
}

export function validatePakistaniMobileNumber(input: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const normalized = normalizePakistaniMobileNumber(input);
  if (normalized) {
    return { valid: true, normalized };
  }
  return {
    valid: false,
    error: 'Invalid Pakistani mobile number. Must be a valid 12-digit number starting with 923 (e.g. 03432200995 or +92 343 2200995).',
  };
}

// =============================================================================
// WA.ME LINK BUILDER
// =============================================================================

export function buildWhatsAppLink(
  phoneOrSettings: string | Partial<WhatsAppButtonSettings>,
  defaultMessageOrTitle?: string,
  contextOrUrl?: { page?: string; url?: string } | string
): string {
  let phone = '923432200995';
  let template = 'Assalam o Alaikum! I need help with {page}';
  let pageTitle = 'AL-HAMD SHOP';
  let pageUrl = '';

  if (typeof phoneOrSettings === 'object' && phoneOrSettings !== null) {
    phone = phoneOrSettings.phoneNumber || phone;
    template = phoneOrSettings.defaultMessage ?? template;
    if (typeof defaultMessageOrTitle === 'string') pageTitle = defaultMessageOrTitle;
    if (typeof contextOrUrl === 'string') pageUrl = contextOrUrl;
    else if (typeof contextOrUrl === 'object' && contextOrUrl !== null) {
      if (contextOrUrl.page) pageTitle = contextOrUrl.page;
      if (contextOrUrl.url) pageUrl = contextOrUrl.url;
    }
  } else if (typeof phoneOrSettings === 'string') {
    phone = phoneOrSettings;
    if (typeof defaultMessageOrTitle === 'string') template = defaultMessageOrTitle;
    if (typeof contextOrUrl === 'string') pageUrl = contextOrUrl;
    else if (typeof contextOrUrl === 'object' && contextOrUrl !== null) {
      if (contextOrUrl.page) pageTitle = contextOrUrl.page;
      if (contextOrUrl.url) pageUrl = contextOrUrl.url;
    }
  }

  const resolvedMsg = template
    .replace(/\{page\}/gi, pageTitle)
    .replace(/\{url\}/gi, pageUrl)
    .trim();

  const query = resolvedMsg ? `?text=${encodeURIComponent(resolvedMsg)}` : '';
  return `https://wa.me/${phone}${query}`;
}
