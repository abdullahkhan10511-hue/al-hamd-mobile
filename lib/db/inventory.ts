import { InventoryLog } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';

const COLLECTION_KEY = 'inventory_logs';

let hasSyncedInventoryLogsFromApi = false;
export async function syncInventoryLogsFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/admin/inventory/logs', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs) && data.logs.length > 0) {
        await persistCollection(COLLECTION_KEY, data.logs);
        window.dispatchEvent(
          new CustomEvent('alhamd:data-updated', {
            detail: { key: COLLECTION_KEY, value: data.logs },
          })
        );
      }
    }
  } catch {}
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
    id: `inv-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  const updated = [newLog, ...logs];
  await persistCollection(COLLECTION_KEY, updated);

  if (typeof window !== 'undefined') {
    fetch('/api/admin/inventory/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    }).catch(() => {});
    window.dispatchEvent(
      new CustomEvent('alhamd:data-updated', {
        detail: { key: COLLECTION_KEY, value: updated },
      })
    );
  }

  return newLog;
}
