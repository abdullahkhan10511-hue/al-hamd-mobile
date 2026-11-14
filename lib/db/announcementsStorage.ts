import 'server-only';
import fs from 'fs';
import path from 'path';
import { AnnouncementItem } from '@/types/admin';
import { seedAnnouncements } from './seed';
import { getDataFilePath, writeAtomicJsonFile } from '@/lib/storage/dataDir';

function getAnnouncementsFilePath(): string {
  return getDataFilePath('announcements.json');
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
  const filePath = getAnnouncementsFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
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
    writeAtomicJsonFile(filePath, defaults);
  } catch {}
  return defaults;
}

export function writePersistentAnnouncements(items: AnnouncementItem[]): void {
  try {
    const filePath = getAnnouncementsFilePath();
    const normalized = normalizeAnnouncements(items);
    writeAtomicJsonFile(filePath, normalized);
  } catch (err) {
    console.error('Failed to write announcements.json:', err);
    throw new Error('Failed to write announcements to persistent server storage.');
  }
}
