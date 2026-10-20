import fs from 'fs';
import path from 'path';
import { AnnouncementItem } from '@/types/admin';
import { seedAnnouncements } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeAnnouncements(raw: AnnouncementItem[]): AnnouncementItem[] {
  const items = (raw || []).map((a) => {
    if (a.text?.includes('Worldwide Shipping') || a.text?.includes('$50')) {
      return { ...a, text: 'Free Nationwide Delivery on Orders Over Rs. 5,000' };
    }
    return a;
  });
  return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export function readPersistentAnnouncements(): AnnouncementItem[] {
  try {
    ensureDataDir();
    if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
      const content = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeAnnouncements(parsed);
      }
    }
  } catch (err) {
    console.warn('Error reading announcements.json:', err);
  }

  const defaults = normalizeAnnouncements(seedAnnouncements);
  try {
    ensureDataDir();
    fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
  } catch {}
  return defaults;
}

export function writePersistentAnnouncements(items: AnnouncementItem[]): void {
  try {
    ensureDataDir();
    const normalized = normalizeAnnouncements(items);
    fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write announcements.json:', err);
    throw new Error('Failed to write announcements to persistent server storage.');
  }
}
