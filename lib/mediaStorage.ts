import fs from 'fs';
import path from 'path';

export type UploadFolder =
  | 'products'
  | 'videos'
  | 'categories'
  | 'brands'
  | 'branding'
  | 'login'
  | 'general';

const ALLOWED_FOLDERS = new Set<string>([
  'products',
  'videos',
  'categories',
  'brands',
  'branding',
  'login',
  'general',
]);

/**
 * Returns the primary persistent uploads directory.
 * Configured via PERSISTENT_UPLOADS_DIR / MEDIA_STORAGE_PATH / UPLOADS_DIR environment variable.
 * Defaults to `<app_root>/public/uploads` when running locally or if not configured.
 */
export function getUploadsRootDir(): string {
  const customPath =
    process.env.PERSISTENT_UPLOADS_DIR ||
    process.env.MEDIA_STORAGE_PATH ||
    process.env.UPLOADS_DIR;

  if (customPath && customPath.trim().length > 0) {
    const trimmed = customPath.trim();
    if (path.isAbsolute(trimmed)) {
      return path.normalize(trimmed);
    }
    return path.normalize(path.join(process.cwd(), trimmed));
  }

  return path.normalize(path.join(process.cwd(), 'public', 'uploads'));
}

/**
 * Returns the fallback uploads directory shipped with the repository build (`public/uploads`).
 */
export function getFallbackUploadsDir(): string {
  return path.normalize(path.join(process.cwd(), 'public', 'uploads'));
}

/**
 * Sanitizes a subfolder name to prevent directory traversal and restrict to permitted folders.
 */
export function sanitizeFolderName(folder: string): UploadFolder {
  const clean = folder.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
  if (ALLOWED_FOLDERS.has(clean)) {
    return clean as UploadFolder;
  }
  return 'general';
}

/**
 * Sanitizes a file name to prevent directory traversal and remove dangerous characters.
 */
export function sanitizeFileName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext);
  const cleanBase = base.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80);
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, '').substring(0, 10);
  return `${cleanBase}${cleanExt}`;
}

/**
 * Ensures the destination folder exists inside the persistent uploads directory.
 */
export async function ensureUploadFolder(folder: UploadFolder): Promise<string> {
  const root = getUploadsRootDir();
  const folderPath = path.join(root, folder);
  await fs.promises.mkdir(folderPath, { recursive: true });
  return folderPath;
}

/**
 * Resolves a requested media path across persistent and fallback storage directories.
 * Returns the verified file path if it exists, or null if not found.
 */
