import fs from 'fs';
import path from 'path';

/**
 * Server-Side Media Persistence Utility
 *
 * Ensures that any image or media passed as a Base64 data URL is safely converted
 * to a physical binary file on the server's disk (public/uploads/[folder]) and
 * represented as a permanent web-accessible URL (/uploads/[folder]/[filename]).
 */

import { saveMediaBuffer, downloadAndPersistRemoteMedia, UploadFolder } from '../mediaStorage';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

/**
 * Converts a Base64 Data URL to a saved file on disk and returns its permanent URL.
 * If data is already a standard URL, it is returned unchanged.
 */
export async function saveBase64MediaToFile(
  dataUrl: string,
  folder: UploadFolder = 'general'
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return dataUrl;
  }

  // If not a data URL, return as-is
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return dataUrl;
  }

  const mimeType = match[1].toLowerCase();
  const base64Data = match[2];

  const ext = EXT_BY_MIME[mimeType] || '.png';
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const fileName = `upload_${uniqueSuffix}${ext}`;
  const buffer = Buffer.from(base64Data, 'base64');

  const saved = await saveMediaBuffer(folder, fileName, buffer);
  return saved.publicUrl;
}

/**
 * Validates and ensures an image or media URL is safe for database persistence.
 * 1. Base64 data URLs -> saved to physical file in PERSISTENT_UPLOADS_DIR.
 * 2. External HTTP/HTTPS URLs -> downloaded and persisted to PERSISTENT_UPLOADS_DIR.
 * 3. Existing /uploads/... paths -> preserved intact.
 */
export async function ensureSafeMediaUrl(
  url: string | null | undefined,
  folder: UploadFolder = 'general'
): Promise<string | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. Already an internal relative persistent path
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  // 2. Base64 Data URL -> convert to file
  if (trimmed.startsWith('data:')) {
    return saveBase64MediaToFile(trimmed, folder);
  }

  // 3. External HTTP/HTTPS URL -> Download and store permanently in persistent storage
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const persisted = await downloadAndPersistRemoteMedia({
        url: trimmed,
        folder,
      });
      return persisted.publicUrl;
    } catch (err: any) {
      console.warn(`[MediaPersistence] Failed to download remote media from "${trimmed}":`, err?.message || err);
      // Return original URL if remote download fails so data is not discarded
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Batch-converts an array of media URLs, converting Base64 and remote URLs to permanent file URLs.
 */
export async function ensureSafeMediaUrls(
  urls: string[],
  folder: UploadFolder = 'general'
): Promise<string[]> {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const safe: string[] = [];
  for (const u of urls) {
    if (!u || typeof u !== 'string') continue;
    const clean = await ensureSafeMediaUrl(u, folder);
    if (clean) safe.push(clean);
  }
  return safe;
}
