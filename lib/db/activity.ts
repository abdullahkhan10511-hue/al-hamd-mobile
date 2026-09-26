import { ActivityLog } from '@/types/admin';
import { getStoredCollection, persistCollection, setLocal } from './storage';

const COLLECTION_KEY = 'activity_logs';

const DEFAULT_ACTIVITY_LOGS: ActivityLog[] = [];

/**
 * Generates a genuinely unique activity log ID using crypto.randomUUID()
 * with cryptographic fallback to prevent duplicate IDs even within the same millisecond.
 */
export function generateActivityLogId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `act-${crypto.randomUUID()}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    return `act-${hex}`;
  }
  const entropy = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  return `act-${Date.now()}-${entropy}`;
}

/**
 * Inspects existing activity records, ensuring every record has a genuinely unique ID.
 * If duplicate or missing IDs are encountered, a new unique ID is assigned while preserving
 * all existing timestamps, descriptions, operators, actions, and targets intact.
 */
export function sanitizeAndMigrateActivityLogs(rawLogs: any[]): { logs: ActivityLog[]; hasChanges: boolean } {
  if (!Array.isArray(rawLogs)) {
    return { logs: [...DEFAULT_ACTIVITY_LOGS], hasChanges: true };
  }

  const seenIds = new Set<string>();
  let hasChanges = false;

  const logs: ActivityLog[] = rawLogs.map((log) => {
    let id = log?.id;
    const isInvalidOrDuplicate = !id || typeof id !== 'string' || id.trim() === '' || seenIds.has(id);

    if (isInvalidOrDuplicate) {
      hasChanges = true;
      id = generateActivityLogId();
    }

    seenIds.add(id);

    return {
      id,
      adminEmail: typeof log?.adminEmail === 'string' && log.adminEmail.trim() !== '' ? log.adminEmail : 'admin@alhamd.com',
      action: typeof log?.action === 'string' && log.action.trim() !== '' ? log.action : 'General Operation',
      target: typeof log?.target === 'string' && log.target.trim() !== '' ? log.target : 'System',
      details: typeof log?.details === 'string' ? log.details : '',
      timestamp: typeof log?.timestamp === 'string' && log.timestamp.trim() !== '' ? log.timestamp : new Date().toISOString(),
    };
  });

  return { logs, hasChanges };
}

/**
 * Retrieves activity logs, automatically repairing any duplicate or malformed legacy IDs.
 */
export function getActivityLogs(): ActivityLog[] {
  const rawLogs = getStoredCollection<ActivityLog>(COLLECTION_KEY, DEFAULT_ACTIVITY_LOGS);
  const { logs, hasChanges } = sanitizeAndMigrateActivityLogs(rawLogs);

  if (hasChanges) {
    // Persist migrated records so future reads don't need re-migrating
    setLocal(COLLECTION_KEY, logs);
    if (typeof window !== 'undefined') {
      persistCollection(COLLECTION_KEY, logs).catch(() => {});
    }
  }

  return logs;
}

/**
 * Creates a new activity log entry using unique UUID generation.
 */
export async function logActivity(
  entry: Omit<ActivityLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<ActivityLog> {
  const logs = getActivityLogs();
  const newEntry: ActivityLog = {
    ...entry,
    id: entry.id && entry.id.trim() !== '' ? entry.id : generateActivityLogId(),
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  const updated = [newEntry, ...logs].slice(0, 150); // Keep latest 150 entries
  await persistCollection(COLLECTION_KEY, updated);
  return newEntry;
}