export async function resolveMediaFilePath(
  segments: string[]
): Promise<{ absolutePath: string; isFallback: boolean; size: number } | null> {
  if (!segments || segments.length === 0) {
    return null;
  }

  // Security checks: ban directory traversal tokens and backslashes in segments
  for (const seg of segments) {
    if (
      !seg ||
      seg.includes('..') ||
      seg.includes('/') ||
      seg.includes('\\') ||
      seg.includes('\0')
    ) {
      return null;
    }
  }

  const primaryRoot = getUploadsRootDir();
  const fallbackRoot = getFallbackUploadsDir();

  const primaryPath = path.normalize(path.join(primaryRoot, ...segments));
  // Verify path containment
  if (primaryPath.startsWith(primaryRoot) && fs.existsSync(primaryPath)) {
    try {
      const stat = await fs.promises.stat(primaryPath);
      if (stat.isFile()) {
        return { absolutePath: primaryPath, isFallback: false, size: stat.size };
      }
    } catch {
      // Continue to fallback check
    }
  }

  // Check fallback repository directory if different from primary
  if (fallbackRoot !== primaryRoot) {
    const fallbackPath = path.normalize(path.join(fallbackRoot, ...segments));
    if (fallbackPath.startsWith(fallbackRoot) && fs.existsSync(fallbackPath)) {
      try {
        const stat = await fs.promises.stat(fallbackPath);
        if (stat.isFile()) {
          return { absolutePath: fallbackPath, isFallback: true, size: stat.size };
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Saves a file Buffer directly to persistent storage.
 */
export async function saveMediaBuffer(
  folder: UploadFolder,
  fileName: string,
  buffer: Buffer
): Promise<{ filePath: string; publicUrl: string; size: number }> {
  const safeFolder = sanitizeFolderName(folder);
  const safeName = sanitizeFileName(fileName);
  const targetDir = await ensureUploadFolder(safeFolder);
  const destinationPath = path.join(targetDir, safeName);

  await fs.promises.writeFile(destinationPath, buffer);
  const stat = await fs.promises.stat(destinationPath);

  const publicUrl = `/uploads/${safeFolder}/${safeName}`;
  return {
    filePath: destinationPath,
    publicUrl,
    size: stat.size,
  };
}

/**
 * Safely deletes a file from persistent and fallback storage.
 */
export async function deleteMediaFile(folder: UploadFolder, fileName: string): Promise<boolean> {
  const safeFolder = sanitizeFolderName(folder);
  const safeName = sanitizeFileName(fileName);

  let deleted = false;
  const primaryRoot = getUploadsRootDir();
  const primaryPath = path.join(primaryRoot, safeFolder, safeName);

  if (fs.existsSync(primaryPath)) {
    try {
      await fs.promises.unlink(primaryPath);
      deleted = true;
    } catch (e) {
      console.warn('Failed to delete file from primary storage:', e);
    }
  }

  const fallbackRoot = getFallbackUploadsDir();
  if (fallbackRoot !== primaryRoot) {
    const fallbackPath = path.join(fallbackRoot, safeFolder, safeName);
    if (fs.existsSync(fallbackPath)) {
      try {
        await fs.promises.unlink(fallbackPath);
        deleted = true;
      } catch (e) {
        console.warn('Failed to delete file from fallback storage:', e);
      }
    }
  }

  return deleted;
}

/**
 * Non-destructive Migration Helper: Copies existing media from `public/uploads`
 * to the persistent uploads root if a custom persistent folder is configured.
 * Uses COPY -> VERIFY -> PRESERVE architecture.
 */
export async function syncFallbackMediaToPersistent(): Promise<{
  copied: number;
  skipped: number;
  errors: string[];
}> {
  const primaryRoot = getUploadsRootDir();
  const fallbackRoot = getFallbackUploadsDir();

  if (primaryRoot === fallbackRoot) {
    return { copied: 0, skipped: 0, errors: [] };
  }

  let copied = 0;
  let skipped = 0;
  const errors: string[] = [];

  const folders: UploadFolder[] = ['products', 'videos', 'categories', 'brands', 'branding', 'login', 'general'];

  for (const f of folders) {
    const srcDir = path.join(fallbackRoot, f);
    const destDir = path.join(primaryRoot, f);

    if (!fs.existsSync(srcDir)) continue;
    await fs.promises.mkdir(destDir, { recursive: true });

    try {
      const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || entry.name === '.gitkeep') continue;

        const srcFile = path.join(srcDir, entry.name);
        const destFile = path.join(destDir, entry.name);

        if (fs.existsSync(destFile)) {
          skipped++;
          continue;
        }

        try {
          // Copy and verify
          await fs.promises.copyFile(srcFile, destFile);
          const srcStat = await fs.promises.stat(srcFile);
          const destStat = await fs.promises.stat(destFile);
          if (srcStat.size === destStat.size) {
            copied++;
          } else {
            errors.push(`Size mismatch for copied file: ${entry.name}`);
          }
        } catch (copyErr: any) {
          errors.push(`Failed to copy ${entry.name}: ${copyErr?.message || copyErr}`);
        }
      }
    } catch (dirErr: any) {
      errors.push(`Failed reading directory ${srcDir}: ${dirErr?.message || dirErr}`);
    }
  }

  return { copied, skipped, errors };
}

/**
 * Validates whether a hostname or IP is a local loopback, link-local, or private network address (SSRF Protection).
 */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 check
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const oct1 = parseInt(ipv4Match[1], 10);
    const oct2 = parseInt(ipv4Match[2], 10);
    const oct3 = parseInt(ipv4Match[3], 10);
    const oct4 = parseInt(ipv4Match[4], 10);

    if (oct1 > 255 || oct2 > 255 || oct3 > 255 || oct4 > 255) return true;

    // 0.0.0.0/8
    if (oct1 === 0) return true;
    // 10.0.0.0/8
    if (oct1 === 10) return true;
    // 127.0.0.0/8
    if (oct1 === 127) return true;
    // 169.254.0.0/16 (Link-local, cloud metadata service like AWS/Hostinger)
    if (oct1 === 169 && oct2 === 254) return true;
    // 172.16.0.0/12
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) return true;
    // 192.168.0.0/16
    if (oct1 === 192 && oct2 === 168) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (oct1 === 100 && oct2 >= 64 && oct2 <= 127) return true;
    // 192.0.0.0/24
    if (oct1 === 192 && oct2 === 0 && oct3 === 0) return true;
    // 198.18.0.0/15
    if (oct1 === 198 && (oct2 === 18 || oct2 === 19)) return true;
    // 224.0.0.0+ (Multicast / Reserved)
    if (oct1 >= 224) return true;
  }

  // IPv6 check
  if (host.startsWith('[') && host.endsWith(']')) {
    const rawIpv6 = host.slice(1, -1).toLowerCase();
    if (
      rawIpv6 === '::1' ||
      rawIpv6 === '::' ||
      rawIpv6.startsWith('fe80:') ||
      rawIpv6.startsWith('fc') ||
      rawIpv6.startsWith('fd') ||
      rawIpv6.startsWith('::ffff:127.') ||
      rawIpv6.startsWith('::ffff:10.') ||
      rawIpv6.startsWith('::ffff:192.168.') ||
      rawIpv6.startsWith('::ffff:169.254.')
    ) {
      return true;
    }
  }

  return false;
}

