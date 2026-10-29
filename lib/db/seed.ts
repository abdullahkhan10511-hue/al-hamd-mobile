import { Product } from '@/types';
import {
  Brand,
  Order,
  HomepageSection,
  AllProductsConfig,
  HeroConfig,
  AnnouncementItem,
  NavigationItem,
  FlashSaleConfig,
  TrustBenefitItem,
  StoreSettings,
  AdminUser,
} from '@/types/admin';
import { products as initialProducts } from '@/data/products';

const computeSeedBrandCount = (name: string, slug: string): number => {
  const n = name.toLowerCase().trim();
  const s = slug.toLowerCase().trim();
  return initialProducts.filter((p: any) => {
    if (p.status === 'inactive' || p.status === 'archived' || p.isActive === false) return false;
    const b = (p.brand || '').toLowerCase().trim();
    const bs = (p.brandSlug || '').toLowerCase().trim();
    return b === n || b === s || bs === s || bs === n;
  }).length;
};

export const seedBrands: Brand[] = [
  { id: 'brand-1', name: 'Apple', slug: 'apple', status: 'active', productCount: 2, description: 'Genuine MagSafe accessories, AirPods audio, and premium cases' },
  { id: 'brand-2', name: 'Samsung', slug: 'samsung', status: 'active', productCount: 1, description: 'Original 45W super fast chargers, Galaxy accessories, and covers' },
  { id: 'brand-3', name: 'Anker', slug: 'anker', status: 'active', productCount: 2, description: 'World-renowned high-speed GaN fast charging and portable power banks' },
  { id: 'brand-4', name: 'Baseus', slug: 'baseus', status: 'active', productCount: 4, description: 'Innovative multi-port chargers, car mounts, and magnetic wireless docks' },
  { id: 'brand-5', name: 'UGREEN', slug: 'ugreen', status: 'active', productCount: 2, description: 'Certified 100W braided cables, ergonomic desktop stands, and hubs' },
  { id: 'brand-6', name: 'Audionic', slug: 'audionic', status: 'active', productCount: 1, description: 'Signature high-bass TWS earbuds and Bluetooth mobile audio' },
  { id: 'brand-7', name: 'Sony', slug: 'sony', status: 'active', productCount: 1, description: 'Industry-leading noise cancellation mobile acoustics and headphones' },
  { id: 'brand-8', name: 'JBL', slug: 'jbl', status: 'active', productCount: 1, description: 'Ultra-portable waterproof Bluetooth mobile speakers' },
  { id: 'brand-9', name: 'Spigen', slug: 'spigen', status: 'active', productCount: 1, description: 'Military-grade shockproof smartphone cases and armor covers' },
  { id: 'brand-10', name: 'ESR', slug: 'esr', status: 'active', productCount: 2, description: '9H diamond tempered glass protectors, screen cleaning, and cases' },
  { id: 'brand-11', name: 'Xiaomi', slug: 'xiaomi', status: 'active', productCount: 0, description: 'High-speed fast chargers, smart bands, and mobile essentials' },
  { id: 'brand-12', name: 'Realme', slug: 'realme', status: 'active', productCount: 0, description: 'SuperDart fast charging cables and mobile earbuds' },
  { id: 'brand-13', name: 'Joyroom', slug: 'joyroom', status: 'active', productCount: 0, description: 'Fast wireless chargers, car mounts, and mobile accessories' },
  { id: 'brand-14', name: 'Ronin', slug: 'ronin', status: 'active', productCount: 0, description: 'Reliable fast charging adapters, power banks, and cables' },
];

export const seedProducts: (Product & { sku: string; lowStockThreshold: number; trending?: boolean })[] =
  initialProducts.map((p) => ({
    ...p,
    wholesalePrice:
      p.wholesalePrice ||
      (p.slug === 'apple-airpods-pro-2'
        ? 11500
        : p.slug === 'anker-20000mah-power-bank'
        ? 4500
        : p.slug === 'samsung-45w-super-fast-charger'
        ? 2400
        : undefined),
    sku: p.sku || `ALH-${p.id}`,
    lowStockThreshold: p.lowStockThreshold || 5,
    trending: p.trending ?? false,
  }));

export const seedHomepageSections: HomepageSection[] = [
  { id: 'hero', name: 'Full-Screen Video Hero', enabled: true, order: 1 },
  { id: 'trust', name: 'Trust & Benefits Bar', enabled: false, order: 2 },
  { id: 'categories', name: 'Shop by Categories', enabled: true, order: 3 },
  { id: 'brands', name: 'Shop by Brands', enabled: true, order: 4 },
  { id: 'all-products', name: 'All Products Showcase', enabled: true, order: 5 },
  { id: 'new-arrivals', name: 'New Arrivals', enabled: true, order: 6 },
  { id: 'best-sellers', name: 'Best Sellers', enabled: true, order: 7 },
  { id: 'deals', name: 'Special Deals & Bundles', enabled: false, order: 8 },
  { id: 'final-trust', name: 'Final Assurance Bar', enabled: true, order: 9 },
];

