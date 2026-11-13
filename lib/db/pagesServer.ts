import 'server-only';
import { CustomPage } from '@/types/admin';
import { isDbConfigured } from './mysql';
import { getAllPagesFromDb, getPageBySlugFromDb } from './repositories/pages';
import { readPersistentPages } from './pagesStorage';
import { seedPages } from './pages';

export async function getServerPages(): Promise<CustomPage[]> {
  if (isDbConfigured()) {
    try {
      const dbPages = await getAllPagesFromDb();
      if (dbPages && dbPages.length > 0) return dbPages;
    } catch (err) {
      console.warn('MySQL error in getServerPages:', err);
    }
  }
  const persistent = readPersistentPages();
  if (persistent && persistent.length > 0) return persistent;
  return seedPages;
}

export async function getServerPageById(idOrSlug: string): Promise<CustomPage | null> {
  const clean = (idOrSlug || '').trim().toLowerCase().replace(/^\//, '');
  if (isDbConfigured()) {
    try {
      const dbPage = await getPageBySlugFromDb(clean);
      if (dbPage) return dbPage;
    } catch (err) {
      console.warn(`MySQL error in getServerPageById(${clean}):`, err);
    }
  }
  const all = await getServerPages();
  return (
    all.find(
      (p) =>
        (p.id && p.id.toLowerCase() === clean) ||
        (p.slug && p.slug.toLowerCase().replace(/^\//, '') === clean)
    ) || null
  );
}

