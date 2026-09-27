import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getPageBySlugFromDb } from '@/lib/db/repositories/pages';
import { seedPages } from '@/lib/db/pages';

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
        if (!page) {
          return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, page });
      } catch (err: any) {
        console.error('MySQL error in /api/pages/[slug]:', err);
        return NextResponse.json({ success: false, error: 'Failed to fetch page' }, { status: 500 });
      }
    }

    const fallback = seedPages.find((p) => p.slug.toLowerCase() === slug.toLowerCase());
    if (!fallback) {
      return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, page: fallback });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
