import { db } from '@/server/db/connection';

export type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const withTransaction = <T>(callback: (tx: TransactionClient) => T): T =>
  db.transaction((tx) => callback(tx));
