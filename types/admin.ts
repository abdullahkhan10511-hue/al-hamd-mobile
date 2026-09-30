export type StaffPredefinedRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'Manager'
  | 'Inventory Manager'
  | 'Order Manager'
  | 'Product Manager'
  | 'Category Manager'
  | 'Promotion Manager'
  | 'Customer Manager';

export type AdminRole = StaffPredefinedRole | string;

export type PermissionModule =
  | 'Products'
  | 'Inventory'
  | 'Orders'
  | 'Shop Counter'
  | 'Categories'
  | 'Promotions'
  | 'Customers'
  | 'Wholesale Account Management'
  | 'Website Content'
  | 'Pages & Legal'
  | 'Settings'
  | 'Staff Management';

export interface PermissionItem {
  id: string;
  key: string;
  name: string;
  module: PermissionModule;
  description: string;
}

export interface StaffRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: AdminRole;
  roleId?: string;
  permissions: string[];
  avatar?: string;
  status: 'active' | 'inactive';
  passwordHash?: string;
  salt?: string;
  isOwner?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

// Backwards-compatible AdminUser alias
export type AdminUser = StaffUser;

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  status: 'active' | 'inactive';
  productCount?: number;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded';

export type PaymentStatus =
  | 'Pending'
  | 'Awaiting Verification'
  | 'Paid'
  | 'Failed'
  | 'Cancelled'
  | 'Refunded';

export interface PaymentVerificationRecord {
  verifiedBy: string;
  verifiedAt: string;
  note?: string;
  status: 'verified' | 'rejected';
}

export interface PaymentMethodConfig {
  id: string; // 'cod' | 'card' | 'easypaisa' | 'jazzcash'
  name: string;
  type: 'cod' | 'card' | 'wallet';
  enabled: boolean;
  description: string;
  instructions: string;
  merchantName?: string;
  merchantIdentifier?: string;
  displayOrder: number;
  requiresReference: boolean;
  referenceFormat?: string;
  isConfigured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSecuritySettings {
  securityNotice: string;
  processingMessage: string;
  manualVerificationEnabled: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  slug: string;
  sku: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedModel?: string;
  image: string;
  total: number;
}

export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE';

export type OrderType = 'wholesale' | 'online' | 'walk_in' | 'super_wholesale';

export function getOrderType(order: {
  orderType?: OrderType;
  customerType?: CustomerType;
  shopName?: string;
  wholesaleAccountId?: string;
  orderSource?: 'ONLINE' | 'POS';
  deliveryMethod?: string;
}): OrderType {
  if (order.orderType) return order.orderType;
  if (order.customerType === 'SUPER_WHOLESALE') {
    return 'super_wholesale';
  }
  if (order.customerType === 'WHOLESALE' || Boolean(order.shopName) || Boolean(order.wholesaleAccountId)) {
    return 'wholesale';
  }
  if (order.orderSource === 'POS' || order.deliveryMethod === 'counter') {
    return 'walk_in';
  }
  return 'online';
}

export interface Order {
  id: string; // e.g. ORD-2026-000001 or ALH-317411
  invoiceNumber: string; // e.g. INV-2026-000001
  orderType?: OrderType;
  customerType?: CustomerType;
  shopName?: string;
  wholesaleAccountId?: string;
  customer: {
    id?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
  };
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  deliveryMethod: 'standard' | 'express' | 'counter' | 'pickup';
  paymentMethod: string;
  paymentMethodId?: string;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paymentVerification?: PaymentVerificationRecord;
  status: OrderStatus;
  notes?: string;
  orderSource?: 'ONLINE' | 'POS';
  cashierId?: string;
  cashierName?: string;
  cashierEmail?: string;
  amountPaid?: number;
  changeGiven?: number;
  posDiscountType?: 'percentage' | 'fixed';
  posDiscountValue?: number;
  posDiscountReason?: string;
  promoCode?: string;
  promoDiscountType?: 'percentage' | 'fixed';
  promoDiscountValue?: number;
  promoDiscountAmount?: number;
  promoDetails?: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    description?: string;
  };
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  customerType?: CustomerType;
  shopName?: string;
  fullName?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  status: 'active' | 'suspended' | 'deactivated' | 'inactive';
  passwordHash?: string;
  passwordSalt?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type?: 'RESTOCK' | 'ORDER_DEDUCT' | 'MANUAL_ADJUST' | 'DAMAGED';
  quantityDelta?: number;
  changeAmount: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  adminEmail: string;
  createdAt?: string;
  timestamp: string;
}

