import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: Pool | null = null;

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );
}

export function getDbConfig() {
  return {
    host: process.env.DB_HOST || '',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
  };
}

export function getPool(): Pool {
  if (!isDbConfigured()) {
    throw new Error(
      'MySQL database is not configured. Please define DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME in your environment variables (.env).'
    );
  }

  if (!pool) {
    const config = getDbConfig();
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true,
      supportBigNumbers: true,
      charset: 'utf8mb4',
    });
  }

  return pool;
}

/**
 * Execute a parameterized SELECT query against MySQL.
 */
export async function query<T = RowDataPacket[]>(sql: string, params: any[] = []): Promise<T> {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows as unknown as T;
}

/**
 * Execute an INSERT, UPDATE, or DELETE statement against MySQL.
 */
export async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return result as ResultSetHeader;
}

/**
 * Run a unit of work inside an isolated MySQL transaction.
 * Automatically commits on success and rolls back on error.
 */
export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const p = getPool();
  const connection = await p.getConnection();
  await connection.beginTransaction();

  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Tests connection to MySQL database.
 */
export async function testConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return {
      connected: false,
      error: 'Database environment variables are missing (DB_HOST, DB_USER, DB_NAME).',
    };
  }

  try {
    const p = getPool();
    const connection = await p.getConnection();
    await connection.ping();
    connection.release();
    return { connected: true };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Failed to connect to MySQL database.',
    };
  }
}

/**
 * Gracefully close the connection pool (useful during test teardown or shutdown).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
