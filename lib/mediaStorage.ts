import 'server-only';
import dns from 'dns';
import net from 'net';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type UploadFolder =
  | 'products'
  | 'videos'
  | 'categories'
  | 'brands'
  | 'branding'
  | 'login'
  | 'deals'
  | 'general';

const ALLOWED_FOLDERS = new Set<string>([
  'products',
  'videos',
  'categories',
  'brands',
  'branding',
  'login',
  'deals',
  'general',
]);

let uploadsWarnedOnce = false;

export function _resetUploadsWarnedForTest(): void {
  uploadsWarnedOnce = false;
}

/**
 * Returns whether a target directory is strictly outside the application root directory.
 */
export function isPathOutsideAppRoot(targetPath: string): boolean {
  if (!targetPath) return false;
  const appRoot = path.resolve(process.cwd());
  const resolved = path.resolve(targetPath);
  const rel = path.relative(appRoot, resolved);
  return rel.startsWith('..') || path.isAbsolute(rel);
}

/**
 * Converts a path to a safe short path displaying only the last two folder names.
 * Ensures zero server directories, drive names, or internal paths are leaked.
 */
export function toShortFolderPath(fullPath: string): string {
  if (!fullPath) return '';
  const normalized = path.normalize(fullPath).replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 2) {
    return segments.join('/');
  }
  return segments.slice(-2).join('/');
}

/**
 * Checks if a directory is writable by attempting a probe write.
 */
