import fs from 'fs';
import path from 'path';
import { HomepageVideo } from '@/types/admin';
import { seedHomepageVideos } from './homepageVideos';

/**
 * Server Disk Storage & Fallback Cache for Homepage Videos.
 *
 * PRIMARY / PRODUCTION STORE: MySQL `homepage_videos` table via `lib/db/repositories/homepageVideos.ts`.
 * SECONDARY / FALLBACK STORE: `data/homepage-videos.json` for offline resilience and local dev caching.
 */
const DATA_DIR = path.join(process.cwd(), 'data');
const VIDEOS_FILE = path.join(DATA_DIR, 'homepage-videos.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sortDeterministic(list: HomepageVideo[]): HomepageVideo[] {
  return list.sort((a, b) => {
    const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.id || '').localeCompare(b.id || '');
  });
}

export function readPersistentHomepageVideos(): HomepageVideo[] {
  try {
    ensureDataDir();
    if (fs.existsSync(VIDEOS_FILE)) {
      const content = fs.readFileSync(VIDEOS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortDeterministic(parsed);
      }
    }
  } catch (err) {
    console.warn('Error reading homepage-videos.json:', err);
  }

  const defaults = sortDeterministic([...seedHomepageVideos]);
  try {
    ensureDataDir();
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
  } catch {}
  return defaults;
}

export function writePersistentHomepageVideos(items: HomepageVideo[]): void {
  try {
    ensureDataDir();
    const sorted = sortDeterministic(items);
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(sorted, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write homepage-videos.json:', err);
    throw new Error('Failed to write homepage videos to persistent server storage.');
  }
}

export function savePersistentHomepageVideo(item: HomepageVideo): HomepageVideo {
  const current = readPersistentHomepageVideos();
  const idx = current.findIndex((v) => v.id === item.id);
  const now = new Date().toISOString();

  let savedItem: HomepageVideo;
  if (idx >= 0) {
    savedItem = {
      ...current[idx],
      ...item,
      updatedAt: now,
    };
    current[idx] = savedItem;
  } else {
    savedItem = {
      ...item,
      id: item.id || `video-${Date.now()}`,
      displayOrder: item.displayOrder || current.length + 1,
      createdAt: item.createdAt || now,
      updatedAt: now,
    };
    current.push(savedItem);
  }

  writePersistentHomepageVideos(current);
  return savedItem;
}

export function deletePersistentHomepageVideo(id: string): boolean {
  const current = readPersistentHomepageVideos();
  const filtered = current.filter((v) => v.id !== id);
  if (filtered.length === current.length) return false;

  filtered.forEach((v, i) => {
    v.displayOrder = i + 1;
  });

  writePersistentHomepageVideos(filtered);
  return true;
}

export function reorderPersistentHomepageVideos(orderedIds: string[]): HomepageVideo[] {
  const current = readPersistentHomepageVideos();
  const map = new Map(current.map((v) => [v.id, v]));
  const reordered: HomepageVideo[] = [];

  orderedIds.forEach((id, idx) => {
    const itm = map.get(id);
    if (itm) {
      itm.displayOrder = idx + 1;
      itm.updatedAt = new Date().toISOString();
      reordered.push(itm);
      map.delete(id);
    }
  });

  map.forEach((itm) => {
    itm.displayOrder = reordered.length + 1;
    reordered.push(itm);
  });

  writePersistentHomepageVideos(reordered);
  return reordered;
}
