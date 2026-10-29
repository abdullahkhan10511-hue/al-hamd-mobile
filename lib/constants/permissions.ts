import { PermissionItem, PermissionModule, PermissionPreset, StaffPredefinedRole } from '@/types/admin';

export const ALL_PERMISSIONS: PermissionItem[] = [
  // =========================================================================
  // 1. DASHBOARD
  // =========================================================================
  {
    id: 'perm-dash-1',
    key: 'dashboard.view',
    name: 'View Dashboard Metrics',
    module: 'Dashboard',
    description: 'Access the admin dashboard overview, top summary metrics, and quick stat counters.',
  },
  {
    id: 'perm-dash-2',
    key: 'dashboard.sales_chart',
    name: 'View Sales Charts',
    module: 'Dashboard',
    description: 'Inspect revenue charts, daily order trends, and graphical performance summaries.',
  },
  {
    id: 'perm-dash-3',
    key: 'dashboard.orders_metric',
    name: 'View Order Statistics & Metrics',
    module: 'Dashboard',
    description: 'Inspect order fulfillment counters, pending deliveries, and fulfillment volume on dashboard.',
  },

  // =========================================================================
  // 2. PRODUCTS
  // =========================================================================
  {
    id: 'perm-prod-1',
    key: 'products.view',
    name: 'View Products',
    module: 'Products',
    description: 'Browse the product catalog, search items, and view product details.',
  },
  {
    id: 'perm-prod-2',
    key: 'products.create',
    name: 'Create Products',
    module: 'Products',
    description: 'Register and create new products with descriptions, variants, and settings.',
  },
  {
    id: 'perm-prod-2b',
    key: 'products.add',
    name: 'Add Products',
    module: 'Products',
    description: 'Add new items to the catalog (semantic alias for create).',
  },
  {
    id: 'perm-prod-3',
    key: 'products.edit',
    name: 'Edit Products',
    module: 'Products',
    description: 'Modify product title, description, categories, brands, and settings.',
  },
  {
    id: 'perm-prod-3b',
    key: 'products.edit_details',
    name: 'Edit Product Details',
    module: 'Products',
    description: 'Fine-tune product specifications, tags, features, and textual descriptions.',
  },
  {
    id: 'perm-prod-3c',
    key: 'products.media',
    name: 'Manage Images & Media',
    module: 'Products',
    description: 'Upload, reorder, and remove product gallery images and product video links.',
  },
  {
    id: 'perm-prod-3d',
    key: 'products.sku_barcode',
    name: 'Manage SKU & Barcodes',
    module: 'Products',
    description: 'Assign, edit, and scan SKU codes and barcode identifiers for catalog items.',
  },
  {
    id: 'perm-prod-4',
    key: 'products.delete',
    name: 'Delete Products',
    module: 'Products',
    description: 'Remove products permanently or archive them from the store catalog.',
  },
  {
    id: 'perm-prod-5',
    key: 'products.import',
    name: 'Import Products Data',
    module: 'Products',
    description: 'Bulk import products and variants via CSV, Excel, or external feeds.',
  },
  {
    id: 'perm-prod-6',
    key: 'products.export',
    name: 'Export Products Data',
    module: 'Products',
    description: 'Export the complete product catalog with specifications to CSV or Excel.',
  },

  // =========================================================================
  // 3. PRICING (GRANULAR ACCESS CONTROL)
  // =========================================================================
  {
    id: 'perm-price-1',
    key: 'pricing.retail.view',
    name: 'View Retail Price',
    module: 'Pricing',
    description: 'View the customer retail price and compare-at discount prices.',
  },
  {
    id: 'perm-price-2',
    key: 'pricing.retail.edit',
    name: 'Add / Edit Retail Price',
    module: 'Pricing',
    description: 'Modify customer retail selling prices and promotional compare-at prices.',
  },
  {
    id: 'perm-price-3',
    key: 'pricing.wholesale.view',
    name: 'View Wholesale Price',
    module: 'Pricing',
    description: 'Inspect wholesale pricing tiers for verified B2B customer accounts.',
  },
  {
    id: 'perm-price-4',
    key: 'pricing.wholesale.edit',
    name: 'Add / Edit Wholesale Price',
    module: 'Pricing',
    description: 'Configure and update wholesale prices for products and model variants.',
  },
  {
    id: 'perm-price-5',
    key: 'pricing.super_wholesale.view',
    name: 'View Super Wholesale Price',
    module: 'Pricing',
    description: 'Inspect exclusive VIP super wholesale partner pricing tiers.',
  },
  {
    id: 'perm-price-6',
    key: 'pricing.super_wholesale.edit',
    name: 'Add / Edit Super Wholesale Price',
    module: 'Pricing',
    description: 'Configure and update super wholesale prices for VIP distributor tiers.',
  },
  {
    id: 'perm-price-7',
    key: 'pricing.cost.view',
    name: 'View Cost / Purchase Price',
    module: 'Pricing',
    description: 'Inspect internal vendor purchase and unit manufacturing/procurement cost prices.',
  },
  {
    id: 'perm-price-8',
    key: 'pricing.cost.edit',
    name: 'Add / Edit Cost Price',
    module: 'Pricing',
    description: 'Update internal vendor purchase costs and landed unit acquisition costs.',
  },
  {
    id: 'perm-price-9',
    key: 'pricing.margin.view',
    name: 'View Profit / Margin',
    module: 'Pricing',
    description: 'View estimated net profit, gross profit margins, and markup percentages.',
  },

  // =========================================================================
  // 4. CATEGORIES
  // =========================================================================
  {
    id: 'perm-cat-1',
    key: 'categories.view',
    name: 'View Categories',
    module: 'Categories',
    description: 'View the category hierarchy and associated catalog merchandising metrics.',
  },
  {
    id: 'perm-cat-2',
    key: 'categories.create',
    name: 'Create Categories',
    module: 'Categories',
    description: 'Create new catalog categories, subcategories, and menu groupings.',
  },
  {
    id: 'perm-cat-2b',
    key: 'categories.add',
    name: 'Add Categories',
    module: 'Categories',
    description: 'Add new catalog categories (semantic alias for create).',
  },
  {
    id: 'perm-cat-3',
    key: 'categories.edit',
    name: 'Edit Categories',
    module: 'Categories',
    description: 'Update category names, banner images, descriptions, and URL slugs.',
  },
  {
    id: 'perm-cat-4',
    key: 'categories.delete',
    name: 'Delete Categories',
    module: 'Categories',
    description: 'Remove empty or deprecated categories from the store hierarchy.',
  },

  // =========================================================================
  // 5. BRANDS
  // =========================================================================
  {
    id: 'perm-brand-1',
    key: 'brands.view',
    name: 'View Brands',
    module: 'Brands',
    description: 'Inspect registered store brands, search brands, and view brand details.',
  },
  {
    id: 'perm-brand-2',
    key: 'brands.create',
    name: 'Create Brands',
    module: 'Brands',
    description: 'Register and create new brand entries with logo, description, and status.',
  },
  {
    id: 'perm-brand-2b',
    key: 'brands.add',
    name: 'Add Brands',
    module: 'Brands',
    description: 'Add new brand entries (semantic alias for create).',
  },
  {
    id: 'perm-brand-3',
    key: 'brands.edit',
    name: 'Edit Brands',
    module: 'Brands',
    description: 'Update brand names, logos, display ordering, and featured status.',
  },
  {
    id: 'perm-brand-4',
    key: 'brands.delete',
    name: 'Delete Brands',
    module: 'Brands',
    description: 'Permanently remove brands from the store catalog.',
  },
  {
    id: 'perm-brand-5',
    key: 'brands.manage',
    name: 'Manage Brands',
    module: 'Brands',
    description: 'Comprehensive operational control over store brand listings and display ordering.',
  },

  // =========================================================================
  // 6. INVENTORY
  // =========================================================================
  {
    id: 'perm-inv-1',
    key: 'inventory.view',
    name: 'View Inventory',
    module: 'Inventory',
    description: 'Inspect stock levels, warehouse unit counts, and SKU lists.',
  },
  {
    id: 'perm-inv-2',
    key: 'inventory.adjust_stock',
    name: 'Adjust Stock Levels',
    module: 'Inventory',
    description: 'Perform manual stock adjustments, restocks, deductions, and write-offs.',
  },
  {
    id: 'perm-inv-2b',
    key: 'inventory.stock.edit',
    name: 'Edit Stock Quantities Directly',
    module: 'Inventory',
    description: 'Directly modify physical warehouse and shop stock balances on product records.',
  },
  {
    id: 'perm-inv-3',
    key: 'inventory.edit_warning',
    name: 'Edit Stock Warning Threshold',
    module: 'Inventory',
    description: 'Configure low-stock alert thresholds for catalog items.',
  },
  {
    id: 'perm-inv-4',
    key: 'inventory.view_history',
    name: 'View Inventory History',
    module: 'Inventory',
    description: 'Access the immutable audit trail of past stock adjustments and cashier notes.',
  },
  {
    id: 'perm-inv-5',
    key: 'inventory.view_shop',
    name: 'View Shop Inventory',
    module: 'Inventory',
    description: 'View the retail shop stock quantities and availability for all products.',
  },
  {
    id: 'perm-inv-6',
    key: 'inventory.shop_bill',
    name: 'Create Shop Transfer Bills',
    module: 'Inventory',
    description: 'Create and finalize shop bills to transfer stock from warehouse to retail shop.',
  },
  {
    id: 'perm-inv-7',
    key: 'inventory.void_shop_bill',
    name: 'Void Shop Bills',
    module: 'Inventory',
    description: 'Void finalized shop bills to reverse warehouse-to-shop stock transfers.',
  },
  {
    id: 'perm-inv-8',
    key: 'inventory.export',
    name: 'Export Inventory Data',
    module: 'Inventory',
    description: 'Export stock levels, valuation reports, and audit logs to CSV or Excel.',
  },

  // =========================================================================
  // 7. ORDERS
  // =========================================================================
  {
    id: 'perm-ord-1',
    key: 'orders.view',
    name: 'View Orders',
    module: 'Orders',
    description: 'Search, filter, and inspect customer orders, line items, and delivery addresses.',
  },
  {
    id: 'perm-ord-2',
    key: 'orders.create',
    name: 'Create Orders',
    module: 'Orders',
    description: 'Create manual phone/walk-in customer orders and draft invoices.',
  },
  {
    id: 'perm-ord-3',
    key: 'orders.update_status',
    name: 'Update Order Status',
    module: 'Orders',
    description: 'Transition order states (Confirmed, Processing, Shipped, Delivered).',
  },
  {
    id: 'perm-ord-4',
    key: 'orders.process',
    name: 'Process Orders & Payment Verification',
    module: 'Orders',
    description: 'Verify bank transfer payment slips, manage packaging, and dispatch shipments.',
  },
  {
    id: 'perm-ord-5',
    key: 'orders.print_bills',
    name: 'Print Orders / Bills / Invoices',
    module: 'Orders',
    description: 'Generate commercial invoices, thermal receipts, and packing slips.',
  },
  {
    id: 'perm-ord-6',
    key: 'orders.delete',
    name: 'Cancel / Delete Orders',
    module: 'Orders',
    description: 'Cancel voided customer orders or permanently delete test orders.',
  },
  {
    id: 'perm-ord-7',
    key: 'orders.export',
    name: 'Export Orders Data',
    module: 'Orders',
    description: 'Export filtered customer order records and fulfillment summaries.',
  },

  // =========================================================================
  // 8. SHOP COUNTER / POS
  // =========================================================================
  {
    id: 'perm-pos-1',
    key: 'pos.view',
    name: 'Access Shop Counter (POS)',
    module: 'Shop Counter',
    description: 'Access the Shop Counter / POS terminal interface and browse retail inventory.',
  },
  {
    id: 'perm-pos-2',
    key: 'pos.create_sale',
    name: 'Complete POS Sales',
    module: 'Shop Counter',
    description: 'Process customer counter orders, accept payment tenders, and generate bills.',
  },
  {
    id: 'perm-pos-3',
    key: 'pos.apply_discount',
    name: 'Apply Manual Discounts',
    module: 'Shop Counter',
    description: 'Grant custom PKR or percentage price reductions at checkout.',
  },
  {
    id: 'perm-pos-4',
    key: 'pos.void_sale',
    name: 'Void POS Sales',
    module: 'Shop Counter',
    description: 'Void completed shop transactions and automatically restore inventory stock.',
  },
  {
    id: 'perm-pos-5',
    key: 'pos.view_history',
    name: 'View POS History & Summary',
    module: 'Shop Counter',
    description: 'Inspect daily POS sales summaries, cashier reports, and sales archives.',
  },
  {
    id: 'perm-pos-6',
    key: 'pos.close_register',
    name: 'Close POS Register / Shifts',
    module: 'Shop Counter',
    description: 'Perform shift end-of-day register closure and print daily cashier reconciliations.',
  },

  // =========================================================================
  // 9. CUSTOMERS
  // =========================================================================
  {
    id: 'perm-cust-1',
    key: 'customers.view',
    name: 'View Customers',
    module: 'Customers',
    description: 'Access customer profiles, purchase history, saved addresses, and contact details.',
  },
  {
    id: 'perm-cust-2',
    key: 'customers.create',
    name: 'Create Customer Accounts',
    module: 'Customers',
    description: 'Register new customer profiles with address details and login credentials.',
  },
  {
    id: 'perm-cust-3',
    key: 'customers.edit',
    name: 'Edit Customer Profiles',
    module: 'Customers',
    description: 'Update customer contact info, billing addresses, and notes.',
  },
  {
    id: 'perm-cust-4',
    key: 'customers.suspend',
    name: 'Suspend Customers',
    module: 'Customers',
    description: 'Suspend fraudulent or non-paying customer accounts.',
  },
  {
    id: 'perm-cust-5',
    key: 'customers.activate',
    name: 'Activate Customers',
    module: 'Customers',
    description: 'Reactivate previously suspended customer accounts.',
  },
  {
    id: 'perm-cust-6',
    key: 'customers.delete',
    name: 'Delete Customer Accounts',
    module: 'Customers',
    description: 'Permanently remove inactive customer records.',
  },
  {
    id: 'perm-cust-7',
    key: 'customers.export',
    name: 'Export Customer Directory',
    module: 'Customers',
    description: 'Export customer contact directory and purchase statistics to CSV.',
  },
  {
    id: 'perm-inq-1',
    key: 'inquiries.view',
    name: 'View Customer Inquiries',
    module: 'Customers',
    description: 'Access customer contact inquiries, complaint tickets, and support requests.',
  },
  {
    id: 'perm-inq-2',
    key: 'inquiries.manage',
    name: 'Manage Inquiries',
    module: 'Customers',
    description: 'Update inquiry status, assign priority, add admin resolution notes, and resolve tickets.',
  },

  // =========================================================================
  // 10. WHOLESALE ACCOUNT MANAGEMENT
  // =========================================================================
  {
    id: 'perm-wholesale-1',
    key: 'wholesale.view',
    name: 'View Wholesale Accounts',
    module: 'Wholesale Account Management',
    description: 'Inspect wholesale and super wholesale partner profiles and verification statuses.',
  },
  {
    id: 'perm-wholesale-2',
    key: 'wholesale.create',
    name: 'Create Wholesale Accounts',
    module: 'Wholesale Account Management',
    description: 'Directly register approved wholesale and bulk business accounts.',
  },
  {
    id: 'perm-wholesale-3',
    key: 'wholesale.manage',
    name: 'Manage Wholesale Accounts',
    module: 'Wholesale Account Management',
    description: 'Comprehensive operational control over wholesale profiles, credit limits, and statuses.',
  },
  {
    id: 'perm-wholesale-4',
    key: 'wholesale.approve',
    name: 'Approve Wholesale Applications',
    module: 'Wholesale Account Management',
    description: 'Review and approve/reject wholesale buyer verification requests.',
  },
  {
    id: 'perm-wholesale-5',
    key: 'wholesale.pricing',
    name: 'Configure Wholesale Pricing Tiers',
    module: 'Wholesale Account Management',
    description: 'Set custom percentage discounts and minimum order quantities for wholesale tiers.',
  },

  // =========================================================================
  // 11. PROMOTIONS & DEALS
  // =========================================================================
  {
    id: 'perm-promo-1',
    key: 'promotions.view',
    name: 'View Promotions & Deals',
    module: 'Promotions',
    description: 'View active sales campaigns, promotional deals, and coupon promo codes.',
  },
  {
    id: 'perm-promo-2',
    key: 'promotions.create',
    name: 'Create Promotions & Deals',
    module: 'Promotions',
    description: 'Create promotional campaigns, coupon codes, and bundle deals.',
  },
  {
    id: 'perm-promo-2b',
    key: 'promotions.add',
    name: 'Add Promotions & Deals',
    module: 'Promotions',
    description: 'Add promotional campaigns (semantic alias for create).',
  },
  {
    id: 'perm-promo-3',
    key: 'promotions.edit',
    name: 'Edit Promotions & Deals',
    module: 'Promotions',
    description: 'Modify promotional dates, discounts, coupon limits, and product deals.',
  },
  {
    id: 'perm-promo-4',
    key: 'promotions.delete',
    name: 'Delete Promotions & Deals',
    module: 'Promotions',
    description: 'Permanently remove expired or cancelled promotional deals and coupon codes.',
  },
  {
    id: 'perm-promo-5',
    key: 'promotions.activate',
    name: 'Activate / Deactivate Promotions',
    module: 'Promotions',
    description: 'Toggle promotional deals and campaigns on/off in real-time.',
  },
  {
    id: 'perm-deal-1',
    key: 'deals.view',
    name: 'View Deals',
    module: 'Promotions',
    description: 'Browse all active, draft, and scheduled bundle deals.',
  },
  {
    id: 'perm-deal-2',
    key: 'deals.manage',
    name: 'Manage Deals',
    module: 'Promotions',
    description: 'Create, edit, activate, deactivate, prioritize, and delete bundle deals.',
  },

  // =========================================================================
  // 12. WEBSITE CONTENT
  // =========================================================================
  {
    id: 'perm-cont-1',
    key: 'content.homepage',
    name: 'Manage Homepage Content',
    module: 'Website Content',
    description: 'Configure hero banners, featured product cards, and promotional layouts.',
  },
  {
    id: 'perm-cont-2',
    key: 'content.new_arrivals',
    name: 'Manage New Arrivals',
    module: 'Website Content',
    description: 'Curate products showcased in the New Arrivals section.',
  },
  {
    id: 'perm-cont-3',
    key: 'content.best_sellers',
    name: 'Manage Best Sellers',
    module: 'Website Content',
    description: 'Control items displayed in the Best Sellers section.',
  },
  {
    id: 'perm-cont-4',
    key: 'content.banners',
    name: 'Manage Banners',
    module: 'Website Content',
    description: 'Update marketing hero sliders, notice announcements, and graphic banners.',
  },
  {
    id: 'perm-cont-5',
    key: 'content.navigation',
    name: 'Manage Navigation Menu',
    module: 'Website Content',
    description: 'Modify store header and footer navigation links and menu structure.',
  },
  {
    id: 'perm-cont-6',
    key: 'content.videos',
    name: 'Manage Homepage Videos',
    module: 'Website Content',
    description: 'Upload, edit, and organize homepage video showcases and product clips.',
  },
  {
    id: 'perm-cont-7',
    key: 'content.footer',
    name: 'Manage Footer Content',
    module: 'Website Content',
    description: 'Configure footer links, social media URLs, and copyright announcements.',
  },

  // =========================================================================
  // 13. PAGES & LEGAL
  // =========================================================================
  {
    id: 'perm-page-1',
    key: 'pages.view',
    name: 'View Pages',
    module: 'Pages & Legal',
    description: 'View the list of institutional, policy, and custom pages.',
  },
  {
    id: 'perm-page-2',
    key: 'pages.create',
    name: 'Create Pages',
    module: 'Pages & Legal',
    description: 'Create new static, custom, or policy pages with the block builder.',
  },
  {
    id: 'perm-page-3',
    key: 'pages.edit',
    name: 'Edit Pages',
    module: 'Pages & Legal',
    description: 'Edit page content blocks, headings, copy, and SEO settings.',
  },
  {
    id: 'perm-page-4',
    key: 'pages.delete',
    name: 'Delete Pages',
    module: 'Pages & Legal',
    description: 'Permanently remove custom or institutional pages.',
  },
  {
    id: 'perm-page-5',
    key: 'pages.publish',
    name: 'Publish Pages',
    module: 'Pages & Legal',
    description: 'Toggle page publishing status between Published, Draft, and Hidden.',
  },
  {
    id: 'perm-page-6',
    key: 'pages.manage_nav',
    name: 'Manage Page Navigation Visibility',
    module: 'Pages & Legal',
    description: 'Configure page visibility in header, footer columns, and mobile navigation.',
  },

  // =========================================================================
  // 14. FINANCE
  // =========================================================================
  {
    id: 'perm-fin-1',
    key: 'finance.view',
    name: 'View Financial Reports',
    module: 'Finance',
    description: 'Access store revenue summaries, payment verification reports, and cash reconciliation.',
  },
  {
    id: 'perm-fin-2',
    key: 'finance.export',
    name: 'Export Financial Data',
    module: 'Finance',
    description: 'Export income reports, payment logs, and sales tax summaries.',
  },

  // =========================================================================
  // 15. SETTINGS
  // =========================================================================
  {
    id: 'perm-sett-1',
    key: 'settings.view',
    name: 'View Store Settings',
    module: 'Settings',
    description: 'Inspect store contact information, shipping rates, and tax configurations.',
  },
  {
    id: 'perm-sett-2',
    key: 'settings.edit',
    name: 'Edit Store Settings',
    module: 'Settings',
    description: 'Update store configuration, bill templates, and operational parameters.',
  },
  {
    id: 'perm-sett-3',
    key: 'settings.payment_methods',
    name: 'Manage Payment Methods',
    module: 'Settings',
    description: 'Configure bank account details, Easypaisa, JazzCash, and cash-on-delivery options.',
  },
  {
    id: 'perm-sett-4',
    key: 'settings.shipping',
    name: 'Configure Shipping Rates',
    module: 'Settings',
    description: 'Configure delivery zones, courier partners, and shipping fee schedules.',
  },

  // =========================================================================
  // 16. STAFF MANAGEMENT
  // =========================================================================
  {
    id: 'perm-staff-1',
    key: 'staff.view',
    name: 'View Staff Directory',
    module: 'Staff Management',
    description: 'Browse the directory of staff members and their assigned roles.',
  },
  {
    id: 'perm-staff-2',
    key: 'staff.create',
    name: 'Create Staff Accounts',
    module: 'Staff Management',
    description: 'Register and create new staff accounts with assigned permissions.',
  },
  {
    id: 'perm-staff-2b',
    key: 'staff.add',
    name: 'Add Staff Accounts',
    module: 'Staff Management',
    description: 'Add new staff accounts (semantic alias for create).',
  },
  {
    id: 'perm-staff-3',
    key: 'staff.edit',
    name: 'Edit Staff Accounts',
    module: 'Staff Management',
    description: 'Modify staff profile details, contact information, and account status.',
  },
  {
    id: 'perm-staff-4',
    key: 'staff.delete',
    name: 'Delete Staff Accounts',
    module: 'Staff Management',
    description: 'Permanently remove staff accounts and revoke access tokens.',
  },
  {
    id: 'perm-staff-5',
    key: 'staff.change_roles',
    name: 'Change Staff Roles & Permissions',
    module: 'Staff Management',
    description: 'Reassign staff roles and grant or revoke custom permissions.',
  },
  {
    id: 'perm-staff-6',
    key: 'staff.reset_passwords',
    name: 'Reset Staff Passwords',
    module: 'Staff Management',
    description: 'Reset credentials and configure new secure passwords for staff members.',
  },
  {
    id: 'perm-staff-0',
    key: 'staff.manage',
    name: 'Manage Staff (Full Authority)',
    module: 'Staff Management',
    description: 'Comprehensive operational authority over staff accounts, permissions, and directory.',
  },
];

