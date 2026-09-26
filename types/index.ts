export interface ProductVariant {
  id: string;
  name: string;
  options: string[]; // e.g., ["S", "M", "L", "XL"] or ["Midnight Black", "Silver", "Alpine Gold"]
}

export interface ProductReview {
  id: string;
  author: string;
  authorEmail?: string;
  customerId?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
}

export interface BulkPricingRule {
  id?: string;
  minQty: number;
  maxQty: number;
  discountPercentage: number;
}

export interface ProductMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  name?: string;
  size?: number;
}

export interface ProductModelVariant {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  wholesalePrice?: number;
  stock?: number;
  sku?: string;
  isActive: boolean;
  images?: string[];
  videos?: string[];
}

export interface ProductColorVariant {
  id?: string;
  name: string;
  hex?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description: string;
  longDescription?: string;
  price: number;
  compareAtPrice?: number;
  wholesalePrice?: number;
  discountPercentage?: number;
  images: string[];
  videos?: string[];
  media?: ProductMediaItem[];
  category: string;
  categorySlug: string;
  brand: string;
  rating: number;
  reviewCount: number;
  stock: number;
  sku?: string;
  lowStockThreshold?: number;
  /** @deprecated Legacy bulk pricing field - no longer used for pricing or orders */
  bulkPricing?: BulkPricingRule[];
  status?: 'active' | 'archived' | 'inactive';
  isNew?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isSale?: boolean;
  featured?: boolean;
  trending?: boolean;
  tags?: string[];
  enableModelSelection?: boolean;
  models?: ProductModelVariant[];
  enableColorSelection?: boolean;
  colors?: ProductColorVariant[];
  variants?: {
    sizes?: string[];
    colors?: { name: string; hex: string }[];
  };
  specifications?: Record<string, string>;
  features?: string[];
  shippingInfo?: string;
  returnsInfo?: string;
  reviews?: ProductReview[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
  productCount: number;
  status: 'active' | 'archived' | 'inactive';
  isActive?: boolean;
  featured?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedModel?: string;
  selectedModelId?: string;
  selectedPrice?: number;
  selectedImage?: string;
}

export interface FilterState {
  category: string;
  brand: string[];
  priceRange: [number, number];
  rating: number | null;
  inStockOnly: boolean;
  sortBy: 'featured' | 'newest' | 'best-selling' | 'price-low' | 'price-high' | 'rating';
  searchQuery: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  publishedAt: string;
  readTime: string;
  image: string;
  tags: string[];
}

export interface OrderCustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  shippingMethod: 'standard' | 'express';
  paymentMethod: 'credit-card' | 'apple-pay' | 'cod';
}
