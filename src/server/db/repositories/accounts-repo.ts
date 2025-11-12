import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseClient } from '@/server/db/connection';
import { db } from '@/server/db/connection';
import { accounts } from '@/server/db/schema';
import { nowMs } from '@/server/db/utils';

export type AccountInput = {
  id?: string;
  name: string;
  balanceCents: number;
  icon: string;
  color: string;
  type: string;
  currency: string;
};

export type AccountUpdateInput = Partial<Omit<AccountInput, 'id' | 'balanceCents'>> & {
  balanceCents?: number;
};

const withClient = (client?: DatabaseClient) => client ?? db;

export class AccountsRepository {
  static list(userId: string, client?: DatabaseClient) {
    const database = withClient(client);
    return database.select().from(accounts).where(eq(accounts.userId, userId)).all();
  }

  static get(userId: string, accountId: string, client?: DatabaseClient) {
    const database = withClient(client);
    return (
      database
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
        .get() ?? null
    );
  }

  static create(userId: string, input: AccountInput, client?: DatabaseClient) {
    const database = withClient(client);
    const timestamp = nowMs();
    const id = input.id ?? randomUUID();
    database
      .insert(accounts)
      .values({
        id,
        userId,
        name: input.name,
        balanceCents: input.balanceCents,
        icon: input.icon,
        color: input.color,
        type: input.type,
        currency: input.currency,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
    return this.get(userId, id, database);
  }

  static update(userId: string, accountId: string, input: AccountUpdateInput, client?: DatabaseClient) {
    const database = withClient(client);
    const payload: Record<string, unknown> = {
      updatedAt: nowMs(),
    };

    if (typeof input.name === 'string') payload.name = input.name;
    if (typeof input.icon === 'string') payload.icon = input.icon;
    if (typeof input.color === 'string') payload.color = input.color;
    if (typeof input.type === 'string') payload.type = input.type;
    if (typeof input.currency === 'string') payload.currency = input.currency;
    if (typeof input.balanceCents === 'number') payload.balanceCents = input.balanceCents;

    database
      .update(accounts)
      .set(payload)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
      .run();

    return this.get(userId, accountId, database);
  }

  static delete(userId: string, accountId: string, client?: DatabaseClient) {
    const database = withClient(client);
    database.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).run();
  }

  static adjustBalance(accountId: string, deltaCents: number, client?: DatabaseClient) {
    if (!deltaCents) return;
    const database = withClient(client);
    database
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} + ${deltaCents}`,
        updatedAt: nowMs(),
      })
      .where(eq(accounts.id, accountId))
      .run();
  }
}