export const PERMISSION_MODULES: PermissionModule[] = [
  'Dashboard',
  'Products',
  'Pricing',
  'Categories',
  'Brands',
  'Inventory',
  'Orders',
  'Shop Counter',
  'Customers',
  'Wholesale Account Management',
  'Promotions',
  'Website Content',
  'Pages & Legal',
  'Finance',
  'Settings',
  'Staff Management',
];

export const ALL_PERMISSION_KEYS = ALL_PERMISSIONS.map((p) => p.key);

// ============================================================================
// SYSTEM PRESETS (ONE-CLICK CONVENIENT CONFIGURATIONS)
// ============================================================================

export const PRESET_FULL_ADMIN: string[] = [...ALL_PERMISSION_KEYS];

export const PRESET_RETAIL_ONLY: string[] = [
  'pricing.retail.view',
  'pricing.retail.edit',
  'products.view',
  'categories.view',
  'brands.view',
  'orders.view',
  'orders.update_status',
  'pos.view',
  'pos.create_sale',
  'pos.apply_discount',
  'pos.view_history',
  'customers.view',
];

export const PRESET_INVENTORY_OPERATOR: string[] = [
  'dashboard.view',
  'inventory.view',
  'inventory.adjust_stock',
  'inventory.stock.edit',
  'inventory.edit_warning',
  'inventory.view_history',
  'inventory.view_shop',
  'inventory.shop_bill',
  'inventory.void_shop_bill',
  'inventory.export',
  'products.view',
  'pricing.retail.view',
];

