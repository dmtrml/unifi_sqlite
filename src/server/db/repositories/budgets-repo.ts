import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { DatabaseClient } from '@/server/db/connection';
import { db } from '@/server/db/connection';
import { budgets } from '@/server/db/schema';
import { nowMs } from '@/server/db/utils';

export type BudgetInput = {
  id?: string;
  categoryId: string;
  amountCents: number;
  currency: string;
};

const withClient = (client?: DatabaseClient) => client ?? db;

export class BudgetsRepository {
  static async list(userId: string, client?: DatabaseClient) {
    const database = withClient(client);
    return database.select().from(budgets).where(eq(budgets.userId, userId));
  }

  static async getByCategory(userId: string, categoryId: string, client?: DatabaseClient) {
    const database = withClient(client);
    const [record] = await database
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId)));
    return record ?? null;
  }

  static async upsert(userId: string, input: BudgetInput, client?: DatabaseClient) {
    const database = withClient(client);
    const existing = await this.getByCategory(userId, input.categoryId, database);
    const timestamp = nowMs();

    if (existing) {
      await database
        .update(budgets)
        .set({
          amountCents: input.amountCents,
          currency: input.currency,
          updatedAt: timestamp,
        })
        .where(eq(budgets.id, existing.id));
      return { ...existing, amountCents: input.amountCents, currency: input.currency, updatedAt: timestamp };
    }

    const id = input.id ?? randomUUID();
    await database.insert(budgets).values({
      id,
      userId,
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      currency: input.currency,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return this.getByCategory(userId, input.categoryId, database);
  }

  static async delete(userId: string, budgetId: string, client?: DatabaseClient) {
    const database = withClient(client);
    await database.delete(budgets).where(and(eq(budgets.userId, userId), eq(budgets.id, budgetId)));
  }
}
