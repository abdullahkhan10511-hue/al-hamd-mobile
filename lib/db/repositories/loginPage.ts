import { query, execute, isDbConfigured } from '../mysql';
import { LoginPageSettings, LoginPageMediaItem, DEFAULT_LOGIN_PAGE_SETTINGS, DEFAULT_LOGIN_PAGE_MEDIA } from '../loginPage';
import { RowDataPacket } from 'mysql2/promise';

interface LoginPageSettingsRow extends RowDataPacket {
  id: number;
  theme: string;
  overlay_opacity: number | string;
  headline: string | null;
  subheadline: string | null;
  media_type: string;
  updated_at: string;
}

interface LoginPageMediaRow extends RowDataPacket {
  id: string;
  title: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  active: number;
  display_order: number;
  size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}


export async function getLoginPageSettingsFromDb(): Promise<LoginPageSettings> {
  if (!isDbConfigured()) {
    return DEFAULT_LOGIN_PAGE_SETTINGS;
  }

  const rows = await query<LoginPageSettingsRow[]>(
    'SELECT * FROM login_page_settings WHERE id = 1 LIMIT 1'
  );

  if (!rows || rows.length === 0) {
    return DEFAULT_LOGIN_PAGE_SETTINGS;
  }

  const r = rows[0];
  // Subheadline stores full JSON payload for high-fidelity settings preservation
  if (r.subheadline) {
    try {
      const parsed = JSON.parse(r.subheadline);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_LOGIN_PAGE_SETTINGS,
          ...parsed,
          updatedAt: r.updated_at || parsed.updatedAt || new Date().toISOString(),
        };
      }
    } catch {}
  }

  return {
    ...DEFAULT_LOGIN_PAGE_SETTINGS,
    mainHeading: r.headline || DEFAULT_LOGIN_PAGE_SETTINGS.mainHeading,
    updatedAt: r.updated_at,
  };
}

export async function updateLoginPageSettingsInDb(settings: Partial<LoginPageSettings>): Promise<LoginPageSettings> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const current = await getLoginPageSettingsFromDb();
  const merged: LoginPageSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(merged);
  const theme = merged.backgroundStyle || 'dark';
  const overlayOpacity = merged.overlayEnabled ? 0.6 : 0.0;
  const headline = (merged.mainHeading || 'Welcome to AL-HAMD').slice(0, 255);

  await execute(
    `INSERT INTO login_page_settings (
      id, theme, overlay_opacity, headline, subheadline, media_type, updated_at
    ) VALUES (
      1, ?, ?, ?, ?, ?, NOW()
    ) ON DUPLICATE KEY UPDATE
      theme = VALUES(theme),
      overlay_opacity = VALUES(overlay_opacity),
      headline = VALUES(headline),
      subheadline = VALUES(subheadline),
      media_type = VALUES(media_type),
      updated_at = NOW()`,
    [theme, overlayOpacity, headline, serialized, 'mixed']
  );

  return merged;
}

export async function getAllLoginPageMediaFromDb(): Promise<LoginPageMediaItem[]> {
  if (!isDbConfigured()) {
    return DEFAULT_LOGIN_PAGE_MEDIA;
  }

  const rows = await query<LoginPageMediaRow[]>(
    'SELECT * FROM login_page_media ORDER BY display_order ASC, created_at ASC'
  );

  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((r) => {
    // Check if extra metadata is encoded in mime_type
    let extraMeta: any = {};
    if (r.mime_type && r.mime_type.startsWith('{')) {
      try {
        extraMeta = JSON.parse(r.mime_type);
      } catch {}
    }

    return {
      id: r.id,
      title: r.title,
      type: r.type || 'image',
      url: r.url,
      thumbnailUrl: r.thumbnail_url || undefined,
      caption: extraMeta.caption,
      productName: extraMeta.productName,
      priceTag: extraMeta.priceTag,
      transition: extraMeta.transition || 'default',
      duration: extraMeta.duration,
      autoPlay: extraMeta.autoPlay,
      loop: extraMeta.loop,
      isActive: Boolean(r.active),
      displayOrder: Number(r.display_order),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function saveLoginPageMediaInDb(item: Partial<LoginPageMediaItem>): Promise<LoginPageMediaItem> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const id = item.id || `login-media-${Date.now()}`;
  const title = (item.title || 'Login Media Showcase').trim();
  const type = item.type === 'video' ? 'video' : 'image';
  const url = (item.url || '').trim();
  const thumbnailUrl = item.thumbnailUrl ? item.thumbnailUrl.trim() : null;
  const active = item.isActive !== false ? 1 : 0;
  const displayOrder = Number(item.displayOrder) || 1;

  // Encode extra fields in mime_type safely
  const metaObj = {
    caption: item.caption || '',
    productName: item.productName || '',
    priceTag: item.priceTag || '',
    transition: item.transition || 'default',
    duration: item.duration,
    autoPlay: item.autoPlay,
    loop: item.loop,
  };
  const mimeType = JSON.stringify(metaObj);

  await execute(
    `INSERT INTO login_page_media (
      id, title, type, url, thumbnail_url, active, display_order, mime_type, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      type = VALUES(type),
      url = VALUES(url),
      thumbnail_url = VALUES(thumbnail_url),
      active = VALUES(active),
      display_order = VALUES(display_order),
      mime_type = VALUES(mime_type),
      updated_at = NOW()`,
    [id, title, type, url, thumbnailUrl, active, displayOrder, mimeType]
  );

  return {
    id,
    title,
    type,
    url,
    thumbnailUrl: thumbnailUrl || undefined,
    caption: item.caption,
    productName: item.productName,
    priceTag: item.priceTag,
    transition: item.transition || 'default',
    duration: item.duration,
    autoPlay: item.autoPlay,
    loop: item.loop,
    isActive: Boolean(active),
    displayOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteLoginPageMediaInDb(id: string): Promise<boolean> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const result = await execute('DELETE FROM login_page_media WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function reorderLoginPageMediaInDb(orderedIds: string[]): Promise<boolean> {
  if (!isDbConfigured() || !Array.isArray(orderedIds)) {
    return false;
  }

  for (let idx = 0; idx < orderedIds.length; idx++) {
    await execute(
      'UPDATE login_page_media SET display_order = ?, updated_at = NOW() WHERE id = ?',
      [idx + 1, orderedIds[idx]]
    );
  }

  return true;
}
