import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolveMediaFilePath } from '@/lib/mediaStorage';

/**
 * Fixed allowlist of permitted extensions with correct Content-Type (Task S10b).
 * Any other extension is strictly served as application/octet-stream with
 * Content-Disposition: attachment and nosniff.
 */
const ALLOWED_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

/**
 * Checks whether a filename contains a timestamp or random id for long-term immutable caching.
 * Unversioned/static files receive a shorter 1-hour cache.
 */
function getCacheControl(filename: string): string {
  const isVersionedOrRandom =
    /\d{10,}/.test(filename) ||
    /import_\d+/i.test(filename) ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(filename) ||
    /_[a-z0-9]{6,}/i.test(filename);

  return isVersionedOrRandom
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600';
}

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
    const safeFilename = path.basename(absolutePath).replace(/["\r\n\\]/g, '_');
    const isAllowed = Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, ext);

    let contentType: string;
    let contentDisposition: string;
    let extraHeaders: Record<string, string> = {};

    if (isAllowed) {
      contentType = ALLOWED_MIME_TYPES[ext];

      if (ext === '.svg') {
        // Task S10b: Existing SVGs serve inline with sandbox CSP to prevent stored XSS
        contentDisposition = 'inline';
        extraHeaders['Content-Security-Policy'] =
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
      } else {
        contentDisposition = `inline; filename="${safeFilename}"`;
      }

      // Verify binary magic numbers for images to ensure content type matches payload
      if (ext === '.ico' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
        try {
          const headerBuf = Buffer.alloc(12);
          const fd = await fs.promises.open(absolutePath, 'r');
          await fd.read(headerBuf, 0, 12, 0);
          await fd.close();
          if (headerBuf[0] === 0 && headerBuf[1] === 0 && headerBuf[2] === 1 && headerBuf[3] === 0) {
            contentType = 'image/x-icon';
          } else if (headerBuf[0] === 0x89 && headerBuf[1] === 0x50 && headerBuf[2] === 0x4e && headerBuf[3] === 0x47) {
            contentType = 'image/png';
          } else if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
            contentType = 'image/jpeg';
          } else if (headerBuf.subarray(0, 4).toString() === 'RIFF') {
            contentType = 'image/webp';
          }
        } catch {
          // Fall back to extension-based contentType
        }
      }
    } else {
      // Non-allowlisted extension: serve safely as octet-stream attachment
      contentType = 'application/octet-stream';
      contentDisposition = `attachment; filename="${safeFilename}"`;
    }

    const cacheControl = getCacheControl(safeFilename);
    const rangeHeader = request.headers.get('range');

    // Handle HTTP Range Requests for video & audio streaming (HTTP 206)
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : undefined;
      const end = requestedEnd !== undefined
        ? requestedEnd
        : Math.min(start + DEFAULT_CHUNK_SIZE - 1, size - 1);

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
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': contentDisposition,
          'Cache-Control': cacheControl,
          ...extraHeaders,
        },
      });
    }

    // Standard Full-Content Delivery (HTTP 200)
    const buffer = await fs.promises.readFile(absolutePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': size.toString(),
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': contentDisposition,
        'Cache-Control': cacheControl,
        ...extraHeaders,
      },
    });
  } catch (err: any) {
    console.error('Error serving upload asset:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