export interface MediaFormatDetection {
  type: 'image' | 'video';
  ext: string;
  mime: string;
}

/**
 * Detects the media format by inspecting binary magic bytes and headers.
 */
export function detectMediaFormat(
  buffer: Buffer,
  contentTypeHeader = ''
): MediaFormatDetection | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { type: 'image', ext: '.jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { type: 'image', ext: '.png', mime: 'image/png' };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { type: 'image', ext: '.gif', mime: 'image/gif' };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { type: 'image', ext: '.webp', mime: 'image/webp' };
  }

  // AVIF: ftypavif or ftypavis
  if (buffer.length >= 12) {
    const ftyp = buffer.toString('ascii', 4, 12);
    if (ftyp.includes('avif') || ftyp.includes('avis')) {
      return { type: 'image', ext: '.avif', mime: 'image/avif' };
    }
  }

  // MP4: .... ftyp
  if (buffer.length >= 12) {
    const ftyp = buffer.toString('ascii', 4, 8);
    if (ftyp === 'ftyp') {
      return { type: 'video', ext: '.mp4', mime: 'video/mp4' };
    }
  }

  // WebM: 1A 45 DF A3
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { type: 'video', ext: '.webm', mime: 'video/webm' };
  }

  // SVG: text check
  const headerStr = buffer.slice(0, Math.min(buffer.length, 1024)).toString('utf8').trim().toLowerCase();
  if (
    headerStr.startsWith('<?xml') ||
    headerStr.startsWith('<svg') ||
    headerStr.includes('<svg')
  ) {
    if (headerStr.includes('<script') || headerStr.includes('javascript:') || headerStr.includes('onerror=')) {
      return null;
    }
    return { type: 'image', ext: '.svg', mime: 'image/svg+xml' };
  }

  // MIME header fallback check
  const cleanHeader = contentTypeHeader.toLowerCase().split(';')[0].trim();
  if (cleanHeader === 'image/jpeg' || cleanHeader === 'image/jpg') {
    return { type: 'image', ext: '.jpg', mime: 'image/jpeg' };
  }
  if (cleanHeader === 'image/png') {
    return { type: 'image', ext: '.png', mime: 'image/png' };
  }
  if (cleanHeader === 'image/webp') {
    return { type: 'image', ext: '.webp', mime: 'image/webp' };
  }
  if (cleanHeader === 'image/gif') {
    return { type: 'image', ext: '.gif', mime: 'image/gif' };
  }
  if (cleanHeader === 'video/mp4') {
    return { type: 'video', ext: '.mp4', mime: 'video/mp4' };
  }
  if (cleanHeader === 'video/webm') {
    return { type: 'video', ext: '.webm', mime: 'video/webm' };
  }

  return null;
}

export interface PersistedMediaResult {
  publicUrl: string;
  filePath: string;
  size: number;
  type: 'image' | 'video';
  originalUrl: string;
  fileName: string;
}

