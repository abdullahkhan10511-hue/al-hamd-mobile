import 'server-only';
import fs from 'fs';
import path from 'path';

let warnedOnce = false;

export function _resetDataDirWarnedForTest(): void {
  warnedOnce = false;
}
const seededDirs = new Set<string>();

/**
 * Returns the active data directory for runtime persistent JSON configuration.
 *
 * If the environment variable DATA_DIR is configured (recommended for production
 * on platforms like Hostinger where redeployments recreate the application root),
 * this function resolves and returns that absolute path.
 *
 * On first start with DATA_DIR set, if a runtime file does not exist there
 * but exists in <root>/data, it copies it once (never overwriting an existing
 * file in DATA_DIR, never deleting the original). Logs one line per copied file.
 *
 * In production, if DATA_DIR is NOT set, console.warns once at startup:
 * "DATA_DIR is not set; settings files live inside the app folder and may be lost on redeploy."
 */
export function getDataDir(): string {
  if (typeof window !== 'undefined') {
    return '';
  }
  const customDataDir = process.env.DATA_DIR?.trim();

  if (customDataDir) {
    const resolvedPath = path.resolve(customDataDir);

    if (!fs.existsSync(resolvedPath)) {
      try {
        fs.mkdirSync(resolvedPath, { recursive: true });
      } catch (err) {
        console.error(`[DATA_DIR] Failed to create custom data directory at ${resolvedPath}:`, err);
      }
    }

    if (!seededDirs.has(resolvedPath)) {
      seededDirs.add(resolvedPath);
      const defaultDataDir = path.join(process.cwd(), 'data');

      if (fs.existsSync(defaultDataDir) && defaultDataDir !== resolvedPath) {
        try {
          const defaultFiles = fs.readdirSync(defaultDataDir, { withFileTypes: true });
          for (const entry of defaultFiles) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
              const targetFile = path.join(resolvedPath, entry.name);
              const sourceFile = path.join(defaultDataDir, entry.name);

              if (!fs.existsSync(targetFile)) {
                fs.copyFileSync(sourceFile, targetFile);
                console.log(`[DATA_DIR] Seeded ${entry.name} to ${resolvedPath}`);
              }
            }
          }
        } catch (copyErr) {
          console.error('[DATA_DIR] Error seeding files from default data directory:', copyErr);
        }
      }
    }

    return resolvedPath;
  }

  if (process.env.NODE_ENV === 'production' && !warnedOnce) {
    warnedOnce = true;
    console.warn('DATA_DIR is not set; settings files live inside the app folder and may be lost on redeploy.');
  }

  const defaultDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch {}
  }
  return defaultDir;
}

/**
 * Helper to resolve the absolute path to a specific file inside the active data directory.
 */
export function getDataFilePath(filename: string): string {
  return path.join(getDataDir(), filename);
}

/**
 * Atomically writes JSON data to a file inside or outside DATA_DIR by writing to a unique
 * temporary file first and renaming it to the target file.
 * Handles locks and cross-platform edge cases gracefully.
 * Logs and re-throws errors so calling routes never fail silently.
 */
export function writeAtomicJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (mkdirErr) {
      console.error(`[DATA_DIR] Failed to create parent directory at ${dir}:`, mkdirErr);
      throw mkdirErr;
    }
  }

  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  try {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf8');
    try {
      fs.renameSync(tempPath, filePath);
    } catch {
      // Fallback for Windows or systems where renameSync cannot replace across locked files
      fs.copyFileSync(tempPath, filePath);
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {}
    console.error(`[DATA_DIR] Failed atomic write to ${filePath}:`, err);
    throw err;
  }
}