export function isDirectoryWritable(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.accessSync(dirPath, fs.constants.W_OK);
    const probe = path.join(dirPath, `.probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively counts regular files in a directory.
 */
export function countFilesInDirectory(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        count++;
      } else if (entry.isDirectory()) {
        count += countFilesInDirectory(path.join(dirPath, entry.name));
      }
    }
  } catch {
    // ignore access error
  }
  return count;
}

/**
 * Returns the primary persistent uploads directory.
 * Configured via PERSISTENT_UPLOADS_DIR / MEDIA_STORAGE_PATH / UPLOADS_DIR environment variable.
 * Defaults to `<app_root>/public/uploads` when running locally or if not configured.
 *
 * In production, console.warns once at startup if the uploads directory is inside the app root:
 * "Uploads are stored inside the app folder and may be lost on redeploy."
 */
export function getUploadsRootDir(): string {
  const customPath =
    process.env.PERSISTENT_UPLOADS_DIR ||
    process.env.MEDIA_STORAGE_PATH ||
    process.env.UPLOADS_DIR;

  let resolved: string;
  if (customPath && customPath.trim().length > 0) {
    const trimmed = customPath.trim();
    if (path.isAbsolute(trimmed)) {
      resolved = path.normalize(trimmed);
    } else {
      resolved = path.normalize(path.join(process.cwd(), trimmed));
    }
  } else {
    resolved = path.normalize(path.join(process.cwd(), 'public', 'uploads'));
  }

  if (process.env.NODE_ENV === 'production' && !uploadsWarnedOnce) {
    if (!isPathOutsideAppRoot(resolved)) {
      uploadsWarnedOnce = true;
      console.warn('Uploads are stored inside the app folder and may be lost on redeploy.');
    }
  }

  return resolved;
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

  // Safely decode segments once (e.g. %20 -> space, non-ASCII/Urdu/Unicode characters)
  const decodedSegments: string[] = [];
  for (const rawSeg of segments) {
    if (!rawSeg || typeof rawSeg !== 'string') return null;
    let decoded = rawSeg;
    try {
      decoded = decodeURIComponent(rawSeg);
    } catch {
      // If malformed URI encoding, keep raw
    }

    // Reject ONLY directory traversal tricks, slashes, and null bytes (Item 3)
    // Legitimate filenames with spaces, parentheses, dashes, underscores, dots, or non-ASCII characters are strictly preserved.
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('..') ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('\0')
    ) {
      return null;
    }
    decodedSegments.push(decoded);
  }

  const primaryRoot = path.resolve(getUploadsRootDir());
  const fallbackRoot = path.resolve(getFallbackUploadsDir());

  const primaryPath = path.resolve(primaryRoot, ...decodedSegments);
  // Verify path containment strictly within primaryRoot
  if (primaryPath.startsWith(primaryRoot + path.sep) || primaryPath === primaryRoot) {
    if (fs.existsSync(primaryPath)) {
      try {
        const stat = await fs.promises.stat(primaryPath);
        if (stat.isFile()) {
          return { absolutePath: primaryPath, isFallback: false, size: stat.size };
        }
      } catch {}
    }
  }

  // Check fallback repository directory if different from primary
  if (fallbackRoot !== primaryRoot) {
    const fallbackPath = path.resolve(fallbackRoot, ...decodedSegments);
    if (fallbackPath.startsWith(fallbackRoot + path.sep) || fallbackPath === fallbackRoot) {
      if (fs.existsSync(fallbackPath)) {
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

/**
 * Strict SSRF IP Validator (Task S4):
 * Rejects private, loopback, link-local, carrier-grade NAT, multicast, reserved, and IPv4-mapped IPv6 ranges.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;
  const cleanIp = ip.trim().toLowerCase();

  // IPv4 check
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (a === 10) return true;
    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private network)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 (IETF assignments)
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;
    // 192.88.99.0/24 (6to4 Relay)
    if (a === 192 && b === 88 && c === 99) return true;
    // 192.168.0.0/16 (Private network)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;
    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 (Reserved / Future)
    if (a >= 240) return true;
    // 255.255.255.255 (Broadcast)
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    return false;
  }

  // IPv6 check
  if (net.isIPv6(cleanIp)) {
    // Loopback ::1
    if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1' || cleanIp === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
    // Unspecified ::
    if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') return true;
    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    if (cleanIp.includes('::ffff:')) {
      const parts = cleanIp.split('::ffff:');
      const v4Part = parts[1];
      if (v4Part && net.isIPv4(v4Part)) {
        return isPrivateOrReservedIp(v4Part);
      }
      return true;
    }
    // Unique local address (fc00::/7)
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true;
    // Link-local address (fe80::/10)
    if (cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) return true;
    // Multicast (ff00::/8)
    if (cleanIp.startsWith('ff')) return true;

    return false;
  }

  return true;
}

/**
 * Validates a target hostname against SSRF, resolving DNS and verifying every IP.
 */
export async function validateHostSSRF(hostname: string): Promise<{ resolvedIp: string; isIpv6: boolean }> {
  const host = hostname.toLowerCase().trim();
  if (!host) throw new Error('Missing hostname.');

  // Block local domains
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host.endsWith('.corp')
  ) {
    throw new Error(`Access to local hostname "${host}" is forbidden.`);
  }

  // Block octal (leading zero), hex (0x...), integer/dword, and shorthand IP representations
  if (/^0x/i.test(host) || /^0\d+/.test(host) || /^\d+$/.test(host)) {
    throw new Error(`Forbidden numeric or hex host representation: "${host}".`);
  }
  if (/^(\d+|0x[0-9a-f]+)(\.(\d+|0x[0-9a-f]+)){1,3}$/i.test(host)) {
    if (!/^([1-9]\d{0,2}|0)\.([1-9]\d{0,2}|0)\.([1-9]\d{0,2}|0)\.([1-9]\d{0,2}|0)$/.test(host)) {
      throw new Error(`Non-canonical IP format is forbidden: "${host}".`);
    }
  }

  // Direct IP format check
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error(`Direct access to private or reserved IP "${host}" is forbidden.`);
    }
    return { resolvedIp: host, isIpv6: net.isIPv6(host) };
  }

  // DNS lookup: resolve ALL addresses
  let addresses: dns.LookupAddress[] = [];
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch (lookupErr: any) {
    throw new Error(`DNS resolution failed for hostname "${host}": ${lookupErr?.message || lookupErr}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`Hostname "${host}" could not be resolved.`);
  }

  // Verify EVERY resolved IP address is strictly public
  for (const addr of addresses) {
    if (isPrivateOrReservedIp(addr.address)) {
      throw new Error(`Hostname "${host}" resolved to forbidden/private IP "${addr.address}".`);
    }
  }

  const primary = addresses[0];
  return {
    resolvedIp: primary.address,
    isIpv6: primary.family === 6 || net.isIPv6(primary.address),
  };
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

  // Reject SVG and HTML strictly (Task S4 & S10)
  if (isSvgOrHtmlContent(buffer)) {
    return null;
  }

  // ICO: 00 00 01 00
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return { type: 'image', ext: '.ico', mime: 'image/x-icon' };
  }

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

  return null;
}

/**
 * Scans a buffer to detect SVG, XML, HTML, or script content.
 * SVG and HTML uploads are strictly rejected to prevent Stored XSS attacks (Task S10).
 */