export const PRESET_ORDER_MANAGER: string[] = [
  'dashboard.view',
  'orders.view',
  'orders.create',
  'orders.update_status',
  'orders.process',
  'orders.print_bills',
  'orders.export',
  'pos.view',
  'pos.create_sale',
  'pos.view_history',
  'customers.view',
  'inquiries.view',
  'inquiries.manage',
  'inventory.view',
  'pricing.retail.view',
];

export const PRESET_CATALOG_CURATOR: string[] = [
  'dashboard.view',
  'products.view',
  'products.create',
  'products.add',
  'products.edit',
  'products.edit_details',
  'products.media',
  'products.sku_barcode',
  'products.import',
  'products.export',
  'pricing.retail.view',
  'pricing.retail.edit',
  'categories.view',
  'categories.create',
  'categories.add',
  'categories.edit',
  'brands.view',
  'brands.create',
  'brands.add',
  'brands.edit',
  'brands.manage',
];

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'preset-full-admin',
    name: 'Full Admin',
    description: 'Unrestricted operational authority across all 16 store modules and administrative functions.',
    permissions: PRESET_FULL_ADMIN,
  },
  {
    id: 'preset-retail-only',
    name: 'Retail Only',
    description: 'Front-desk retail operations: retail pricing, orders, and POS. Wholesale, cost prices, profit margins, and inventory adjustments are strictly hidden.',
    permissions: PRESET_RETAIL_ONLY,
  },
  {
    id: 'preset-inventory-operator',
    name: 'Inventory Operator',
    description: 'Warehouse logistics: stock management, warehouse-to-shop bills, and threshold warnings. Sensitive wholesale and cost pricing are hidden.',
    permissions: PRESET_INVENTORY_OPERATOR,
  },
  {
    id: 'preset-order-manager',
    name: 'Order Manager',
    description: 'Fulfillment operations: order processing, printing commercial invoices, customer inquiries, and status updates.',
    permissions: PRESET_ORDER_MANAGER,
  },
  {
    id: 'preset-catalog-curator',
    name: 'Catalog Curator',
    description: 'Merchandising specialist: product listings, descriptions, media gallery, categories, and brands. Internal costs and profit margins remain hidden.',
    permissions: PRESET_CATALOG_CURATOR,
  },
  {
    id: 'preset-custom',
    name: 'Custom',
    description: 'Tailored granular permissions individually hand-picked for this specific staff account.',
    permissions: [],
  },
];

