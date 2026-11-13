import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { saveMediaBuffer, validateUploadedFileBuffer } from '@/lib/mediaStorage';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['brands.add', 'brands.create', 'brands.edit', 'brands.manage', 'products.add', 'products.edit']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    // Task S10: Upload rate limiting
    const rateLimit = await checkRateLimit(`upload_admin_${session.id || session.email}`, 100, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const formData = await request.formData();
    const file = (formData.get('file') || formData.get('logo') || formData.get('image')) as File | null;

    if (!file || typeof file.size !== 'number' || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No image file provided.' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'brand-logo';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Task S10: Validate buffer, reject SVG/HTML, check magic bytes
    const validation = validateUploadedFileBuffer(buffer, originalName, file.type, {
      allowVideo: false,
      maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
    });

    if (!validation.ok || !validation.format) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid brand image file.' },
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

    const saved = await saveMediaBuffer('brands', uniqueFileName, buffer);

    return NextResponse.json({
      success: true,
      url: saved.publicUrl,
      fileName: uniqueFileName,
      size: saved.size,
      mimeType: format.mime,
    });
  } catch (error: any) {
    console.error('Failed to upload brand logo:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error while uploading brand logo.' },
      { status: 500 }
    );
  }
}