export const seedAllProductsConfig: AllProductsConfig = {
  title: 'All Products',
  subtitle: 'Explore our complete catalog of high-grade mobile accessories',
  limit: 12,
  sortBy: 'featured',
  categoryFilter: 'all',
  showViewAllButton: true,
  viewAllLink: '/shop',
  viewAllText: 'Explore Entire Catalog',
};

export const seedHeroConfig: HeroConfig = {
  eyebrowText: 'PREMIUM MOBILE ACCESSORIES',
  mainHeading: 'Elevate Your',
  headingHighlight: 'Mobile Experience',
  description: 'Shop high-speed GaN fast chargers, military-grade MagSafe phone cases, 20,000mAh power banks, crystal-clear TWS earbuds, and precision smartphone protection across Pakistan.',
  primaryButtonText: 'Shop All Accessories',
  primaryButtonLink: '/shop',
  secondaryButtonText: 'Explore Categories',
  secondaryButtonLink: '#categories',
  desktopImage: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=1200&auto=format&fit=crop',
  mobileImage: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=600&auto=format&fit=crop',
  floatingProducts: [
    {
      id: 'fp-1',
      productId: 'prod-15', // AirPods Pro 2
      position: 'top-left',
      badge: 'Active ANC',
      animationEnabled: true,
      animationSpeed: 'normal',
      visible: true,
    },
    {
      id: 'fp-2',
      productId: 'prod-16', // Anker Power Bank
      position: 'top-right',
      badge: '20,000 mAh',
      animationEnabled: true,
      animationSpeed: 'normal',
      visible: true,
    },
    {
      id: 'fp-3',
      productId: 'prod-case-01', // MagSafe Case
      position: 'bottom-left',
      badge: 'MagSafe Armor',
      animationEnabled: true,
      animationSpeed: 'normal',
      visible: true,
    },
  ],
};

export const seedAnnouncements: AnnouncementItem[] = [
  {
    id: 'ann-1',
    text: 'Free Nationwide Delivery on Mobile Accessories Over Rs. 5,000',
    link: '/shop',
    linkText: 'Shop Now',
    active: true,
    displayOrder: 1,
  },
  {
    id: 'ann-2',
    text: 'Flash Sale: Up to 50% Off On GaN Fast Chargers & Power Banks — Code: FAST50',
    link: '/shop?filter=sale',
    linkText: 'Explore Deals',
    active: true,
    displayOrder: 2,
  },
  {
    id: 'ann-3',
    text: 'Cash on Delivery (COD) Available Nationwide Across Pakistan',
    link: '/shop',
    linkText: 'Order Today',
    active: true,
    displayOrder: 3,
  },
];

export const seedNavigation: NavigationItem[] = [
  { id: 'nav-1', label: 'Home', href: '/', displayOrder: 1, visible: true },
  { id: 'nav-2', label: 'Shop', href: '/shop', displayOrder: 2, visible: true },
  { id: 'nav-3', label: 'New Arrivals', href: '/new-arrivals', displayOrder: 3, visible: true },
  { id: 'nav-4', label: 'Best Sellers', href: '/best-sellers', displayOrder: 4, visible: true },
  { id: 'nav-5', label: 'Categories', href: '/categories', displayOrder: 5, visible: true },
  { id: 'nav-6', label: 'About', href: '/about', displayOrder: 6, visible: true },
  { id: 'nav-7', label: 'Contact', href: '/contact', displayOrder: 7, visible: true },
  { id: 'nav-8', label: 'Deals', href: '/deals', displayOrder: 8, visible: true },
];

// Target countdown 60 hours ahead from today
const futureDate = new Date();
futureDate.setHours(futureDate.getHours() + 63);
futureDate.setMinutes(futureDate.getMinutes() + 45);

export const seedFlashSaleConfig: FlashSaleConfig = {
  enabled: true,
  title: 'Up To 50% Off',
  subtitle: 'Power & Audio Flash Sale',
  bannerImage: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop',
  buttonText: 'Shop Flash Deals',
  buttonLink: '/shop?filter=sale',
  startDate: new Date().toISOString(),
  endDate: futureDate.toISOString(),
  countdownEndTime: futureDate.toISOString(),
  productIds: ['prod-16', 'prod-15', 'prod-chg-01'],
};

