import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { saveMediaBuffer, validateUploadedFileBuffer } from '@/lib/mediaStorage';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

interface UploadedMediaItemResult {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string;
  size: number;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ['products.add', 'products.edit', 'products.manage']);
    if (!auth.ok) return auth.response;
    const session = auth.session;

    // Task S10: Enforce upload rate limit (100 uploads / hour per admin user)
    const rateLimitKey = `upload_admin_${session.id || session.email}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 100, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle JSON remote URL import payload
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const rawUrl = (body.url || '').trim();
      const rawUrls: string[] = Array.isArray(body.urls) ? body.urls : (rawUrl ? [rawUrl] : []);

      if (rawUrls.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No media URL provided in JSON body.' },
          { status: 400 }
        );
      }

      const { downloadAndPersistRemoteMedia } = await import('@/lib/mediaStorage');
      const results: UploadedMediaItemResult[] = [];
      const errors: string[] = [];

      for (const u of rawUrls) {
        if (!u || !u.trim()) continue;
        try {
          const persisted = await downloadAndPersistRemoteMedia({
            url: u.trim(),
            folder: body.folder === 'videos' ? 'videos' : 'products',
          });
          results.push({
            id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            url: persisted.publicUrl,
            type: persisted.type,
            name: persisted.fileName,
            size: persisted.size,
          });
        } catch (downloadErr: any) {
          errors.push(`Failed to import "${u}": ${downloadErr?.message || downloadErr}`);
        }
      }

      if (results.length === 0 && errors.length > 0) {
        return NextResponse.json({ success: false, error: errors.join('; ') }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        items: results,
        url: results[0]?.url,
        type: results[0]?.type,
        name: results[0]?.name,
        size: results[0]?.size,
        warnings: errors.length > 0 ? errors : undefined,
      });
    }

    const formData = await request.formData();
    // Gather all files from 'files' or 'file'
    const files: File[] = [];
    const multiFiles = formData.getAll('files') as File[];
    if (multiFiles && multiFiles.length > 0) {
      files.push(...multiFiles.filter((f) => f && typeof f.size === 'number' && f.size > 0));
    }
    const singleFile = formData.get('file') as File | null;
    if (singleFile && typeof singleFile.size === 'number' && singleFile.size > 0) {
      if (!files.some((f) => f.name === singleFile.name && f.size === singleFile.size)) {
        files.push(singleFile);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No media file provided.' },
        { status: 400 }
      );
    }

    const results: UploadedMediaItemResult[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const originalName = file.name || 'unnamed-file';
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Task S10: Rigorous buffer validation, magic bytes, SVG rejection, dangerous extension rejection
      const validation = validateUploadedFileBuffer(buffer, originalName, file.type, {
        allowVideo: true,
        maxSizeBytes: MAX_VIDEO_SIZE_BYTES,
      });

      if (!validation.ok || !validation.format) {
        errors.push(`"${originalName}": ${validation.error || 'Invalid file format.'}`);
        continue;
      }

      const format = validation.format;
      const isVideo = format.type === 'video';

      // Specific size constraint check
      if (!isVideo && buffer.length > MAX_IMAGE_SIZE_BYTES) {
        errors.push(
          `Image "${originalName}" is too large (${(buffer.length / (1024 * 1024)).toFixed(1)}MB). Maximum allowed image size is 15MB.`
        );
        continue;
      }

      // Safe clean filename with cryptographically random suffix
      const safeBaseName = path
        .basename(originalName, path.extname(originalName))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 40);
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const uniqueFileName = `${uniqueSuffix}_${safeBaseName}${format.ext}`;

      const targetFolder = isVideo ? 'videos' : 'products';
      const saved = await saveMediaBuffer(targetFolder, uniqueFileName, buffer);

      results.push({
        id: `media-${uniqueSuffix}`,
        url: saved.publicUrl,
        type: format.type,
        name: originalName,
        size: saved.size,
      });
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.join('; ') },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      items: results,
      // If single file uploaded, include top-level convenience properties
      url: results[0]?.url,
      type: results[0]?.type,
      name: results[0]?.name,
      size: results[0]?.size,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Product media upload error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server failed to process uploaded product media.' },
      { status: 500 }
    );
  }
}
