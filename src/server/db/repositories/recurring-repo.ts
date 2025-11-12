import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { DatabaseClient } from '@/server/db/connection';
import { db } from '@/server/db/connection';
import { recurringTransactions } from '@/server/db/schema';
import { nowMs } from '@/server/db/utils';

export type RecurringInput = {
  id?: string;
  accountId: string;
  categoryId: string;
  amountCents: number;
  description: string;
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  startDate: number;
};

export type RecurringUpdateInput = Partial<Omit<RecurringInput, 'id'>>;

const withClient = (client?: DatabaseClient) => client ?? db;

export class RecurringRepository {
  static async list(userId: string, client?: DatabaseClient) {
    const database = withClient(client);
    return database.select().from(recurringTransactions).where(eq(recurringTransactions.userId, userId));
  }

  static async get(userId: string, recurringId: string, client?: DatabaseClient) {
    const database = withClient(client);
    const [record] = await database
      .select()
      .from(recurringTransactions)
      .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.id, recurringId)));
    return record ?? null;
  }

  static async create(userId: string, input: RecurringInput, client?: DatabaseClient) {
    const database = withClient(client);
    const timestamp = nowMs();
    const id = input.id ?? randomUUID();

    await database.insert(recurringTransactions).values({
      id,
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      description: input.description,
      frequency: input.frequency,
      startDate: input.startDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return this.get(userId, id, database);
  }

  static async update(userId: string, recurringId: string, input: RecurringUpdateInput, client?: DatabaseClient) {
    const database = withClient(client);
    const payload: Record<string, unknown> = { updatedAt: nowMs() };

    if (typeof input.accountId === 'string') payload.accountId = input.accountId;
    if (typeof input.categoryId === 'string') payload.categoryId = input.categoryId;
    if (typeof input.amountCents === 'number') payload.amountCents = input.amountCents;
    if (typeof input.description === 'string') payload.description = input.description;
    if (typeof input.frequency === 'string') payload.frequency = input.frequency;
    if (typeof input.startDate === 'number') payload.startDate = input.startDate;

    await database
      .update(recurringTransactions)
      .set(payload)
      .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.id, recurringId)));

    return this.get(userId, recurringId, database);
  }

  static async delete(userId: string, recurringId: string, client?: DatabaseClient) {
    const database = withClient(client);
    await database
      .delete(recurringTransactions)
      .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.id, recurringId)));
  }
}
