import { query, execute, isDbConfigured } from '../mysql';
import { ActivityLog } from '@/types/admin';
import { RowDataPacket } from 'mysql2/promise';

interface ActivityRow extends RowDataPacket {
  id: string;
  admin_email: string;
  action: string;
  target: string;
  details: string | null;
  timestamp: string;
}

export async function logActivity(entry: {
  adminEmail: string;
  action: string;
  target: string;
  details?: string;
}): Promise<ActivityLog> {
  const log: ActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    adminEmail: entry.adminEmail || 'admin@alhamd.com',
    action: entry.action,
    target: entry.target,
    details: entry.details,
    timestamp: new Date().toISOString(),
  };

  if (!isDbConfigured()) {
    return log;
  }

  try {
    await execute(
      `INSERT INTO activity_logs (id, admin_email, action, target, details, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [log.id, log.adminEmail, log.action, log.target, log.details || null, log.timestamp]
    );
  } catch (err) {
    console.warn('Failed to insert activity log into MySQL:', err);
  }

  return log;
}

export async function getActivityLogs(limit = 100): Promise<ActivityLog[]> {
  if (!isDbConfigured()) {
    return [];
  }

  const rows = await query<ActivityRow[]>(
    'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );

  return rows.map((r) => ({
    id: r.id,
    adminEmail: r.admin_email,
    action: r.action,
    target: r.target,
    details: r.details || undefined,
    timestamp: r.timestamp,
  }));
}
