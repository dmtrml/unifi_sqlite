import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  lt,
  lte,
  or,
} from 'drizzle-orm';
import type { DatabaseClient } from '@/server/db/connection';
import { db } from '@/server/db/connection';
import { transactions } from '@/server/db/schema';
import { nowMs, type PaginatedResult } from '@/server/db/utils';

export type TransactionInput = {
  id?: string;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  categoryId?: string | null;
  amountCents?: number | null;
  amountSentCents?: number | null;
  amountReceivedCents?: number | null;
  date: number;
  description?: string | null;
  transactionType: 'expense' | 'income' | 'transfer';
  expenseType?: 'mandatory' | 'optional' | null;
  incomeType?: 'active' | 'passive' | null;
};

export type TransactionFilters = {
  accountId?: string;
  categoryId?: string;
  startDate?: number;
  endDate?: number;
  cursor?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
};

const withClient = (client?: DatabaseClient) => client ?? db;

const buildWhereClause = (userId: string, filters: TransactionFilters) => {
  const clauses = [eq(transactions.userId, userId)];

  if (filters.categoryId) {
    clauses.push(eq(transactions.categoryId, filters.categoryId));
  }

  if (typeof filters.accountId === 'string' && filters.accountId.length > 0) {
    const accountId = filters.accountId;
    const accountFilter = or(
      eq(transactions.accountId, accountId),
      eq(transactions.fromAccountId, accountId),
      eq(transactions.toAccountId, accountId),
    );
    if (accountFilter) {
      clauses.push(accountFilter);
    }
  }

  if (typeof filters.startDate === 'number') {
    clauses.push(gte(transactions.date, filters.startDate));
  }

  if (typeof filters.endDate === 'number') {
    clauses.push(lte(transactions.date, filters.endDate));
  }

  if (typeof filters.cursor === 'number') {
    clauses.push(
      filters.sort === 'asc'
        ? gt(transactions.date, filters.cursor)
        : lt(transactions.date, filters.cursor),
    );
  }

  return and(...clauses);
};

export class TransactionsRepository {
  static list(
    userId: string,
    filters: TransactionFilters = {},
    client?: DatabaseClient,
  ): PaginatedResult<typeof transactions.$inferSelect> {
    const database = withClient(client);
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const sort = filters.sort ?? 'desc';

    const rows = database
      .select()
      .from(transactions)
      .where(buildWhereClause(userId, { ...filters, sort }))
      .orderBy(sort === 'asc' ? asc(transactions.date) : desc(transactions.date))
      .limit(limit + 1)
      .all();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.date ?? null : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  static get(userId: string, transactionId: string, client?: DatabaseClient) {
    const database = withClient(client);
    return (
      database
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
        .get() ?? null
    );
  }

  static create(userId: string, input: TransactionInput, client?: DatabaseClient) {
    const database = withClient(client);
    const timestamp = nowMs();
    const id = input.id ?? randomUUID();

    database
      .insert(transactions)
      .values({
        id,
        userId,
        accountId: input.accountId ?? null,
        fromAccountId: input.fromAccountId ?? null,
        toAccountId: input.toAccountId ?? null,
        categoryId: input.categoryId ?? null,
        amountCents: input.amountCents ?? null,
        amountSentCents: input.amountSentCents ?? null,
        amountReceivedCents: input.amountReceivedCents ?? null,
        date: input.date,
        description: input.description ?? null,
        transactionType: input.transactionType,
        expenseType: input.expenseType ?? null,
        incomeType: input.incomeType ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    return this.get(userId, id, database);
  }

  static update(userId: string, transactionId: string, input: Partial<TransactionInput>, client?: DatabaseClient) {
    const database = withClient(client);
    const payload: Record<string, unknown> = {
      updatedAt: nowMs(),
    };

    const assign = <K extends keyof TransactionInput>(key: K) => {
      if (key in input) {
        payload[key] = (input as Record<string, unknown>)[key];
      }
    };

    assign('accountId');
    assign('fromAccountId');
    assign('toAccountId');
    assign('categoryId');
    assign('amountCents');
    assign('amountSentCents');
    assign('amountReceivedCents');
    assign('date');
    assign('description');
    assign('transactionType');
    assign('expenseType');
    assign('incomeType');

    database
      .update(transactions)
      .set(payload)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
      .run();

    return this.get(userId, transactionId, database);
  }

  static delete(userId: string, transactionId: string, client?: DatabaseClient) {
    const database = withClient(client);
    database.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId))).run();
  }

  static bulkInsert(userId: string, inputs: TransactionInput[], client?: DatabaseClient) {
    if (!inputs.length) return;
    const database = withClient(client);
    const timestamp = nowMs();

    database
      .insert(transactions)
      .values(
        inputs.map((input) => ({
          id: input.id ?? randomUUID(),
          userId,
          accountId: input.accountId ?? null,
          fromAccountId: input.fromAccountId ?? null,
          toAccountId: input.toAccountId ?? null,
          categoryId: input.categoryId ?? null,
          amountCents: input.amountCents ?? null,
          amountSentCents: input.amountSentCents ?? null,
          amountReceivedCents: input.amountReceivedCents ?? null,
          date: input.date,
          description: input.description ?? null,
          transactionType: input.transactionType,
          expenseType: input.expenseType ?? null,
          incomeType: input.incomeType ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      )
      .run();
  }
}
