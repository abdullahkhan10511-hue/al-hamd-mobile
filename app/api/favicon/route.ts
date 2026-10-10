import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getStoreSettings, resolveFaviconUrl } from '@/lib/db/settings';
import { getStoreSettingsFromDb } from '@/lib/db/repositories/settings';
import { isDbConfigured } from '@/lib/db/mysql';
import { resolveMediaFilePath } from '@/lib/mediaStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MIME_MAP: Record<string, string> = {
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function GET(_request: NextRequest) {
  try {
    let settings = getStoreSettings();
    if (isDbConfigured()) {
      try {
        const dbSettings = await getStoreSettingsFromDb();
        if (dbSettings) {
          settings = dbSettings;
        }
      } catch (err) {
        console.warn('MySQL getStoreSettingsFromDb error in favicon route:', err);
      }
    }

    const resolvedUrl = resolveFaviconUrl(settings.faviconUrl, settings.seo?.faviconUrl);

    // If an uploaded favicon is configured (e.g. /uploads/branding/favicon_...)
    if (resolvedUrl && resolvedUrl.startsWith('/uploads/')) {
      const segments = resolvedUrl.replace(/^\/uploads\//, '').split('/').filter(Boolean);
      const media = await resolveMediaFilePath(segments);
      if (media && fs.existsSync(media.absolutePath)) {
        const buffer = await fs.promises.readFile(media.absolutePath);
        const ext = path.extname(media.absolutePath).toLowerCase();
        const contentType = MIME_MAP[ext] || 'image/png';

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        });
      }
    }

    // Fallback: serve repository default favicon from public/favicon.ico
    const fallbackPath = path.join(process.cwd(), 'public', 'favicon.ico');
    if (fs.existsSync(fallbackPath)) {
      const buffer = await fs.promises.readFile(fallbackPath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/x-icon',
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    return new NextResponse('Favicon not found', { status: 404 });
  } catch (err: any) {
    console.error('Error serving /api/favicon:', err);
    return new NextResponse('Server error serving favicon', { status: 500 });
  }
}
