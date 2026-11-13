import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { downloadAndPersistRemoteMedia } from '@/lib/mediaStorage';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  let rawUrl = '';
  try {
    const auth = await requireAdmin(request, ['products.add', 'products.edit', 'products.manage']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    // Rate limit: 20 per hour per admin
    // Bulk import rate limit: 300 requests per hour per admin
    const rateCheck = await checkRateLimit(`import_url_admin_${session.id}`, 300, 3600000);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds, 'Too many media import attempts.');
    }

    const body = await request.json().catch(() => ({}));
    rawUrl = (body.url || '').trim();
    const requestedFolder = body.folder === 'videos' ? 'videos' : 'products';

    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing media URL.' },
        { status: 400 }
      );
    }

    // If it's already an internal persistent uploads path, return it directly
    if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
      const normalizedUrl = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
      return NextResponse.json({
        success: true,
        item: {
          id: `med-int-${Date.now()}`,
          url: normalizedUrl,
          type: normalizedUrl.includes('/videos/') || normalizedUrl.endsWith('.mp4') ? 'video' : 'image',
          name: normalizedUrl.split('/').pop() || 'Product Media',
          size: 0,
        },
      });
    }

    // Execute secure download, SSRF validation, format check, and persistent storage
    const result = await downloadAndPersistRemoteMedia({
      url: rawUrl,
      folder: requestedFolder,
    });

    return NextResponse.json({
      success: true,
      item: {
        id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        url: result.publicUrl,
        type: result.type,
        name: result.fileName,
        size: result.size,
        originalUrl: result.originalUrl,
      },
    });
  } catch (err: any) {
    console.error('[SSRF MEDIA IMPORT REJECTED]', err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Could not import this URL.',
        url: rawUrl,
      },
      { status: 400 }
    );
  }
}
