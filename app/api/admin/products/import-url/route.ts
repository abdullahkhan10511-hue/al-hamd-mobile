import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { downloadAndPersistRemoteMedia } from '@/lib/mediaStorage';

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    const authHeader = request.headers.get('authorization');

    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin credentials required to import media.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawUrl = (body.url || '').trim();
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
    console.error('Remote media import error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to import remote media.' },
      { status: 400 }
    );
  }
}
