import { getLocal, setLocal, persistCollection } from './storage';
import { logActivity } from './activity';

export type MediaTransitionType = 'fade' | 'slide' | 'zoom' | 'crossfade';

export interface LoginPageMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  title: string;
  caption?: string;
  productName?: string;
  priceTag?: string;
  transition?: MediaTransitionType | 'default';
  duration?: number; // Override duration in milliseconds
  autoPlay?: boolean; // For videos
  loop?: boolean; // For videos
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPageSettings {
  id: string;
  // Layout Controls
  showMediaSection: boolean;
  mediaPosition: 'left' | 'right';
  mediaFit: 'cover' | 'contain';
  overlayEnabled: boolean;
  backgroundStyle: 'dark' | 'glass' | 'neutral' | 'accent';
  
  // Branding Controls
  showLogo: boolean;
  logoUrl: string;
  logoSize: 'sm' | 'md' | 'lg';
  brandName: string;
  tagline: string;
  
  // Content & Text Controls
  badgeText: string;
  mainHeading: string;
  subtitle: string;
  buttonText: string;
  identifierLabel?: string;
  identifierPlaceholder?: string;
  passwordLabel?: string;
  forgotPasswordText?: string;
  createAccountHeading: string;
  createAccountSubtitle: string;
  createAccountButtonText?: string;
  footerNotice: string;
  features: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
  }>;
  
  // Animation & Slideshow Controls
  defaultTransition: MediaTransitionType;
  slideDuration: number; // in milliseconds, e.g. 3000, 5000, 7000, 10000
  autoPlaySlideshow: boolean;
  loopVideos: boolean;

  // Colors & Theme Customization
  pageBgColor?: string;
  cardBgColor?: string;
  headingColor?: string;
  textColor?: string;
  accentColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  inputBgColor?: string;
  inputBorderColor?: string;

  // Layout & Sizing
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  buttonHeight?: 'sm' | 'md' | 'lg';
  inputHeight?: 'sm' | 'md' | 'lg';
  
  updatedAt: string;
}

export const SETTINGS_STORAGE_KEY = 'login_page_settings';
export const MEDIA_STORAGE_KEY = 'login_page_media';
export const MEDIA_INITIALIZED_KEY = 'login_page_media_initialized';

export const DEFAULT_LOGIN_PAGE_SETTINGS: LoginPageSettings = {
  id: 'customer-login-settings',
  showMediaSection: true,
  mediaPosition: 'left',
  mediaFit: 'cover',
  overlayEnabled: true,
  backgroundStyle: 'dark',
  showLogo: true,
  logoUrl: '',
  logoSize: 'md',
  brandName: 'AL-HAMD MOBILE',
  tagline: 'Premium Mobile Accessories',
  badgeText: 'Official Customer Portal',
  mainHeading: 'Welcome to AL-HAMD',
  subtitle: 'Sign in to track orders, manage your wishlist, and submit verified reviews.',
  buttonText: 'Sign In',
  identifierLabel: 'Email Address or Shop Name',
  identifierPlaceholder: 'you@example.com or Shop Name',
  passwordLabel: 'Password',
  forgotPasswordText: 'Forgot Password?',
  createAccountHeading: 'Create Customer Account',
  createAccountSubtitle: 'Join AL-HAMD for seamless ordering, cart preservation, and priority support.',
  createAccountButtonText: 'Create Account',
  footerNotice: '100% Genuine Certified Accessories • Nationwide Pakistan Delivery',
  pageBgColor: '#0a0a0a',
  cardBgColor: '#ffffff',
  headingColor: '#0a0a0a',
  textColor: '#737373',
  accentColor: '#0a0a0a',
  buttonBgColor: '#0a0a0a',
  buttonTextColor: '#ffffff',
  inputBgColor: '#fafafa',
  inputBorderColor: '#e5e5e5',
  borderRadius: '2xl',
  buttonHeight: 'md',
  inputHeight: 'md',
  features: [
    {
      id: 'feat-1',
      icon: 'Smartphone',
      title: 'Smartphones & Cases',
      description: 'Drop-tested shockproof protection',
    },
    {
      id: 'feat-2',
      icon: 'Zap',
      title: 'GaN Fast Chargers',
      description: 'Up to 100W PD & SuperVOOC speeds',
    },
    {
      id: 'feat-3',
      icon: 'Headphones',
      title: 'TWS Earbuds & Audio',
      description: 'Studio bass and active noise cancelling',
    },
    {
      id: 'feat-4',
      icon: 'Watch',
      title: 'Smart Watches & Bands',
      description: 'AMOLED displays & precision fitness',
    },
  ],
  defaultTransition: 'zoom',
  slideDuration: 5000,
  autoPlaySlideshow: true,
  loopVideos: true,
  updatedAt: '2026-03-01T00:00:00.000Z',
};

