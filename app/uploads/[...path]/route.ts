import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolveMediaFilePath } from '@/lib/mediaStorage';

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
  '.m4v': 'video/x-m4v',
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

    const resolved = await resolveMediaFilePath(segments);
    if (!resolved) {
      return new NextResponse('File not found', { status: 404 });
    }

    const { absolutePath, size } = resolved;
    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const rangeHeader = request.headers.get('range');

    // Handle HTTP Range Requests for video & audio streaming
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

      if (isNaN(start) || isNaN(end) || start >= size || end >= size || start > end) {
        return new NextResponse('Requested range not satisfiable', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${size}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileHandle = await fs.promises.open(absolutePath, 'r');
      const chunkBuffer = Buffer.alloc(chunkSize);
      await fileHandle.read(chunkBuffer, 0, chunkSize, start);
      await fileHandle.close();

      return new NextResponse(chunkBuffer, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Standard Full-Content Delivery
    const buffer = await fs.promises.readFile(absolutePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('Error serving upload asset:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
