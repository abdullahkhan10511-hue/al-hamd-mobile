import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { saveMediaBuffer } from '@/lib/mediaStorage';
import { getAdminSession } from '@/lib/db/adminAuth';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin credentials required to upload deal images.' },
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

    const originalName = file.name || 'deal-image';
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    const isAllowedExt = ALLOWED_IMAGE_EXTS.has(ext);
    const isAllowedMime = ALLOWED_IMAGE_MIMES.has(mimeType);

    if (!isAllowedExt && !isAllowedMime) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unsupported image format. Allowed formats: PNG, JPG, JPEG, WEBP.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 10MB.`,
        },
        { status: 400 }
      );
    }

    const safeBaseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const uniqueFileName = `deal_${Date.now()}_${safeBaseName}${ext || '.jpg'}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const saved = await saveMediaBuffer('deals', uniqueFileName, buffer);

    return NextResponse.json({
      success: true,
      url: saved.publicUrl,
      fileName: uniqueFileName,
      originalName,
      size: saved.size,
    });
  } catch (error: any) {
    console.error('Failed to upload deal image:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error while uploading deal image.' },
      { status: 500 }
    );
  }
}