export const DEFAULT_LOGIN_PAGE_MEDIA: LoginPageMediaItem[] = [
  {
    id: 'login-media-1',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=1200&auto=format&fit=crop',
    title: 'Precision Mobile Accessories',
    caption: 'Experience unmatched durability with our certified premium phone gear.',
    productName: 'Signature Protection Collection',
    priceTag: 'Rs. 2,499',
    transition: 'default',
    isActive: true,
    displayOrder: 1,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'login-media-2',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop',
    title: 'High-Speed GaN Charging',
    caption: 'Next-gen gallium nitride power adapters delivering ultra-fast charging.',
    productName: '65W GaN Turbo Adapter',
    priceTag: 'Rs. 3,850',
    transition: 'slide',
    isActive: true,
    displayOrder: 2,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'login-media-3',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=1200&auto=format&fit=crop',
    title: 'Audiophile TWS Audio',
    caption: 'Hybrid active noise cancellation with crystal clear calling mics.',
    productName: 'Acoustic Pro Wireless',
    priceTag: 'Rs. 5,999',
    transition: 'fade',
    isActive: true,
    displayOrder: 3,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'login-media-4',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1200&auto=format&fit=crop',
    title: 'Titanium Smart Wearables',
    caption: 'Continuous health monitoring and HD AMOLED display in aerospace titanium.',
    productName: 'Smart Titanium Watch S',
    priceTag: 'Rs. 7,499',
    transition: 'crossfade',
    isActive: true,
    displayOrder: 4,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
];

// ============================================================================
// SETTINGS CRUD
// ============================================================================

export function getLoginPageSettings(): LoginPageSettings {
  const settings = getLocal<LoginPageSettings>(SETTINGS_STORAGE_KEY, DEFAULT_LOGIN_PAGE_SETTINGS);
  return {
    ...DEFAULT_LOGIN_PAGE_SETTINGS,
    ...(settings || {}),
  };
}

export async function fetchLoginPageSettings(): Promise<LoginPageSettings> {
  if (typeof window === 'undefined') {
    return getLoginPageSettings();
  }
  try {
    const res = await fetch('/api/admin/login-page/settings', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const settingsObj = data?.settings && typeof data.settings === 'object' ? data.settings : data;
      if (settingsObj && typeof settingsObj === 'object' && !Array.isArray(settingsObj)) {
        const merged = { ...DEFAULT_LOGIN_PAGE_SETTINGS, ...settingsObj };
        setLocal(SETTINGS_STORAGE_KEY, merged, true);
        return merged;
      }
    }
  } catch (e) {
    // Graceful silent fallback without spamming the console
  }
  return getLoginPageSettings();
}

export async function updateLoginPageSettings(
  updates: Partial<LoginPageSettings>,
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean; settings: LoginPageSettings; error?: string }> {
  try {
    const current = getLoginPageSettings();
    const merged: LoginPageSettings = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setLocal(SETTINGS_STORAGE_KEY, merged);
    await persistCollection(SETTINGS_STORAGE_KEY, [merged]);

    // Also notify server API for disk persistence if in browser
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/admin/login-page/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
      } catch {
        // Local persistence already succeeded
      }
    }

    await logActivity({
      adminEmail: operatorEmail,
      action: 'Updated Login Page Settings',
      target: 'Customer Login Page',
      details: `Updated settings fields: ${Object.keys(updates).join(', ')}`,
    });

    return { success: true, settings: merged };
  } catch (err: any) {
    return { success: false, settings: getLoginPageSettings(), error: err.message || 'Failed to update settings' };
  }
}

