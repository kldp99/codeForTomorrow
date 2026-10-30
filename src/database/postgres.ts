import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/env';

/**
 * PostgreSQL connection pool.
 * Uses a singleton pattern so the pool is shared across the entire app.
 *
 * Connection priority:
 *  1. DATABASE_URL  – Neon (or any full connection string)
 *  2. Individual DB_* env vars – local/self-hosted PostgreSQL
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const isNeon = config.db.connectionString.includes('neon.tech');

    if (config.db.connectionString) {
      // Neon / connection-string mode
      pool = new Pool({
        connectionString: config.db.connectionString,
        // Neon requires SSL; channel_binding is in the URL query string
        ssl: { rejectUnauthorized: false },
        max: 10,                  // Neon free tier: keep connections low
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      if (isNeon) {
        console.log('[PostgreSQL] Using Neon serverless pool via DATABASE_URL.');
      }
    } else {
      // Local / traditional PostgreSQL
      pool = new Pool({
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password,
        ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }

    pool.on('error', (err: Error) => {
      console.error('[PostgreSQL] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Execute a parameterized query and return typed rows.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;

  if (config.env === 'development') {
    console.debug(`[DB] query="${text.slice(0, 80)}" rows=${result.rowCount} duration=${duration}ms`);
  }

  return result;
}

/**
 * Execute multiple queries inside a transaction.
 * Rolls back automatically on error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Test the database connection during startup.
 */
export async function connectDatabase(): Promise<void> {
  const result = await query<{ now: string }>('SELECT NOW() AS now');
  console.log(`[PostgreSQL] Connected. Server time: ${result.rows[0].now}`);
}

/**
 * Gracefully close the pool.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PostgreSQL] Pool closed.');
  }
}
