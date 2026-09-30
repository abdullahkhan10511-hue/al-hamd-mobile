/**
 * Environment & Data Policy Helper
 *
 * Rules:
 * 1. In PRODUCTION (NODE_ENV === 'production'), mock/demo/sample data is STRICTLY PROHIBITED.
 * 2. When MySQL is configured, all data MUST come exclusively from MySQL.
 * 3. If MySQL returns zero items, return an empty state ([]). NEVER load sample/demo products.
 * 4. If MySQL connection fails, return a safe error/empty state. NEVER silently replace with demo data.
 * 5. Fallback demo data is allowed ONLY during local development (NODE_ENV !== 'production')
 *    when MySQL database credentials are not configured.
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function allowDevMockFallback(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  // If running on server with DB configured, do not use mock fallback
  if (typeof window === 'undefined') {
    const { isDbConfigured } = require('./db/mysql');
    if (isDbConfigured()) return false;
  }
  return true;
}
