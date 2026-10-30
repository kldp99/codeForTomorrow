import { AppDataSource, initializeDataSource, closeDataSource } from './data-source';

async function sync(): Promise<void> {
  console.log('[TypeORM] Initializing data source for schema synchronization…');
  await initializeDataSource();
  console.log('[TypeORM] Synchronizing schema from entity definitions…');
  await AppDataSource.synchronize(false);
  console.log('[TypeORM] ✅ Schema synchronized successfully without writing SQL!');
  await closeDataSource();
}

sync().catch((err: unknown) => {
  console.error('[TypeORM] Sync failed:', err);
  process.exit(1);
});

