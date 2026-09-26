import { getLocal, setLocal, persistCollection } from './storage';
import { logActivity } from './activity';

export interface AdminLoginSettings {
  id: string;
  logo: string;
  title: string;
  subtitle: string;
  description: string;
  leftLabel: string;
  leftHeading: string;
  leftDescription: string;
  emailLabel: string;
  passwordLabel: string;
  buttonText: string;
  forgotPasswordText: string;
  rememberMeText: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  secondaryTextColor: string;
  accentColor: string;
  buttonColor: string;
  borderColor: string;
  autoPlay: boolean;
  slideDuration: number; // 3000 | 5000 | 7000 | 10000
  transition: 'fade' | 'slide' | 'zoom';
  updatedAt: string;
}

export interface AdminLoginImage {
  id: string;
  imageUrl: string;
  caption?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

const SETTINGS_STORAGE_KEY = 'admin_login_settings';
const IMAGES_STORAGE_KEY = 'admin_login_images';
const IMAGES_INITIALIZED_KEY = 'admin_login_images_initialized';

export const DEFAULT_ADMIN_LOGIN_SETTINGS: AdminLoginSettings = {
  id: 'admin-login-default-settings',
  logo: '',
  title: 'Welcome Back',
  subtitle: 'Admin Control Panel',
  description: 'Sign in to manage your AL-HAMD-MOBILE store.',
  leftLabel: 'AL-HAMD-MOBILE',
  leftHeading: 'Manage Your Store',
  leftDescription: 'Secure access to products, inventory, orders and store management.',
  emailLabel: 'Staff Email',
  passwordLabel: 'Security Password',
  buttonText: 'Sign In',
  forgotPasswordText: 'Forgot security key?',
  rememberMeText: 'Remember administrator session',
  backgroundColor: '#0a0a0a',
  cardColor: '#141414',
  textColor: '#ffffff',
  secondaryTextColor: '#a3a3a3',
  accentColor: '#f59e0b',
  buttonColor: '#ffffff',
  borderColor: '#262626',
  autoPlay: true,
  slideDuration: 5000,
  transition: 'zoom',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_ADMIN_LOGIN_IMAGES: AdminLoginImage[] = [
  {
    id: 'login-img-1',
    imageUrl: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=1200&auto=format&fit=crop',
    caption: 'Premium Mobile Accessories & Protection',
    isActive: true,
    displayOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'login-img-2',
    imageUrl: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?q=80&w=1200&auto=format&fit=crop',
    caption: 'Precision Military-Grade Phone Cases',
    isActive: true,
    displayOrder: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'login-img-3',
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=1200&auto=format&fit=crop',
    caption: 'High-Speed GaN Chargers & Braided Cables',
    isActive: true,
    displayOrder: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'login-img-4',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=1200&auto=format&fit=crop',
    caption: 'Studio Fidelity TWS Wireless Earbuds',
    isActive: true,
    displayOrder: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'login-img-5',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1200&auto=format&fit=crop',
    caption: 'Titanium OLED Smart Watches & Bands',
    isActive: true,
    displayOrder: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

// ============================================================================
// SETTINGS CRUD
// ============================================================================

export function getAdminLoginSettings(): AdminLoginSettings {
  const settings = getLocal<AdminLoginSettings>(SETTINGS_STORAGE_KEY, DEFAULT_ADMIN_LOGIN_SETTINGS);
  return {
    ...DEFAULT_ADMIN_LOGIN_SETTINGS,
    ...(settings || {}),
  };
}

export async function updateAdminLoginSettings(
  updates: Partial<AdminLoginSettings>,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; settings: AdminLoginSettings }> {
  const current = getAdminLoginSettings();
  const merged: AdminLoginSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  setLocal(SETTINGS_STORAGE_KEY, merged);
  await persistCollection(SETTINGS_STORAGE_KEY, [merged]);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Admin Login Appearance',
    target: 'Admin Login Screen',
    details: `Updated appearance parameters: ${Object.keys(updates).join(', ')}`,
  });

  return { success: true, settings: merged };
}

// ============================================================================
// IMAGES CRUD
// ============================================================================

export function getAdminLoginImages(): AdminLoginImage[] {
  // Check whether admin login images collection has been initialized in storage
  const isInitialized = getLocal<boolean>(IMAGES_INITIALIZED_KEY, false);

  if (!isInitialized) {
    // Check if IMAGES_STORAGE_KEY was already present in storage with existing data
    const existing = getLocal<AdminLoginImage[] | null>(IMAGES_STORAGE_KEY, null);
    if (Array.isArray(existing)) {
      setLocal(IMAGES_INITIALIZED_KEY, true);
      return [...existing].sort((a, b) => a.displayOrder - b.displayOrder);
    }

    // First time ever running: seed with DEFAULT_ADMIN_LOGIN_IMAGES and mark initialized
    setLocal(IMAGES_STORAGE_KEY, DEFAULT_ADMIN_LOGIN_IMAGES);
    setLocal(IMAGES_INITIALIZED_KEY, true);
    void persistCollection(IMAGES_STORAGE_KEY, DEFAULT_ADMIN_LOGIN_IMAGES);
    return [...DEFAULT_ADMIN_LOGIN_IMAGES];
  }

  // Once initialized, an empty array [] is completely valid and MUST be respected!
  // Do NOT restore defaults when images is empty!
  const images = getLocal<AdminLoginImage[]>(IMAGES_STORAGE_KEY, []);
  if (!Array.isArray(images)) {
    return [];
  }
  return [...images].sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function addAdminLoginImage(
  data: {
    imageUrl: string;
    caption?: string;
    isActive?: boolean;
    displayOrder?: number;
  },
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; image?: AdminLoginImage; error?: string }> {
  const trimmedUrl = data.imageUrl?.trim();
  if (!trimmedUrl) {
    return { success: false, error: 'Image URL is required.' };
  }

  const images = getAdminLoginImages();
  const nextOrder =
    data.displayOrder !== undefined
      ? data.displayOrder
      : images.length > 0
      ? Math.max(...images.map((img) => img.displayOrder)) + 1
      : 1;

  const newImg: AdminLoginImage = {
    id: `login-img-${Date.now()}`,
    imageUrl: trimmedUrl,
    caption: data.caption?.trim() || '',
    isActive: data.isActive ?? true,
    displayOrder: nextOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [...images, newImg].sort((a, b) => a.displayOrder - b.displayOrder);
  setLocal(IMAGES_INITIALIZED_KEY, true);
  setLocal(IMAGES_STORAGE_KEY, updated);
  await persistCollection(IMAGES_STORAGE_KEY, updated);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Added Admin Login Image',
    target: newImg.caption || 'Slide Image',
    details: `Added new login slider visual: ${newImg.imageUrl}`,
  });

  return { success: true, image: newImg };
}

export async function updateAdminLoginImage(
  id: string,
  updates: Partial<Pick<AdminLoginImage, 'imageUrl' | 'caption' | 'isActive' | 'displayOrder'>>,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const images = getAdminLoginImages();
  const index = images.findIndex((img) => img.id === id);

  if (index === -1) {
    return { success: false, error: 'Login image not found.' };
  }

  const target = images[index];
  const updatedImg: AdminLoginImage = {
    ...target,
    ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl.trim() } : {}),
    ...(updates.caption !== undefined ? { caption: updates.caption.trim() } : {}),
    ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
    ...(updates.displayOrder !== undefined ? { displayOrder: updates.displayOrder } : {}),
    updatedAt: new Date().toISOString(),
  };

