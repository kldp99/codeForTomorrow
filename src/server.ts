/**
 * Application entry point.
 *
 * Phase 1: Aiven Cloud MySQL with TypeORM.
 * Firebase / Firestore will be initialised in Phase 2.
 *
 * Boot sequence:
 *  1. Initialize TypeORM DataSource (fail fast if unreachable)
 *  2. Start the Express HTTP server
 *  3. Register graceful-shutdown handlers
 */

import 'reflect-metadata';
import { createApp } from './app';
import { initializeDataSource, closeDataSource } from './database/data-source';
import { getFirestore } from './config/firebase';
import { config } from './config/env';

async function bootstrap(): Promise<void> {
  console.log(`\n🚀  Starting Chat Backend with TypeORM in [${config.env}] mode…\n`);

  // ── Connect to Aiven Cloud MySQL via TypeORM ──────────────────────────────
  try {
    await initializeDataSource();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌  TypeORM connection failed:', msg);
    console.error(
      '    Check MYSQL_* environment variables, ensure the CA certificate is present,\n' +
      '    and verify the Aiven service is running.'
    );
    process.exit(1);
  }

  // ── Initialize Firebase Admin SDK & Firestore ─────────────────────────────
  try {
    getFirestore();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌  Firebase initialization failed:', msg);
    console.error('    Check FIREBASE_SERVICE_ACCOUNT_PATH in certs/ directory.');
    process.exit(1);
  }

  // ── Start HTTP server ──────────────────────────────────────────────────────
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`\n✅  Server listening on http://localhost:${config.port}`);
    console.log(`    Health: http://localhost:${config.port}/health`);
    console.log(`    API:    http://localhost:${config.port}/api/v1\n`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n🛑  Received ${signal}. Shutting down gracefully…`);
    server.close(async () => {
      await closeDataSource();
      console.log('👋  Goodbye.');
      process.exit(0);
    });

    // Force exit after 10 s if something hangs
    setTimeout(() => {
      console.error('⚠️  Forced exit after 10s timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('💥  Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err: Error) => {
    console.error('💥  Uncaught Exception:', err.message);
    process.exit(1);
  });
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