// ============================================================================
// MEDIA CRUD
// ============================================================================

export function getLoginPageMedia(): LoginPageMediaItem[] {
  const isInitialized = getLocal<boolean>(MEDIA_INITIALIZED_KEY, false);

  if (!isInitialized) {
    const existing = getLocal<LoginPageMediaItem[] | null>(MEDIA_STORAGE_KEY, null);
    if (Array.isArray(existing)) {
      setLocal(MEDIA_INITIALIZED_KEY, true, true);
      return [...existing].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }

    setLocal(MEDIA_STORAGE_KEY, DEFAULT_LOGIN_PAGE_MEDIA, true);
    setLocal(MEDIA_INITIALIZED_KEY, true, true);
    void persistCollection(MEDIA_STORAGE_KEY, DEFAULT_LOGIN_PAGE_MEDIA);
    return [...DEFAULT_LOGIN_PAGE_MEDIA];
  }

  const media = getLocal<LoginPageMediaItem[]>(MEDIA_STORAGE_KEY, []);
  if (!Array.isArray(media)) {
    return [];
  }
  return [...media].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export async function fetchLoginPageMedia(): Promise<LoginPageMediaItem[]> {
  if (typeof window === 'undefined') {
    return getLoginPageMedia();
  }
  try {
    const res = await fetch('/api/admin/login-page/media', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : null);
      if (Array.isArray(list)) {
        setLocal(MEDIA_STORAGE_KEY, list, true);
        setLocal(MEDIA_INITIALIZED_KEY, true, true);
        return [...list].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      }
    }
  } catch (e) {
    // Graceful silent fallback without spamming the console
  }
  return getLoginPageMedia();
}

export async function addLoginPageMedia(
  data: Omit<LoginPageMediaItem, 'id' | 'createdAt' | 'updatedAt'>,
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean; item?: LoginPageMediaItem; error?: string }> {
  const trimmedUrl = data.url?.trim();
  if (!trimmedUrl) {
    return { success: false, error: 'Media URL or uploaded file is required.' };
  }

  const list = getLoginPageMedia();
  const nextOrder =
    data.displayOrder !== undefined
      ? data.displayOrder
      : list.length > 0
      ? Math.max(...list.map((m) => m.displayOrder || 0)) + 1
      : 1;

  const newItem: LoginPageMediaItem = {
    ...data,
    id: `login-media-${Date.now()}`,
    url: trimmedUrl,
    title: data.title?.trim() || 'Product Showcase',
    caption: data.caption?.trim() || '',
    productName: data.productName?.trim() || '',
    priceTag: data.priceTag?.trim() || '',
    type: data.type || (trimmedUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i) ? 'video' : 'image'),
    transition: data.transition || 'default',
    duration: data.duration,
    autoPlay: data.autoPlay ?? true,
    loop: data.loop ?? true,
    isActive: data.isActive ?? true,
    displayOrder: nextOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [...list, newItem].sort((a, b) => a.displayOrder - b.displayOrder);
  setLocal(MEDIA_STORAGE_KEY, updated);
  await persistCollection(MEDIA_STORAGE_KEY, updated);

  // Sync to server disk
  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/admin/login-page/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', items: updated }),
      });
    } catch {}
  }

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Added Login Page Media',
    target: newItem.title || newItem.id,
    details: `Added new ${newItem.type}: ${newItem.url}`,
  });

  return { success: true, item: newItem };
}