export const seedTrustBenefits: TrustBenefitItem[] = [
  {
    id: 'tb-1',
    icon: 'Award',
    title: 'Quality You Can Trust',
    description: 'Shop carefully selected mobile accessories for everyday use.',
    displayOrder: 1,
    visible: true,
  },
  {
    id: 'tb-2',
    icon: 'Truck',
    title: 'Delivery Across Pakistan',
    description: 'Convenient delivery options for customers across Pakistan.',
    displayOrder: 2,
    visible: true,
  },
  {
    id: 'tb-3',
    icon: 'Lock',
    title: 'Secure Shopping Experience',
    description: 'A straightforward checkout experience with the payment options currently supported by the store.',
    displayOrder: 3,
    visible: true,
  },
  {
    id: 'tb-4',
    icon: 'Headphones',
    title: 'Customer Support',
    description: 'Get help with your questions, orders and product information.',
    displayOrder: 4,
    visible: true,
  },
];

export const seedStoreSettings: StoreSettings = {
  storeName: 'AL-HAMD SHOP',
  storeTagline: 'Quality Mobile Accessories & Everyday Smartphone Essentials',
  logoUrl: '',
  faviconUrl: '/favicon.ico',
  email: 'support@alhamd-mobile.com',
  phone: '+92 343 2200995',
  address: 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan',
  whatsapp: '+923432200995',
  currency: 'PKR',
  currencySymbol: 'Rs.',
  freeShippingThreshold: 5000,
  standardShippingFee: 200,
  expressShippingFee: 450,
  deliveryMessage: 'Free Delivery Across Pakistan on Orders Above Rs. 5,000',
  estimatedDeliveryText: '2–4 Business Days Nationwide',
  pakistanOnly: true,
  taxPercentage: 0,
  socialLinks: {
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    whatsapp: 'https://wa.me/923432200995',
    status: {
      facebook: false,
      instagram: false,
      tiktok: false,
      youtube: false,
      whatsapp: true,
    },
  },
  websiteTitle: 'AL-HAMD SHOP | Mobile Accessories Pakistan',
  canonicalUrl: 'https://alhamdshop.com',
  ogImageUrl: '',
  seo: {
    metaTitle: 'AL-HAMD SHOP | Mobile Accessories Pakistan',
    metaDescription: 'Shop mobile accessories at AL-HAMD SHOP. Explore chargers, cables, cases, earbuds, power banks and more, with reliable delivery across Pakistan.',
    keywords: ['mobile accessories pakistan', 'phone cases', 'fast chargers', 'power banks', 'earbuds', 'screen protectors', 'magsafe', 'al-hamd shop'],
    websiteTitle: 'AL-HAMD SHOP | Mobile Accessories Pakistan',
    searchEngineTitle: 'AL-HAMD SHOP | Mobile Accessories Pakistan',
    searchEngineDescription: 'Shop mobile accessories at AL-HAMD SHOP. Explore chargers, cables, cases, earbuds, power banks and more, with reliable delivery across Pakistan.',
    canonicalUrl: 'https://alhamdshop.com',
    faviconUrl: '/favicon.ico',
    logoUrl: '',
    ogImageUrl: '',
  },
  footerDescription: 'Quality mobile accessories, chargers, cables, cases, audio products and everyday smartphone essentials, serving customers across Pakistan.',
  businessHours: 'Mon – Sat: 10:00 AM – 10:00 PM PKT',
};

export const seedAdmins: AdminUser[] = [
  {
    id: 'admin-super-1',
    name: 'Chief Administrator',
    email: 'admin@alhamdmobile.com',
    phone: '+92 300 1234567',
    role: 'SUPER_ADMIN',
    permissions: [
      'products.view', 'products.add', 'products.edit', 'products.delete',
      'inventory.view', 'inventory.adjust_stock', 'inventory.edit_warning', 'inventory.view_history',
      'orders.view', 'orders.update_status', 'orders.process', 'orders.print_bills',
      'categories.view', 'categories.add', 'categories.edit', 'categories.delete',
      'promotions.view', 'promotions.add', 'promotions.edit', 'promotions.delete', 'promotions.activate',
      'customers.view', 'customers.suspend', 'customers.activate',
      'content.homepage', 'content.new_arrivals', 'content.best_sellers', 'content.banners', 'content.navigation',
      'settings.view', 'settings.edit',
      'staff.view', 'staff.add', 'staff.edit', 'staff.delete', 'staff.change_roles', 'staff.reset_passwords',
    ],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    status: 'active',
    isOwner: true,
    salt: 'fd9205ff2f83d43d1744b872fc962cfe',
    passwordHash: 'e540ebe0a9c6ce8109025d4436d1867a15d8ec213af7a0fa9bd470d3aa64a2d6',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLogin: new Date().toISOString(),
  },
];

export const seedOrders: Order[] = [];

export { seedPaymentMethods, seedPaymentSecuritySettings } from './paymentMethods';
