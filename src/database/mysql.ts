/**
 * MySQL connection pool for Aiven Cloud MySQL.
 *
 * Features:
 *  - Connection pool (mysql2/promise)
 *  - SSL/TLS with full certificate verification (rejectUnauthorized: true)
 *  - Parameterized queries to prevent SQL injection
 *  - Transaction helper with automatic rollback on error
 *  - Singleton pool — shared across the entire application
 */

import mysql from 'mysql2/promise';
import type { ExecuteValues } from 'mysql2/typings/mysql/lib/protocol/sequences/Query';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

let pool: mysql.Pool | null = null;

/**
 * Load the Aiven CA certificate for SSL/TLS verification.
 * Throws a descriptive error if the file is missing.
 */
function loadCaCert(): Buffer {
  const caPath = path.resolve(config.mysql.sslCaPath);
  if (!fs.existsSync(caPath)) {
    throw new Error(
      `[MySQL] CA certificate not found at: ${caPath}\n` +
      'Download it from Aiven Console → Your MySQL Service → Overview → CA Certificate\n' +
      'Save as: certs/ca.pem'
    );
  }
  return fs.readFileSync(caPath);
}

/**
 * Return the shared MySQL connection pool (singleton).
 * Creates the pool on first call.
 */
export function getMySQLPool(): mysql.Pool {
  if (!pool) {
    const ca = loadCaCert();

    pool = mysql.createPool({
      host:     config.mysql.host,
      port:     config.mysql.port,
      database: config.mysql.database,
      user:     config.mysql.user,
      password: config.mysql.password,

      // SSL/TLS — Aiven requires SSL; certificate verification is always enabled
      ssl: {
        ca,
        rejectUnauthorized: true,   // NEVER set this to false
      },

      // Pool settings
      waitForConnections: true,
      connectionLimit:    10,       // Aiven free tier: keep low
      queueLimit:         0,
      connectTimeout:     10_000,

      // Always return JS Date objects for DATETIME / TIMESTAMP columns
      dateStrings: false,

      // Use named timezone so JS Dates are correct
      timezone: '+00:00',
    });

    pool.on('connection', () => {
      if (config.env === 'development') {
        console.debug('[MySQL] New connection established.');
      }
    });

    console.log('[MySQL] Pool created for Aiven Cloud MySQL.');
  }
  return pool;
}

/**
 * Execute a parameterized query against the pool.
 * Always use `?` placeholders — never interpolate user data into SQL.
 *
 * @returns Typed row array
 */
export async function query<T = mysql.RowDataPacket[]>(
  sql: string,
  params?: ExecuteValues[]
): Promise<T> {
  const start = Date.now();
  const [rows] = await getMySQLPool().execute(sql, params);
  const duration = Date.now() - start;

  if (config.env === 'development') {
    console.debug(
      `[DB] query="${sql.slice(0, 80).replace(/\n/g, ' ')}" duration=${duration}ms`
    );
  }

  return rows as T;
}

/**
 * Execute multiple statements inside a transaction.
 * Automatically rolls back on any error and releases the connection.
 *
 * @example
 * await withTransaction(async (conn) => {
 *   await conn.execute('INSERT INTO chats (id) VALUES (?)', [chatId]);
 *   await conn.execute('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [chatId, userId]);
 * });
 */
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getMySQLPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Test the connection during startup.
 * Throws if the database is unreachable.
 */
export async function connectDatabase(): Promise<void> {
  type NowRow = { now: string } & mysql.RowDataPacket;
  const rows = await query<NowRow[]>('SELECT NOW() AS `now`');
  console.log(`[MySQL] Connected to Aiven Cloud MySQL. Server time: ${rows[0].now}`);
}

/**
 * Gracefully close the pool on shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[MySQL] Pool closed.');
  }
}
