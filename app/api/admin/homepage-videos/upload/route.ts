import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { saveMediaBuffer, deleteMediaFile, validateUploadedFileBuffer } from '@/lib/mediaStorage';
import { getAdminSessionAsync } from '@/lib/db/adminAuth';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';
import { HERO_MEDIA_LIMITS, isAnimatedWebpBuffer } from '@/lib/heroMedia';

const MAX_IMAGE_SIZE_BYTES = HERO_MEDIA_LIMITS.image.maxBytes; // 3 MB
const MAX_GIF_SIZE_BYTES = HERO_MEDIA_LIMITS.animated.maxBytes; // 6 MB
const MAX_VIDEO_SIZE_BYTES = HERO_MEDIA_LIMITS.video.maxBytes; // 15 MB

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to upload homepage media.' },
        { status: 401 }
      );
    }

    // Task S10: Upload rate limiting
    const rateLimit = await checkRateLimit(`upload_admin_${session.id || session.email}`, 50, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || typeof file.size !== 'number' || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No media file provided.' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'homepage_hero.mp4';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Task S10 & H1.6: Validate buffer, reject SVG/HTML/scripts, verify binary magic bytes
    const validation = validateUploadedFileBuffer(buffer, originalName, file.type, {
      allowVideo: true,
      maxSizeBytes: MAX_VIDEO_SIZE_BYTES,
    });

    if (!validation.ok || !validation.format) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid file format. Only approved images (JPG, PNG, WebP, AVIF, GIF) and videos (MP4, WebM) are allowed.' },
        { status: 400 }
      );
    }

    const format = validation.format;
    const isVideo = format.type === 'video';
    const isAnimatedWebp = format.ext === '.webp' && isAnimatedWebpBuffer(buffer);
    const isGif = format.ext === '.gif' || format.mime === 'image/gif' || isAnimatedWebp;

    // Enforce tier-specific size limits (Picture 3MB, GIF 6MB, Video 15MB)
    const mediaCategory = isVideo ? 'video' : isGif ? 'animated' : 'image';
    const limits = HERO_MEDIA_LIMITS[mediaCategory];

    if (buffer.length > limits.maxBytes) {
      const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `${limits.title} file is too large (${sizeMb} MB). Maximum allowed size is ${limits.maxLabel}. Recommended: under ${limits.recommendedLabel}.`,
        },
        { status: 400 }
      );
    }

    const warning =
      buffer.length > limits.recommendedBytes
        ? `This file will load slowly. Recommended: under ${limits.recommendedLabel}${isVideo ? ' (MP4 720p, 8-12s, no audio)' : ''}.`
        : undefined;

    const safeBaseName = path
      .basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const uniqueFileName = `${uniqueSuffix}_${safeBaseName}${format.ext}`;

    const saved = await saveMediaBuffer('videos', uniqueFileName, buffer);

    // Clean up previous media file if requested
    const previousUrl = formData.get('previousUrl') as string | null;
    if (previousUrl && previousUrl.startsWith('/uploads/videos/')) {
      const oldFileName = path.basename(previousUrl);
      if (oldFileName && oldFileName !== uniqueFileName) {
        await deleteMediaFile('videos', oldFileName);
      }
    }

    const mediaType: 'video' | 'animated' | 'image' = mediaCategory;
    const effectiveMime = isAnimatedWebp ? 'image/webp;animated' : format.mime;

    return NextResponse.json({
      success: true,
      url: saved.publicUrl,
      fileName: uniqueFileName,
      size: saved.size,
      mimeType: effectiveMime,
      mediaType,
      warning,
    });
  } catch (error: any) {
    console.error('Homepage media upload error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server failed to process uploaded media.' },
      { status: 500 }
    );
  }
}
