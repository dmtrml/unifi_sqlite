import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { DatabaseClient } from '@/server/db/connection';
import { db } from '@/server/db/connection';
import { imports } from '@/server/db/schema';
import { nowMs } from '@/server/db/utils';

export type ImportJobInput = {
  id?: string;
  source: 'csv' | 'mercado-pago' | string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  meta?: Record<string, unknown>;
};

const withClient = (client?: DatabaseClient) => client ?? db;

export class ImportsRepository {
  static async list(userId: string, client?: DatabaseClient) {
    const database = withClient(client);
    return database.select().from(imports).where(eq(imports.userId, userId));
  }

  static async get(userId: string, jobId: string, client?: DatabaseClient) {
    const database = withClient(client);
    const [record] = await database
      .select()
      .from(imports)
      .where(and(eq(imports.userId, userId), eq(imports.id, jobId)));
    return record ?? null;
  }

  static async create(userId: string, input: ImportJobInput, client?: DatabaseClient) {
    const database = withClient(client);
    const timestamp = nowMs();
    const id = input.id ?? randomUUID();

    await database.insert(imports).values({
      id,
      userId,
      source: input.source,
      status: input.status,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return this.get(userId, id, database);
  }

  static async updateStatus(
    userId: string,
    jobId: string,
    status: ImportJobInput['status'],
    meta?: Record<string, unknown>,
    client?: DatabaseClient,
  ) {
    const database = withClient(client);
    await database
      .update(imports)
      .set({
        status,
        meta: meta ? JSON.stringify(meta) : null,
        updatedAt: nowMs(),
      })
      .where(and(eq(imports.userId, userId), eq(imports.id, jobId)));

    return this.get(userId, jobId, database);
  }
}
