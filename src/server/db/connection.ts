import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/server/db/schema';
import type { TransactionClient } from '@/server/db/transaction';

const resolveDatabasePath = (): string => {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }
  return path.resolve(process.cwd(), '.data/app.sqlite');
};

const databaseFile = resolveDatabasePath();

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

const sqlite = new Database(databaseFile);
sqlite.pragma('journal_mode = DELETE');

export const db = drizzle(sqlite, { schema });
export type DatabaseClient = typeof db | TransactionClient;