export interface DownloadRemoteMediaOptions {
  url: string;
  folder?: UploadFolder;
  maxSizeBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
const DEFAULT_MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_DOWNLOAD_TIMEOUT = 15000; // 15 seconds

/**
 * Securely downloads a remote image or video from an external URL, validates its format,
 * saves it into persistent uploads storage (PERSISTENT_UPLOADS_DIR), and returns
 * the permanent local web reference (/uploads/[folder]/[filename]).
 */
export async function downloadAndPersistRemoteMedia(
  options: DownloadRemoteMediaOptions | string
): Promise<PersistedMediaResult> {
  const opts: DownloadRemoteMediaOptions =
    typeof options === 'string' ? { url: options } : options;

  const rawUrl = (opts.url || '').trim();
  if (!rawUrl) {
    throw new Error('Remote media URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL format: "${rawUrl}"`);
  }

  // 1. Protocol Validation: only http and https allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}. Only HTTP and HTTPS URLs are allowed.`);
  }

  // 2. SSRF Protection: block private IPs, link-local, loopbacks, internal network
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error(`Access to local or private network address "${parsed.hostname}" is forbidden for security.`);
  }

  // 3. User info forbidden
  if (parsed.username || parsed.password) {
    throw new Error('URLs containing embedded credentials are not permitted.');
  }

  const timeoutMs = opts.timeoutMs || DEFAULT_DOWNLOAD_TIMEOUT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlHamd-Media-Persistence/1.0',
        Accept: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,*/*;q=0.8',
      },
      redirect: 'follow',
    });
  } catch (fetchErr: any) {
    clearTimeout(timer);
    if (fetchErr?.name === 'AbortError') {
      throw new Error(`Download timed out after ${timeoutMs / 1000}s while fetching "${rawUrl}".`);
    }
    throw new Error(`Failed to connect to remote server: ${fetchErr?.message || fetchErr}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Remote server returned HTTP status ${response.status} (${response.statusText}) for "${rawUrl}".`);
  }

  const contentTypeHeader = response.headers.get('content-type') || '';
  const contentLengthHeader = response.headers.get('content-length');

  const isInitialVideo =
    contentTypeHeader.includes('video/') ||
    rawUrl.toLowerCase().endsWith('.mp4') ||
    rawUrl.toLowerCase().endsWith('.webm');

  const maxAllowedBytes =
    opts.maxSizeBytes || (isInitialVideo ? DEFAULT_MAX_VIDEO_SIZE : DEFAULT_MAX_IMAGE_SIZE);

  if (contentLengthHeader) {
    const declaredSize = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredSize) && declaredSize > maxAllowedBytes) {
      throw new Error(
        `Remote media size (${(declaredSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit (${(
          maxAllowedBytes /
          (1024 * 1024)
        ).toFixed(1)}MB).`
      );
    }
  }

  // Read response with strict stream size bounding
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Unable to read stream from remote media server.');
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxAllowedBytes) {
          throw new Error(
            `Download aborted: media exceeds maximum size limit of ${(maxAllowedBytes / (1024 * 1024)).toFixed(1)}MB.`
          );
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = Buffer.concat(chunks, totalBytes);
  if (buffer.length === 0) {
    throw new Error('Downloaded file is empty (0 bytes).');
  }

  // 4. Format & Magic Bytes Validation
  const format = detectMediaFormat(buffer, contentTypeHeader);
  if (!format) {
    throw new Error(
      `Remote file is not a valid or supported image or video format (Received Content-Type: "${contentTypeHeader}").`
    );
  }

  // 5. Determine destination folder and safe filename
  const targetFolder: UploadFolder =
    opts.folder || (format.type === 'video' ? 'videos' : 'products');

  const urlPath = parsed.pathname;
  const rawBaseName = path.basename(urlPath, path.extname(urlPath)) || 'imported';
  const cleanBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const uniqueFileName = `import_${uniqueSuffix}_${cleanBaseName}${format.ext}`;

  // 6. Save directly into persistent storage
  const saved = await saveMediaBuffer(targetFolder, uniqueFileName, buffer);

  // 7. Verify file was successfully written and stat matches
  const verifyStat = await fs.promises.stat(saved.filePath);
  if (verifyStat.size !== buffer.length) {
    throw new Error('Storage verification failed: size on disk does not match downloaded buffer.');
  }

  return {
    publicUrl: saved.publicUrl,
    filePath: saved.filePath,
    size: saved.size,
    type: format.type,
    originalUrl: rawUrl,
    fileName: uniqueFileName,
  };
}
