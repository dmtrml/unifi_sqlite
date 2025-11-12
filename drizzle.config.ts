import 'dotenv/config';
import path from 'node:path';
import type { Config } from 'drizzle-kit';

const resolveDbUrl = (): string => {
  const envPath = process.env.SQLITE_DB_PATH;
  const fallback = path.resolve(process.cwd(), '.data/app.sqlite');
  const normalized = (envPath ?? fallback).replace(/\\/g, '/');
  return normalized.startsWith('file:') ? normalized : `file:${normalized}`;
};

export default {
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolveDbUrl(),
  },
  strict: true,
  verbose: true,
} satisfies Config;