export function isSvgOrHtmlContent(buffer: Buffer): boolean {
  if (!buffer || buffer.length === 0) return false;
  const checkLen = Math.min(buffer.length, 4096);
  const sample = buffer.slice(0, checkLen).toString('utf8').toLowerCase();

  return (
    sample.includes('<svg') ||
    sample.includes('<?xml') ||
    sample.includes('xmlns="http://www.w3.org/2000/svg"') ||
    sample.includes('xmlns:svg') ||
    sample.includes('<!doctype') ||
    sample.includes('<html') ||
    sample.includes('<head') ||
    sample.includes('<body') ||
    sample.includes('<script') ||
    sample.includes('<iframe') ||
    sample.includes('onload=') ||
    sample.includes('onerror=')
  );
}

export const DANGEROUS_UPLOAD_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.php', '.phtml', '.js', '.jsx', '.ts', '.tsx',
  '.pl', '.py', '.rb', '.cgi', '.jar', '.vbs', '.scr', '.msi', '.com',
  '.svg', '.html', '.htm', '.xhtml', '.shtml', '.xml'
]);

export interface UploadValidationOptions {
  allowVideo?: boolean;
  allowIco?: boolean;
  maxSizeBytes?: number;
}

export interface UploadValidationResult {
  ok: boolean;
  error?: string;
  format?: MediaFormatDetection;
}

/**
 * Validates an uploaded file buffer against:
 * - Forbidden dangerous extensions (.exe, .php, .svg, .html, etc.)
 * - SVG and HTML content rejection (Stored XSS prevention)
 * - Binary magic byte verification (detectMediaFormat)
 * - File size constraints
 */
