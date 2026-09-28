import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAdminSession } from '@/lib/db/adminAuth';

const ALLOWED_LOGO_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

const ALLOWED_LOGO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.php', '.phtml', '.js', '.jsx', '.ts', '.tsx',
  '.pl', '.py', '.rb', '.cgi', '.jar', '.vbs', '.scr', '.msi', '.com'
]);

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin credentials required to upload brand media.' },
        { status: 401 }
      );
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
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    // Security check: ban script and executable files
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: `Upload rejected: executable and script files (${ext}) are strictly prohibited.` },
        { status: 400 }
      );
    }

    const isAllowedLogo = ALLOWED_LOGO_MIMES.has(mimeType) || ALLOWED_LOGO_EXTS.has(ext);
    if (!isAllowedLogo) {
      return NextResponse.json(
        { success: false, error: `Unsupported image format (${mimeType || ext}). Please upload JPG, PNG, WebP, or SVG logos.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Logo file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 15MB.`,
        },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'brands');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const safeBaseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const uniqueFileName = `${uniqueSuffix}_${safeBaseName}${ext || '.png'}`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(destinationPath, buffer);

    const publicUrl = `/uploads/brands/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: uniqueFileName,
      size: file.size,
      mimeType: file.type || 'image/png',
    });
  } catch (error: any) {
    console.error('Failed to upload brand logo:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error while uploading brand logo.' },
      { status: 500 }
    );
  }
}
