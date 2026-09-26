import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

// Allowed MIME types and size limits
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.php', '.phtml', '.js', '.jsx', '.ts', '.tsx',
  '.pl', '.py', '.rb', '.cgi', '.jar', '.vbs', '.scr', '.msi', '.com'
]);

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to upload media.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No media file provided.' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'unnamed-file';
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    // Security check: ban executable / script files
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: `Upload rejected: executable and script files (${ext}) are strictly prohibited.` },
        { status: 400 }
      );
    }

    const isImage = ALLOWED_IMAGE_TYPES.has(mimeType) || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext);
    const isVideo = ALLOWED_VIDEO_TYPES.has(mimeType) || ['.mp4', '.webm', '.mov'].includes(ext);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file format (${mimeType || ext}). Please upload images (JPEG, PNG, WebP) or videos (MP4, WebM).`,
        },
        { status: 400 }
      );
    }

    // Size checks
    if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `Image file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed image size is 10MB.` },
        { status: 400 }
      );
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `Video file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed video size is 50MB.` },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'login');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    // Clean filename
    const safeBaseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    const uniqueFileName = `${Date.now()}_${safeBaseName}${ext}`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    // Write file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(destinationPath, buffer);

    const publicUrl = `/uploads/login/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      type: isVideo ? 'video' : 'image',
      name: originalName,
      size: file.size,
      mimeType,
      fileName: uniqueFileName,
    });
  } catch (err: any) {
    console.error('Login page media upload error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server failed to process uploaded media.' },
      { status: 500 }
    );
  }
}
