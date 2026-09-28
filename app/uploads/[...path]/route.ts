import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    if (!segments || segments.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Security check: prevent directory traversal
    for (const segment of segments) {
      if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
        return new NextResponse('Invalid file path', { status: 400 });
      }
    }

    const uploadsBase = path.join(process.cwd(), 'public', 'uploads');
    const targetFilePath = path.join(uploadsBase, ...segments);

    // Verify target path remains within public/uploads
    if (!targetFilePath.startsWith(uploadsBase)) {
      return new NextResponse('Access denied', { status: 403 });
    }

    if (!fs.existsSync(targetFilePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const stat = await fs.promises.stat(targetFilePath);
    if (!stat.isFile()) {
      return new NextResponse('Not a file', { status: 404 });
    }

    const ext = path.extname(targetFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const buffer = await fs.promises.readFile(targetFilePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('Error serving upload asset:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
