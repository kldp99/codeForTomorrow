/**
 * MySQL migration script for Aiven Cloud MySQL.
 *
 * Reads schema.mysql.sql and applies each statement against the configured
 * MySQL database. Idempotent:
 *  - Tables use CREATE TABLE IF NOT EXISTS
 *  - Indexes use plain CREATE INDEX; duplicate-key errors (errno 1061)
 *    are silently skipped so re-running is safe
 *  - Seed rows use INSERT IGNORE
 *
 * Usage:  npm run migrate:mysql
 */

import fs from 'fs';
import path from 'path';
import { connectDatabase, query, closeDatabase } from './mysql';

/** MySQL error codes we treat as non-fatal during migration */
const IGNORABLE_ERRNO = new Set([
  1061, // ER_DUP_KEY_NAME  — index already exists
  1050, // ER_TABLE_EXISTS   — table already exists (fallback, IF NOT EXISTS handles this)
]);

interface MySQLError extends Error {
  errno?: number;
}

async function migrate(): Promise<void> {
  console.log('[Migrate] Starting MySQL migration…');

  await connectDatabase();

  const schemaPath = path.join(__dirname, 'schema.mysql.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Strip single-line (--) and multi-line (/* */) comments, then split on ';'
  const cleanedSql = sql
    .replace(/--[^\n]*/g, '')          // remove -- comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // remove /* */ comments

  const statements = cleanedSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let skipped = 0;
  for (const statement of statements) {
    try {
      await query(statement);
      console.log(`[Migrate] ✔  ${statement.slice(0, 70).replace(/\n/g, ' ').trim()}…`);
    } catch (err) {
      const mysqlErr = err as MySQLError;
      if (mysqlErr.errno !== undefined && IGNORABLE_ERRNO.has(mysqlErr.errno)) {
        // Index/table already exists — safe to skip on re-run
        console.log(
          `[Migrate] ⚠  Skipped (already exists, errno ${mysqlErr.errno}): ` +
          `${statement.slice(0, 60).replace(/\n/g, ' ').trim()}…`
        );
        skipped++;
      } else {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[Migrate] ✘  Failed:\n  ${statement.slice(0, 100).replace(/\n/g, ' ').trim()}\n  Error: ${message}`
        );
        throw err;
      }
    }
  }

  console.log(
    `[Migrate] ✅  MySQL migration completed successfully.` +
    (skipped > 0 ? ` (${skipped} statement(s) skipped — already existed)` : '')
  );
  await closeDatabase();
}

migrate().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[Migrate] Fatal error:', message);
  process.exit(1);
});
