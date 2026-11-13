import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getPageBySlugFromDb } from '@/lib/db/repositories/pages';
import { readPersistentPages } from '@/lib/db/pagesStorage';
import { getPublicCacheHeaders } from '@/lib/cacheControl';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
    }

    if (isDbConfigured()) {
      try {
        const page = await getPageBySlugFromDb(slug);
        if (page) {
          return NextResponse.json({ success: true, page }, { headers: getPublicCacheHeaders(request) });
        }
      } catch (err: any) {
        console.error('MySQL error in /api/pages/[slug]:', err);
      }
    }

    const pages = readPersistentPages();
    const fallback = pages.find((p) => p.slug.toLowerCase() === slug.toLowerCase());
    if (!fallback) {
      return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, page: fallback }, { headers: getPublicCacheHeaders(request) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
