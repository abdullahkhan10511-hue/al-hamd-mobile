import { InventoryLog } from '@/types/admin';
import { getStoredCollection, persistCollection } from './storage';

const COLLECTION_KEY = 'inventory_logs';

export function getInventoryLogs(): InventoryLog[] {
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
  return newLog;
}
