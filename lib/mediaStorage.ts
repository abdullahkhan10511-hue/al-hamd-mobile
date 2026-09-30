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
