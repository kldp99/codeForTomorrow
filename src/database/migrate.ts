/**
 * Database migration script.
 * Reads schema.sql and applies it against the configured PostgreSQL database.
 *
 * Usage:  npm run migrate
 */

import fs from 'fs';
import path from 'path';
import { connectDatabase, query, closeDatabase } from './postgres';

async function migrate(): Promise<void> {
  console.log('[Migrate] Starting database migration…');

  await connectDatabase();

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Split on semicolons but ignore empty statements
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await query(statement);
      console.log(`[Migrate] ✔ ${statement.slice(0, 60).replace(/\n/g, ' ')}…`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Migrate] ✘ Failed:\n  ${statement.slice(0, 80)}\n  Error: ${message}`);
      throw err;
    }
  }

  console.log('[Migrate] ✅ Migration completed successfully.');
  await closeDatabase();
}

migrate().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[Migrate] Fatal error:', message);
  process.exit(1);
});
