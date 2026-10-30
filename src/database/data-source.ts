import 'reflect-metadata';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { User, Chat, ChatMember } from '../entities';

function loadCaCert(): Buffer | undefined {
  if (!config.mysql.sslCaPath) {
    return undefined;
  }
  const caPath = path.resolve(config.mysql.sslCaPath);
  if (fs.existsSync(caPath)) {
    return fs.readFileSync(caPath);
  }
  return undefined;
}

const ca = loadCaCert();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: config.mysql.host,
  port: config.mysql.port,
  username: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  ssl: ca
    ? {
        ca,
        rejectUnauthorized: true,
      }
    : undefined,
  synchronize: false, // Schema synchronization handled safely or via sync command
  logging: config.env === 'development',
  entities: [User, Chat, ChatMember],
  timezone: '+00:00',
  extra: {
    connectionLimit: 10,
  },
});

export async function initializeDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('[TypeORM] Connected to Aiven Cloud MySQL via TypeORM DataSource.');
  }
  return AppDataSource;
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('[TypeORM] DataSource destroyed.');
  }
}