export interface AnnouncementItem {
  id: string;
  text: string;
  icon?: string;
  link?: string;
  linkText?: string;
  background?: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  displayOrder: number;
}

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  displayOrder: number;
  visible: boolean;
  isExternal?: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  image: string;
  mobileImage?: string;
  buttonText: string;
  buttonLink: string;
  startDate?: string;
  endDate?: string;
  countdownEndTime?: string;
  status: 'active' | 'inactive';
  displayOrder: number;
}

export interface FlashSaleConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  bannerImage: string;
  buttonText: string;
  buttonLink: string;
  startDate: string;
  endDate: string;
  countdownEndTime: string; // ISO string
  productIds: string[];
}

export interface FloatingProductConfig {
  id: string;
  productId: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  badge?: string;
  animationEnabled: boolean;
  animationSpeed: 'normal' | 'slow' | 'fast';
  visible: boolean;
}

export interface HomepageVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  active: boolean;
  displayOrder: number;
  duration?: number;
  size?: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomepageSection {
  id: string; // 'hero' | 'trust' | 'categories' | 'new-arrivals' | 'best-sellers' | 'promo-banners' | 'final-trust'
  name: string;
  enabled: boolean;
  order: number;
}

export interface HeroConfig {
  eyebrowText: string;
  mainHeading: string;
  headingHighlight?: string;
  description: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  desktopImage: string;
  mobileImage?: string;
  floatingProducts: FloatingProductConfig[];
}

export interface TrustBenefitItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  displayOrder: number;
  visible: boolean;
}

export interface SocialAccountConfig {
  platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'whatsapp' | string;
  name: string;
  url: string;
  isActive: boolean;
}

export interface SocialLinksSettings {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  status?: {
    facebook?: boolean;
    instagram?: boolean;
    tiktok?: boolean;
    youtube?: boolean;
    whatsapp?: boolean;
    [key: string]: boolean | undefined;
  };
  accounts?: SocialAccountConfig[];
  [key: string]: any;
}

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  logoUrl?: string;
  faviconUrl?: string;
  email: string;
  phone: string;
  address: string;
  whatsapp?: string;
  currency: string;
  currencySymbol: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressShippingFee: number;
  deliveryMessage?: string;
  estimatedDeliveryText?: string;
  pakistanOnly?: boolean;
  taxPercentage: number;
  socialLinks: SocialLinksSettings;
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    faviconUrl?: string;
    logoUrl?: string;
  };
  footerDescription: string;
  businessHours: string;
}

export interface ActivityLog {
  id: string;
  adminEmail: string;
  action: string;
  target: string;
  details?: string;
  timestamp: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'stock' | 'system';
  link?: string;
  read: boolean;
  timestamp: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  featuredImage: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  tags: string[];
  publishDate: string;
  status: 'published' | 'draft';
}

export type PageStatus = 'Published' | 'Draft' | 'Hidden';

export type BlockType =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'rich_text'
  | 'image'
  | 'button'
  | 'bullet_list'
  | 'numbered_list'
  | 'divider'
  | 'faq'
  | 'contact_info';

