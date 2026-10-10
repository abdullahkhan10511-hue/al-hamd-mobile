import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: Pool | null = null;

export function isDbConfigured(): boolean {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql')) {
    return true;
  }
  return Boolean(
    (process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST) &&
    (process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQLUSER) &&
    (process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE)
  );
}

export function getDbConfig() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql')) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return {
        host: u.hostname || 'localhost',
        port: parseInt(u.port || '3306', 10),
        user: decodeURIComponent(u.username || ''),
        password: decodeURIComponent(u.password || ''),
        database: u.pathname.replace(/^\//, '') || '',
      };
    } catch {
      // fallback to env vars
    }
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || '',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306', 10),
    user: process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQLUSER || '',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || '',
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
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 25,
      maxIdle: Number(process.env.DB_CONNECTION_LIMIT) || 25,
      idleTimeout: 60000,
      queueLimit: 0,
      connectTimeout: 10000,
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