export async function updateLoginPageMedia(
  id: string,
  updates: Partial<Omit<LoginPageMediaItem, 'id' | 'createdAt'>>,
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean; item?: LoginPageMediaItem; error?: string }> {
  const list = getLoginPageMedia();
  const index = list.findIndex((m) => m.id === id);

  if (index === -1) {
    return { success: false, error: 'Media item not found.' };
  }

  const target = list[index];
  const updatedItem: LoginPageMediaItem = {
    ...target,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  list[index] = updatedItem;
  list.sort((a, b) => a.displayOrder - b.displayOrder);

  setLocal(MEDIA_STORAGE_KEY, list);
  await persistCollection(MEDIA_STORAGE_KEY, list);

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/admin/login-page/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', items: list }),
      });
    } catch {}
  }

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Login Page Media',
    target: target.title || target.id,
    details: `Updated fields: ${Object.keys(updates).join(', ')}`,
  });

  return { success: true, item: updatedItem };
}

export async function deleteLoginPageMedia(
  id: string,
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean; error?: string }> {
  const list = getLoginPageMedia();
  const target = list.find((m) => m.id === id);
  const filtered = list.filter((m) => m.id !== id);

  setLocal(MEDIA_INITIALIZED_KEY, true);
  setLocal(MEDIA_STORAGE_KEY, filtered);
  await persistCollection(MEDIA_STORAGE_KEY, filtered);

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/admin/login-page/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', items: filtered }),
      });
    } catch {}
  }

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Deleted Login Page Media',
    target: target?.title || id,
  });

  return { success: true };
}

export async function toggleLoginPageMediaActive(
  id: string,
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean; newStatus?: boolean; error?: string }> {
  const list = getLoginPageMedia();
  const target = list.find((m) => m.id === id);

  if (!target) {
    return { success: false, error: 'Media item not found.' };
  }

  const nextStatus = !target.isActive;
  const res = await updateLoginPageMedia(id, { isActive: nextStatus }, operatorEmail);
  if (!res.success) {
    return { success: false, error: res.error };
  }

  return { success: true, newStatus: nextStatus };
}

export async function reorderLoginPageMedia(
  orderedIds: string[],
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean }> {
  const list = getLoginPageMedia();
  const map = new Map(list.map((item) => [item.id, item]));

  const reordered: LoginPageMediaItem[] = [];
  orderedIds.forEach((id, idx) => {
    const item = map.get(id);
    if (item) {
      reordered.push({
        ...item,
        displayOrder: idx + 1,
        updatedAt: new Date().toISOString(),
      });
      map.delete(id);
    }
  });

  // Append any remainder
  map.forEach((item) => {
    reordered.push(item);
  });

  setLocal(MEDIA_STORAGE_KEY, reordered);
  await persistCollection(MEDIA_STORAGE_KEY, reordered);

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/admin/login-page/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', items: reordered }),
      });
    } catch {}
  }

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Reordered Login Page Media',
    target: 'Media Showcase',
  });

  return { success: true };
}

export async function resetLoginPageToDefault(
  operatorEmail = 'admin@alhamdmobile.com'
): Promise<{ success: boolean; settings: LoginPageSettings; media: LoginPageMediaItem[] }> {
  setLocal(SETTINGS_STORAGE_KEY, DEFAULT_LOGIN_PAGE_SETTINGS);
  setLocal(MEDIA_STORAGE_KEY, DEFAULT_LOGIN_PAGE_MEDIA);
  setLocal(MEDIA_INITIALIZED_KEY, true);
  await persistCollection(SETTINGS_STORAGE_KEY, [DEFAULT_LOGIN_PAGE_SETTINGS]);
  await persistCollection(MEDIA_STORAGE_KEY, DEFAULT_LOGIN_PAGE_MEDIA);

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/admin/login-page/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_LOGIN_PAGE_SETTINGS),
      });
      await fetch('/api/admin/login-page/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', items: DEFAULT_LOGIN_PAGE_MEDIA }),
      });
    } catch {}
  }

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Reset Login Page to Default',
    target: 'Customer Login Page',
  });

  return {
    success: true,
    settings: DEFAULT_LOGIN_PAGE_SETTINGS,
    media: DEFAULT_LOGIN_PAGE_MEDIA,
  };
}