// Helper: detect if a set of permissions exactly matches one of our known presets
export function detectMatchedPreset(permissions: string[]): string {
  if (!Array.isArray(permissions) || permissions.length === 0) return 'Custom';
  if (permissions.includes('*') || permissions.length >= ALL_PERMISSION_KEYS.length) {
    return 'Full Admin';
  }

  const set = new Set(permissions);
  const matchesPreset = (presetList: string[]) => {
    if (presetList.length !== set.size) return false;
    return presetList.every((k) => set.has(k));
  };

  if (matchesPreset(PRESET_RETAIL_ONLY)) return 'Retail Only';
  if (matchesPreset(PRESET_INVENTORY_OPERATOR)) return 'Inventory Operator';
  if (matchesPreset(PRESET_ORDER_MANAGER)) return 'Order Manager';
  if (matchesPreset(PRESET_CATALOG_CURATOR)) return 'Catalog Curator';

  return 'Custom';
}

// Default permissions for predefined roles
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [...ALL_PERMISSION_KEYS],
  ADMIN: ALL_PERMISSION_KEYS.filter((k) => !k.startsWith('staff.delete')),
  OWNER: [...ALL_PERMISSION_KEYS],
  Owner: [...ALL_PERMISSION_KEYS],
  'Super Admin': [...ALL_PERMISSION_KEYS],
  Admin: ALL_PERMISSION_KEYS.filter((k) => !k.startsWith('staff.delete')),
  Manager: [
    'dashboard.view',
    'dashboard.sales_chart',
    'products.view',
    'products.create',
    'products.add',
    'products.edit',
    'products.edit_details',
    'products.media',
    'products.sku_barcode',
    'products.delete',
    'pricing.retail.view',
    'pricing.retail.edit',
    'pricing.wholesale.view',
    'pricing.wholesale.edit',
    'pricing.super_wholesale.view',
    'pricing.super_wholesale.edit',
    'inventory.view',
    'inventory.adjust_stock',
    'inventory.stock.edit',
    'inventory.edit_warning',
    'inventory.view_history',
    'inventory.view_shop',
    'inventory.shop_bill',
    'inventory.void_shop_bill',
    'orders.view',
    'orders.create',
    'orders.update_status',
    'orders.process',
    'orders.print_bills',
    'pos.view',
    'pos.create_sale',
    'pos.apply_discount',
    'pos.void_sale',
    'pos.view_history',
    'categories.view',
    'categories.create',
    'categories.add',
    'categories.edit',
    'categories.delete',
    'brands.view',
    'brands.create',
    'brands.add',
    'brands.edit',
    'brands.manage',
    'promotions.view',
    'promotions.create',
    'promotions.add',
    'promotions.edit',
    'promotions.delete',
    'promotions.activate',
    'deals.view',
    'deals.manage',
    'customers.view',
    'inquiries.view',
    'inquiries.manage',
    'content.homepage',
    'content.new_arrivals',
    'content.best_sellers',
    'content.banners',
    'content.navigation',
    'content.videos',
    'pages.view',
    'pages.edit',
    'settings.view',
    // strictly NO cost price, profit margin, or staff management
  ],
  'Inventory Manager': PRESET_INVENTORY_OPERATOR,
  'Order Manager': PRESET_ORDER_MANAGER,
  'Product Manager': PRESET_CATALOG_CURATOR,
  'Category Manager': [
    'dashboard.view',
    'categories.view',
    'categories.create',
    'categories.add',
    'categories.edit',
    'categories.delete',
    'brands.view',
    'brands.create',
    'brands.add',
    'brands.edit',
    'brands.manage',
    'products.view',
    'pricing.retail.view',
  ],
  'Promotion Manager': [
    'dashboard.view',
    'promotions.view',
    'promotions.create',
    'promotions.add',
    'promotions.edit',
    'promotions.delete',
    'promotions.activate',
    'deals.view',
    'deals.manage',
    'content.homepage',
    'content.new_arrivals',
    'content.best_sellers',
    'content.banners',
    'products.view',
    'pricing.retail.view',
  ],
  'Customer Manager': [
    'dashboard.view',
    'customers.view',
    'customers.create',
    'customers.edit',
    'customers.suspend',
    'customers.activate',
    'inquiries.view',
    'inquiries.manage',
    'orders.view',
  ],
};

export const PREDEFINED_ROLES: { name: StaffPredefinedRole; description: string }[] = [
  {
    name: 'Manager',
    description: 'Comprehensive operational control over products, stock, orders, and promotions.',
  },
  {
    name: 'Inventory Manager',
    description: 'Warehouse supervisor focused on stock adjustments, thresholds, and inventory audits.',
  },
  {
    name: 'Order Manager',
    description: 'Fulfillment coordinator responsible for order processing, billing, and order status.',
  },
  {
    name: 'Product Manager',
    description: 'Catalog curator in charge of product listings, variants, pricing, and category mapping.',
  },
  {
    name: 'Category Manager',
    description: 'Taxonomy specialist organizing catalog navigation, categories, and merchandising.',
  },
  {
    name: 'Promotion Manager',
    description: 'Marketing operator managing flash sales, homepage banners, and discount campaigns.',
  },
  {
    name: 'Customer Manager',
    description: 'Customer relations specialist reviewing accounts, order history, and status.',
  },
];