  images[index] = updatedImg;
  images.sort((a, b) => a.displayOrder - b.displayOrder);

  setLocal(IMAGES_INITIALIZED_KEY, true);
  setLocal(IMAGES_STORAGE_KEY, images);
  await persistCollection(IMAGES_STORAGE_KEY, images);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Updated Admin Login Image',
    target: target.caption || target.id,
  });

  return { success: true };
}

export async function deleteAdminLoginImage(
  id: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; error?: string }> {
  const images = getAdminLoginImages();
  const filtered = images.filter((img) => img.id !== id);

  setLocal(IMAGES_INITIALIZED_KEY, true);
  setLocal(IMAGES_STORAGE_KEY, filtered);
  await persistCollection(IMAGES_STORAGE_KEY, filtered);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Deleted Admin Login Image',
    target: id,
  });

  return { success: true };
}

export async function toggleAdminLoginImageActive(
  id: string,
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; newStatus?: boolean; error?: string }> {
  const images = getAdminLoginImages();
  const target = images.find((img) => img.id === id);

  if (!target) {
    return { success: false, error: 'Image not found.' };
  }

  const nextStatus = !target.isActive;
  const res = await updateAdminLoginImage(id, { isActive: nextStatus }, operatorEmail);
  if (!res.success) {
    return { success: false, error: res.error };
  }

  return { success: true, newStatus: nextStatus };
}

export async function reorderAdminLoginImages(
  orderedIds: string[],
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean }> {
  const images = getAdminLoginImages();
  const map = new Map(images.map((img) => [img.id, img]));

  const reordered: AdminLoginImage[] = [];
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

  setLocal(IMAGES_INITIALIZED_KEY, true);
  setLocal(IMAGES_STORAGE_KEY, reordered);
  await persistCollection(IMAGES_STORAGE_KEY, reordered);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Reordered Admin Login Images',
    target: 'Admin Slider',
  });

  return { success: true };
}

export async function resetAdminLoginImagesToDefault(
  operatorEmail = 'admin@alhamd.com'
): Promise<{ success: boolean; images: AdminLoginImage[] }> {
  setLocal(IMAGES_INITIALIZED_KEY, true);
  setLocal(IMAGES_STORAGE_KEY, DEFAULT_ADMIN_LOGIN_IMAGES);
  await persistCollection(IMAGES_STORAGE_KEY, DEFAULT_ADMIN_LOGIN_IMAGES);

  await logActivity({
    adminEmail: operatorEmail,
    action: 'Reset Admin Login Images to Default',
    target: 'Admin Slider',
  });

  return { success: true, images: [...DEFAULT_ADMIN_LOGIN_IMAGES] };
}
