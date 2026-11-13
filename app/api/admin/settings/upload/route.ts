import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { saveMediaBuffer, validateUploadedFileBuffer } from '@/lib/mediaStorage';
import { getAdminSessionAsync } from '@/lib/db/adminAuth';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to upload site branding.' },
        { status: 401 }
      );
    }

    // Task S10: Upload rate limiting
    const rateLimit = await checkRateLimit(`upload_admin_${session.id || session.email}`, 100, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || typeof file.size !== 'number' || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No image file provided.' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'unnamed-logo';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Task S10: Validate buffer, strictly reject SVG/HTML, check magic bytes, allow ICO for favicon
    const validation = validateUploadedFileBuffer(buffer, originalName, file.type, {
      allowVideo: false,
      allowIco: true,
      maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
    });

    if (!validation.ok || !validation.format) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid branding image file.' },
        { status: 400 }
      );
    }

    const format = validation.format;
    const safeBaseName = path
      .basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const uniqueFileName = `${uniqueSuffix}_${safeBaseName}${format.ext}`;

    const saved = await saveMediaBuffer('branding', uniqueFileName, buffer);

    return NextResponse.json({
      success: true,
      url: saved.publicUrl,
      fileName: uniqueFileName,
      size: saved.size,
      mimeType: format.mime,
    });
  } catch (error: any) {
    console.error('Failed to upload branding image:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error while uploading site branding.' },
      { status: 500 }
    );
  }
}
