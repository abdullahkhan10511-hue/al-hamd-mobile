import { query, execute, isDbConfigured } from '../mysql';
import { HomepageVideo } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';

interface HomepageVideoRow extends RowDataPacket {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string | null;
  active: number;
  display_order: number;
  duration: number | null;
  size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToVideo(row: HomepageVideoRow): HomepageVideo {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    thumbnailUrl: row.thumbnail_url || '',
    active: Boolean(row.active),
    displayOrder: Number(row.display_order),
    duration: row.duration !== null ? Number(row.duration) : undefined,
    size: row.size !== null ? Number(row.size) : undefined,
    mimeType: row.mime_type || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllHomepageVideosFromDb(): Promise<HomepageVideo[]> {
  if (!isDbConfigured()) {
    return [];
  }

  const rows = await query<HomepageVideoRow[]>(
    'SELECT * FROM homepage_videos ORDER BY display_order ASC, created_at ASC'
  );

  return rows.map(mapRowToVideo);
}

export async function getActiveHomepageVideosFromDb(): Promise<HomepageVideo[]> {
  if (!isDbConfigured()) {
    return [];
  }

  const rows = await query<HomepageVideoRow[]>(
    'SELECT * FROM homepage_videos WHERE active = 1 ORDER BY display_order ASC'
  );

  return rows.map(mapRowToVideo);
}

export async function saveHomepageVideoInDb(video: Partial<HomepageVideo>): Promise<HomepageVideo> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const id = video.id || `video-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const title = (video.title || 'Untitled Homepage Video').trim();
  const url = (video.url || '').trim();
  const thumbnailUrl = video.thumbnailUrl ? video.thumbnailUrl.trim() : null;
  const active = video.active !== undefined ? (video.active ? 1 : 0) : 1;
  const displayOrder = Number(video.displayOrder) || 1;
  const duration = video.duration !== undefined ? Number(video.duration) : null;
  const size = video.size !== undefined ? Number(video.size) : null;
  const mimeType = video.mimeType || 'video/mp4';

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