export function validateUploadedFileBuffer(
  buffer: Buffer,
  originalFileName: string,
  declaredMimeType: string = '',
  options: UploadValidationOptions = {}
): UploadValidationResult {
  const ext = path.extname(originalFileName || '').toLowerCase();
  const mime = (declaredMimeType || '').toLowerCase();

  // 1. Explicitly reject SVG by extension or MIME type (Task S10)
  if (ext === '.svg' || mime.includes('svg')) {
    return {
      ok: false,
      error: 'SVG uploads are strictly prohibited for security reasons. Please upload JPG, PNG, or WebP.',
    };
  }

  // 2. Reject dangerous executable, script, and markup extensions
  if (DANGEROUS_UPLOAD_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Upload rejected: file type "${ext}" is strictly prohibited.`,
    };
  }

  // 3. Inspect buffer contents for SVG, HTML, or script payload (even if disguised as .jpg or .png)
  if (isSvgOrHtmlContent(buffer)) {
    return {
      ok: false,
      error: 'Upload rejected: disguised SVG, XML, or HTML markup detected.',
    };
  }

  // 4. Validate binary magic bytes
  const format = detectMediaFormat(buffer, declaredMimeType);
  if (!format) {
    return {
      ok: false,
      error: 'Unsupported file format or invalid binary signature. Only approved images and videos are permitted.',
    };
  }

  // 5. Video permission check
  if (format.type === 'video' && !options.allowVideo) {
    return {
      ok: false,
      error: 'Video files are not permitted for this upload endpoint.',
    };
  }

  // 6. ICO permission check
  if (format.ext === '.ico' && !options.allowIco) {
    return {
      ok: false,
      error: 'ICO files are only permitted for site favicon uploads.',
    };
  }

  // 7. Size constraint check
  const defaultMaxSize = format.type === 'video' ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
  const maxSizeBytes = options.maxSizeBytes || defaultMaxSize;
  if (buffer.length > maxSizeBytes) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      error: `File is too large (${sizeMb}MB). Maximum allowed size is ${maxMb}MB.`,
    };
  }

  return {
    ok: true,
    format,
  };
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

  let currentUrl = (opts.url || '').trim();
  if (!currentUrl) {
    throw new Error('Remote media URL is required.');
  }

  const timeoutMs = opts.timeoutMs || DEFAULT_DOWNLOAD_TIMEOUT;
  const maxRedirects = 3;

  let responseBuffer: Buffer | null = null;
  let responseContentType = '';
  let finalUrl = currentUrl;

  for (let redirectHop = 0; redirectHop <= maxRedirects; redirectHop++) {
    // 1. URL Length Constraint
    if (currentUrl.length > 2048) {
      throw new Error('URL exceeds maximum permitted length of 2048 characters.');
    }

    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error(`Invalid URL format: "${currentUrl}"`);
    }

    // 2. Protocol Validation: strictly http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
    }

    // 3. Port Validation: strictly 80 and 443
    const port = parsed.port;
    if (port && port !== '80' && port !== '443') {
      throw new Error(`Non-standard port "${port}" is forbidden. Only ports 80 and 443 are permitted.`);
    }

    // 4. Embedded credentials forbidden
    if (parsed.username || parsed.password) {
      throw new Error('URLs containing embedded credentials are forbidden.');
    }

    // 5. SSRF & DNS Validation
    const { resolvedIp } = await validateHostSSRF(parsed.hostname);

    // 6. Execute request pinned to resolved IP to prevent DNS rebinding
    const isHttps = parsed.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const requestOptions: (http.RequestOptions & https.RequestOptions) = {
      host: resolvedIp,
      hostname: resolvedIp,
      port: port ? parseInt(port, 10) : (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Host: parsed.host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlHamd-Media/1.0',
        Accept: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,*/*;q=0.8',
      },
      servername: isHttps ? parsed.hostname : undefined,
      timeout: timeoutMs,
    };

    const fetchResult = await new Promise<{
      statusCode: number;
      location?: string;
      contentType: string;
      buffer: Buffer;
    }>((resolve, reject) => {
      let isTimedOut = false;
      const req = httpModule.request(requestOptions, (res) => {
        const statusCode = res.statusCode || 500;
        const location = res.headers.location;
        const contentType = String(res.headers['content-type'] || '');

        if (statusCode >= 300 && statusCode < 400 && location) {
          res.resume();
          return resolve({ statusCode, location, contentType, buffer: Buffer.alloc(0) });
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          return reject(new Error(`Remote server responded with HTTP status ${statusCode}`));
        }

        const isVideo = contentType.includes('video/') || currentUrl.endsWith('.mp4') || currentUrl.endsWith('.webm');
        const maxAllowed = opts.maxSizeBytes || (isVideo ? DEFAULT_MAX_VIDEO_SIZE : DEFAULT_MAX_IMAGE_SIZE);

        const chunks: Buffer[] = [];
        let bytesRead = 0;

        res.on('data', (chunk: Buffer) => {
          bytesRead += chunk.length;
          if (bytesRead > maxAllowed) {
            req.destroy(new Error(`Media stream exceeds maximum limit of ${(maxAllowed / (1024 * 1024)).toFixed(1)}MB`));
          } else {
            chunks.push(chunk);
          }
        });

        res.on('end', () => {
          resolve({
            statusCode,
            contentType,
            buffer: Buffer.concat(chunks, bytesRead),
          });
        });
      });

      req.on('timeout', () => {
        isTimedOut = true;
        req.destroy(new Error(`Download timed out after ${timeoutMs / 1000} seconds.`));
      });

      req.on('error', (err) => {
        if (!isTimedOut) reject(err);
      });

      req.end();
    });

    if (fetchResult.statusCode >= 300 && fetchResult.statusCode < 400 && fetchResult.location) {
      if (redirectHop === maxRedirects) {
        throw new Error(`Exceeded maximum permitted redirect limit (${maxRedirects}).`);
      }
      currentUrl = new URL(fetchResult.location, currentUrl).toString();
      continue;
    }

    responseBuffer = fetchResult.buffer;
    responseContentType = fetchResult.contentType;
    finalUrl = currentUrl;
    break;
  }

  if (!responseBuffer || responseBuffer.length === 0) {
    throw new Error('Downloaded file is empty (0 bytes).');
  }

  // 7. Format & Magic Bytes Validation
  const format = detectMediaFormat(responseBuffer, responseContentType);
  if (!format) {
    throw new Error('Remote file is not a supported image or video format (SVG and HTML rejected).');
  }

  // 8. Secure stored filename using randomUUID
  const targetFolder: UploadFolder =
    opts.folder || (format.type === 'video' ? 'videos' : 'products');

  const uniqueFileName = `${crypto.randomUUID()}${format.ext}`;

  // 9. Save buffer to persistent storage
  const saved = await saveMediaBuffer(targetFolder, uniqueFileName, responseBuffer);

  return {
    publicUrl: saved.publicUrl,
    filePath: saved.filePath,
    size: saved.size,
    type: format.type,
    originalUrl: finalUrl,
    fileName: uniqueFileName,
  };
}
