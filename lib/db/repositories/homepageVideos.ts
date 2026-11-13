import 'server-only';
import { query, execute, isDbConfigured } from '../mysql';
import { HomepageVideo } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';
import { ensureSafeMediaUrl } from '../serverMedia';
import { getHeroMediaType } from '../homepageVideos';

interface HomepageVideoRow extends RowDataPacket {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string | null;
  mobile_url?: string | null;
  mobile_thumbnail_url?: string | null;
  mobile_mime_type?: string | null;
  active: number;
  display_order: number;
  duration: number | null;
  size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

let hasMobileColumnsCache: boolean | null = null;

export function _resetHeroMobileColumnsCacheForTest(): void {
  hasMobileColumnsCache = null;
}

export async function hasHeroMobileColumns(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  if (hasMobileColumnsCache !== null) return hasMobileColumnsCache;
  try {
    const cols = await query<RowDataPacket[]>(
      "SHOW COLUMNS FROM homepage_videos LIKE 'mobile_url'"
    );
    hasMobileColumnsCache = Array.isArray(cols) && cols.length > 0;
  } catch {
    hasMobileColumnsCache = false;
  }
  return hasMobileColumnsCache;
}

function mapRowToVideo(row: HomepageVideoRow): HomepageVideo {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    thumbnailUrl: row.thumbnail_url || '',
    mobileUrl: row.mobile_url || undefined,
    mobileThumbnailUrl: row.mobile_thumbnail_url || undefined,
    mobileMimeType: row.mobile_mime_type || undefined,
    active: Boolean(row.active),
    displayOrder: Number(row.display_order),
    duration: row.duration !== null ? Number(row.duration) : undefined,
    size: row.size !== null ? Number(row.size) : undefined,
    mimeType: row.mime_type || undefined,
    mediaType: getHeroMediaType(row.url, row.mime_type || undefined),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllHomepageVideosFromDb(): Promise<HomepageVideo[]> {
  if (!isDbConfigured()) {
    return [];
  }

  await hasHeroMobileColumns();
  const rows = await query<HomepageVideoRow[]>(
    'SELECT * FROM homepage_videos ORDER BY display_order ASC, id ASC'
  );

  return rows.map(mapRowToVideo);
}

export async function getActiveHomepageVideosFromDb(): Promise<HomepageVideo[]> {
  if (!isDbConfigured()) {
    return [];
  }

  await hasHeroMobileColumns();
  const rows = await query<HomepageVideoRow[]>(
    "SELECT * FROM homepage_videos WHERE active = 1 AND url IS NOT NULL AND TRIM(url) != '' ORDER BY display_order ASC, id ASC"
  );

  return rows.map(mapRowToVideo);
}

export async function saveHomepageVideoInDb(video: Partial<HomepageVideo>): Promise<HomepageVideo> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const id = video.id || `video-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Safely retrieve existing row if this is an update to avoid wiping unpassed fields
  const existingRows = await query<HomepageVideoRow[]>(
    'SELECT * FROM homepage_videos WHERE id = ? LIMIT 1',
    [id]
  );
  const existing = existingRows[0] ? mapRowToVideo(existingRows[0]) : null;

  const rawTitle = (video.title !== undefined && video.title.trim().length > 0)
    ? video.title.trim()
    : (existing?.title || 'Untitled Homepage Media').trim();
  const title = rawTitle.length > 0 ? rawTitle : (existing?.title || 'Untitled Homepage Media');

  const rawUrl = (video.url !== undefined && video.url.trim().length > 0)
    ? video.url.trim()
    : (existing?.url || '').trim();
  const url = (await ensureSafeMediaUrl(rawUrl, 'videos')) || rawUrl;
  const rawThumbnail = video.thumbnailUrl !== undefined
    ? (video.thumbnailUrl ? video.thumbnailUrl.trim() : null)
    : (existing?.thumbnailUrl || null);
  const thumbnailUrl = rawThumbnail ? ((await ensureSafeMediaUrl(rawThumbnail, 'videos')) || rawThumbnail) : null;
  const active = video.active !== undefined
    ? (video.active ? 1 : 0)
    : (existing ? (existing.active ? 1 : 0) : 1);
  const displayOrder = video.displayOrder !== undefined && !isNaN(Number(video.displayOrder))
    ? Math.max(1, Math.round(Number(video.displayOrder)))
    : (existing ? existing.displayOrder : 1);
  const duration = video.duration !== undefined
    ? (video.duration !== null ? Number(video.duration) : null)
    : (existing?.duration ?? null);
  const size = video.size !== undefined
    ? (video.size !== null ? Number(video.size) : null)
    : (existing?.size ?? null);
  const mimeType = video.mimeType !== undefined
    ? video.mimeType
    : (existing?.mimeType || 'video/mp4');

  const supportsMobile = await hasHeroMobileColumns();
  if (supportsMobile) {
    const rawMobileUrl = video.mobileUrl !== undefined
      ? (video.mobileUrl ? video.mobileUrl.trim() : null)
      : (existing?.mobileUrl || null);
    const mobileUrl = rawMobileUrl ? ((await ensureSafeMediaUrl(rawMobileUrl, 'videos')) || rawMobileUrl) : null;

    const rawMobileThumb = video.mobileThumbnailUrl !== undefined
      ? (video.mobileThumbnailUrl ? video.mobileThumbnailUrl.trim() : null)
      : (existing?.mobileThumbnailUrl || null);
    const mobileThumbnailUrl = rawMobileThumb ? ((await ensureSafeMediaUrl(rawMobileThumb, 'videos')) || rawMobileThumb) : null;

    const mobileMimeType = video.mobileMimeType !== undefined
      ? (video.mobileMimeType || null)
      : (existing?.mobileMimeType || null);

    await execute(
      `INSERT INTO homepage_videos (
        id, title, url, thumbnail_url, mobile_url, mobile_thumbnail_url, mobile_mime_type, active, display_order, duration, size, mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        url = VALUES(url),
        thumbnail_url = VALUES(thumbnail_url),
        mobile_url = VALUES(mobile_url),
        mobile_thumbnail_url = VALUES(mobile_thumbnail_url),
        mobile_mime_type = VALUES(mobile_mime_type),
        active = VALUES(active),
        display_order = VALUES(display_order),
        duration = VALUES(duration),
        size = VALUES(size),
        mime_type = VALUES(mime_type),
        updated_at = NOW()`,
      [id, title, url, thumbnailUrl, mobileUrl, mobileThumbnailUrl, mobileMimeType, active, displayOrder, duration, size, mimeType]
    );
  } else {
    await execute(
      `INSERT INTO homepage_videos (
        id, title, url, thumbnail_url, active, display_order, duration, size, mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        url = VALUES(url),
        thumbnail_url = VALUES(thumbnail_url),
        active = VALUES(active),
        display_order = VALUES(display_order),
        duration = VALUES(duration),
        size = VALUES(size),
        mime_type = VALUES(mime_type),
        updated_at = NOW()`,
      [id, title, url, thumbnailUrl, active, displayOrder, duration, size, mimeType]
    );
  }

  const rows = await query<HomepageVideoRow[]>(
    'SELECT * FROM homepage_videos WHERE id = ? LIMIT 1',
    [id]
  );

  return mapRowToVideo(rows[0]);
}

export async function deleteHomepageVideoInDb(id: string): Promise<boolean> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const result = await execute('DELETE FROM homepage_videos WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function reorderHomepageVideosInDb(orderedIds: string[]): Promise<boolean> {
  if (!isDbConfigured() || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return false;
  }

  for (let idx = 0; idx < orderedIds.length; idx++) {
    await execute(
      'UPDATE homepage_videos SET display_order = ?, updated_at = NOW() WHERE id = ?',
      [idx + 1, orderedIds[idx]]
    );
  }

  return true;
}
