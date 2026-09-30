import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { saveMediaBuffer } from '@/lib/mediaStorage';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getSessionUser(request: NextRequest): { email: string; role: string } | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (!cookieVal) return null;

  let raw = cookieVal;
  for (let i = 0; i < 3; i++) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email && parsed.status !== 'inactive') {
        return parsed;
      }
    } catch {
      try {
        raw = decodeURIComponent(raw);
      } catch {
        break;
      }
    }
  }

  return null;
}

// Allowed MIME types and extensions
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
]);

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm']);

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.php', '.phtml', '.js', '.jsx', '.ts', '.tsx',
  '.pl', '.py', '.rb', '.cgi', '.jar', '.vbs', '.scr', '.msi', '.com'
]);

interface UploadedMediaItemResult {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string;
  size: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');

    // Admin authentication check (cookie or bearer)
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to upload product media.' },
        { status: 401 }
      );
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
      const ext = path.extname(originalName).toLowerCase();
      const mimeType = (file.type || '').toLowerCase();

      // Security check: ban executable / script files
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        errors.push(`Upload rejected for "${originalName}": executable and script files are strictly prohibited.`);
        continue;
      }

      const isImage = ALLOWED_IMAGE_MIMES.has(mimeType) || ALLOWED_IMAGE_EXTS.has(ext);
      const isVideo = ALLOWED_VIDEO_MIMES.has(mimeType) || ALLOWED_VIDEO_EXTS.has(ext);

      if (!isImage && !isVideo) {
        errors.push(
          `"${originalName}" has an unsupported format. Allowed image formats: JPG, JPEG, PNG, WEBP. Allowed video formats: MP4, WEBM.`
        );
        continue;
      }

      // Size checks
      if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) {
        errors.push(
          `Image "${originalName}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed image size is 15MB.`
        );
        continue;
      }

      if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
        errors.push(
          `Video "${originalName}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed video size is 100MB.`
        );
        continue;
      }

      // Clean filename
      const safeBaseName = path
        .basename(originalName, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 40);
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const uniqueFileName = `${uniqueSuffix}_${safeBaseName}${ext}`;

      // Write file via persistent storage manager
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const saved = await saveMediaBuffer('products', uniqueFileName, buffer);

      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';

      results.push({
        id: `media-${uniqueSuffix}`,
        url: saved.publicUrl,
        type: mediaType,
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
