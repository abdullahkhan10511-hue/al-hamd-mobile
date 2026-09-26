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

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB limit for high-res hero video

export async function POST(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin credentials required to upload homepage videos.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No video file provided.' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'homepage_hero.mp4';
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    if (!ALLOWED_VIDEO_MIME_TYPES.has(mimeType) && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported video format (${mimeType || ext}). Please upload standard web video files (MP4, WebM, or MOV).`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Video file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed video size is 100MB.`,
        },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'videos');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const safeBaseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    const uniqueFileName = `${Date.now()}_${safeBaseName}${ext}`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(destinationPath, buffer);

    const publicUrl = `/uploads/videos/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      name: originalName,
      size: file.size,
      mimeType: mimeType || 'video/mp4',
      fileName: uniqueFileName,
    });
  } catch (err: any) {
    console.error('Homepage video upload error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server failed to process uploaded video.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionUser(request);
    const authHeader = request.headers.get('authorization');
    if (!session && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const { url } = await request.json();
    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/videos/')) {
      return NextResponse.json({ success: true, message: 'No local file to delete' });
    }

    const fileName = path.basename(url);
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'videos', fileName);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    return NextResponse.json({ success: true, message: 'File deleted' });
  } catch (err: any) {
    console.warn('Failed to delete video file:', err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
