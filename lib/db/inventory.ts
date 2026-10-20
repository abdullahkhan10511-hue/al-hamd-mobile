import { InventoryLog } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';
import { getAdminAuthHeaders } from './staff';

const COLLECTION_KEY = 'inventory_logs';

let hasSyncedInventoryLogsFromApi = false;
export async function syncInventoryLogsFromApi(force = false): Promise<InventoryLog[]> {
  if (typeof window === 'undefined') return [];
  try {
    const authHeaders = getAdminAuthHeaders();
    const res = await fetch('/api/admin/inventory/logs', {
      headers: authHeaders,
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        await persistCollection(COLLECTION_KEY, data.logs);
        hasSyncedInventoryLogsFromApi = true;
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: COLLECTION_KEY, value: data.logs },
          })
        );
        return data.logs;
      }
    }
  } catch {}
  return getStoredCollection(COLLECTION_KEY, []);
}

export function getInventoryLogs(): InventoryLog[] {
  if (typeof window !== 'undefined' && !hasSyncedInventoryLogsFromApi) {
    hasSyncedInventoryLogsFromApi = true;
    syncInventoryLogsFromApi().catch(() => {});
  }
  return getStoredCollection(COLLECTION_KEY, []);
}

export async function recordInventoryLog(
  log: Omit<InventoryLog, 'id' | 'timestamp'>
): Promise<InventoryLog> {
  const logs = getInventoryLogs();
  const newLog: InventoryLog = {
    ...log,
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  const updated = [newLog, ...logs];
  await persistCollection(COLLECTION_KEY, updated);

  if (typeof window !== 'undefined') {
    try {
      const authHeaders = {
        ...getAdminAuthHeaders(log.adminEmail),
        'Content-Type': 'application/json',
      };
      fetch('/api/admin/inventory/logs', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(newLog),
      }).catch(() => {});
    } catch {}
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: updated },
      })
    );
  }

  return newLog;
}

