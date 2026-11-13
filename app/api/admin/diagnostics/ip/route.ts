import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/db/requireAdmin';
import { getClientIp } from '@/lib/rateLimit';
import {
  getUploadsRootDir,
  isPathOutsideAppRoot,
  toShortFolderPath,
  isDirectoryWritable,
  countFilesInDirectory,
} from '@/lib/mediaStorage';
import { getDataDir } from '@/lib/storage/dataDir';

function maskIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `x.x.${parts[2]}.${parts[3]}`;
    }
    return 'x.x.' + parts.slice(-2).join('.');
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return 'x:x:' + parts.slice(-2).join(':');
  }
  return 'x.x.masked';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, undefined, { requireOwner: true });
    if (!auth.ok) return auth.response;

    const detectedIp = getClientIp(request);
    const maskedIp = maskIp(detectedIp);
    const trustProxy = (process.env.TRUST_PROXY || '').toLowerCase().trim() === 'true';
    const trustedProxyHops = parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10) || 1;

    const presentHeaders: string[] = [];
    if (request.headers.has('x-forwarded-for')) presentHeaders.push('x-forwarded-for');
    if (request.headers.has('cf-connecting-ip')) presentHeaders.push('cf-connecting-ip');
    if (request.headers.has('x-real-ip')) presentHeaders.push('x-real-ip');

    // Storage Diagnostics (Task D2)
    const uploadsDir = getUploadsRootDir();
    const dataDir = getDataDir();

    const uploadsShortPath = toShortFolderPath(uploadsDir);
    const uploadsOutsideApp = isPathOutsideAppRoot(uploadsDir);
    const uploadsWritable = isDirectoryWritable(uploadsDir);
    const uploadsFileCount = countFilesInDirectory(uploadsDir);

    const dataShortPath = toShortFolderPath(dataDir);
    const dataOutsideApp = isPathOutsideAppRoot(dataDir);
    const dataWritable = isDirectoryWritable(dataDir);

    return NextResponse.json({
      success: true,
      clientIp: maskedIp,
      trustProxy,
      trustedProxyHops,
      presentHeaders,
      storage: {
        uploads: {
          shortPath: uploadsShortPath,
          isOutsideApp: uploadsOutsideApp,
          isWritable: uploadsWritable,
          fileCount: uploadsFileCount,
        },
        data: {
          shortPath: dataShortPath,
          isOutsideApp: dataOutsideApp,
          isWritable: dataWritable,
        },
        uploadsDir: uploadsShortPath,
        uploadsOutsideApp,
        uploadsWritable,
        uploadsFileCount,
        dataDir: dataShortPath,
        dataOutsideApp,
        dataWritable,
      },
      uploadsDirectory: uploadsShortPath,
      uploadsOutsideApp,
      uploadsWritable,
      uploadsFileCount,
      dataDirectory: dataShortPath,
      dataOutsideApp,
      dataWritable,
    });
  } catch (err: any) {
    console.error('Server diagnostics IP/storage error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
