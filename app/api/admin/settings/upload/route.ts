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

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/ico',
  'image/svg+xml',
]);

const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

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
        { success: false, error: 'Unauthorized. Admin credentials required to upload site branding.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No image file provided.' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'unnamed-logo';
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    // Security check: ban executable / script files
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: `Upload rejected: executable and script files (${ext}) are strictly prohibited.` },
        { status: 400 }
      );
    }

    const isAllowedExt = ALLOWED_IMAGE_EXTS.has(ext);
    const isAllowedMime = ALLOWED_IMAGE_MIMES.has(mimeType);

    if (!isAllowedExt && !isAllowedMime) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported image format. Allowed formats: PNG, JPG, JPEG, WEBP, ICO, SVG.`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed logo size is 5MB.`,
        },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'branding');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    // Clean filename
    const safeBaseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const uniqueFileName = `logo_${Date.now()}_${safeBaseName}${ext || '.png'}`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    // Write file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(destinationPath, buffer);

    const publicUrl = `/uploads/branding/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: uniqueFileName,
      originalName,
      size: file.size,
    });
  } catch (error: any) {
    console.error('Failed to upload site logo/favicon:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error while uploading image.' },
      { status: 500 }
    );
  }
}