export interface PageBlock {
  id: string;
  type: BlockType;
  order: number;
  // Heading
  headingText?: string;
  headingLevel?: 'h1' | 'h2' | 'h3';
  headingAlign?: 'left' | 'center' | 'right';
  // Subheading
  subheadingText?: string;
  subheadingAlign?: 'left' | 'center' | 'right';
  // Paragraph
  paragraphText?: string;
  paragraphAlign?: 'left' | 'center' | 'right';
  // Rich Text
  richTextHtml?: string;
  // Image
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  imageAlign?: 'left' | 'center' | 'right';
  // Button
  buttonText?: string;
  buttonLink?: string;
  buttonVariant?: 'primary' | 'secondary' | 'outline';
  buttonAlign?: 'left' | 'center' | 'right';
  // Lists
  listItems?: string[];
  // Divider
  dividerStyle?: 'solid' | 'dashed';
  dividerSpacing?: 'sm' | 'md' | 'lg';
  // FAQ
  faqQuestion?: string;
  faqAnswer?: string;
  // Contact Info
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  contactHours?: string;
  contactWhatsapp?: string;
}

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  showInHeader: boolean;
  showInFooter: boolean;
  showInMobile: boolean;
  footerCategory?: 'customer_service' | 'legal' | 'about';
  seoTitle?: string;
  seoDescription?: string;
  targetKeywords?: string[];
  seoImage?: string;
  blocks: PageBlock[];
  order: number;
  content?: string; // backwards compatibility plain text
  enabled?: boolean; // backwards compatibility boolean (true if Published)
  createdAt: string;
  updatedAt: string;
}

export type PageContent = CustomPage;

export interface BillSettings {
  storeName: string;
  storeLogo?: string;
  storeAddress: string;
  phone: string;
  whatsapp?: string;
  email: string;
  website?: string;
  invoiceHeaderText?: string;
  invoiceFooterText?: string;
  taxNumber?: string;
  thermalFooterNote?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ShopLocation {
  id: string;
  shopName: string;
  googleMapsUrl: string;
  isActive: boolean;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export type PromoDiscountType = 'percentage' | 'fixed';
export type PromoCustomerRestriction = 'all' | 'specific' | 'new' | 'existing';
export type PromoApplicableType = 'all' | 'products' | 'categories';

export interface PromoCode {
  id: string;
  code: string; // Case-insensitive, stored uppercase
  description?: string;
  discountType: PromoDiscountType;
  discountValue: number; // e.g., 10 for 10%, 500 for Rs. 500
  maximumDiscount?: number | null; // Optional cap for percentage discounts
  minimumOrderAmount: number; // 0 if none
  startDate?: string; // ISO date string or YYYY-MM-DD
  expiryDate?: string; // ISO date string or YYYY-MM-DD
  usageLimit?: number | null; // null or 0 = unlimited
  perCustomerLimit?: number | null; // null or 0 = unlimited
  isActive: boolean;
  applicableType: PromoApplicableType;
  applicableProducts?: string[]; // Product IDs
  applicableCategories?: string[]; // Category slugs/IDs
  customerRestrictions: PromoCustomerRestriction;
  specificCustomerEmails?: string[];
  posAllowed: boolean;
  onlineAllowed: boolean;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCodeUsage {
  id: string;
  promoCodeId: string;
  code: string;
  orderId: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  discountAmount: number;
  orderTotal: number;
  channel: 'ONLINE' | 'POS';
  usedBy?: string; // Cashier email/name for POS, customer for online
  createdAt: string;
}

// ============================================================
// SHOP BILL (Warehouse → Shop Stock Transfer)
// ============================================================

export type ShopBillStatus = 'draft' | 'finalized' | 'voided';

export interface ShopBillItem {
  id?: number;
  shopBillId?: string;
  productId: string;
  productName: string;
  sku?: string;
  modelId?: string;
  modelName?: string;
  transferQuantity: number;
  warehouseStockBefore?: number;
  warehouseStockAfter?: number;
  shopStockBefore?: number;
  shopStockAfter?: number;
}

export interface ShopBill {
  id: string;
  billNumber: string;
  status: ShopBillStatus;
  notes?: string;
  items: ShopBillItem[];
  createdBy: string;
  finalizedBy?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}
