import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { DatabaseClient } from '@/server/db/connection';
import { db } from '@/server/db/connection';
import { categories } from '@/server/db/schema';
import { nowMs } from '@/server/db/utils';

export type CategoryInput = {
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
};

export type CategoryUpdateInput = Partial<Omit<CategoryInput, 'id'>>;

const withClient = (client?: DatabaseClient) => client ?? db;

export class CategoriesRepository {
  static async list(userId: string, client?: DatabaseClient) {
    const database = withClient(client);
    return database.select().from(categories).where(eq(categories.userId, userId));
  }

  static async get(userId: string, categoryId: string, client?: DatabaseClient) {
    const database = withClient(client);
    const [record] = await database
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, categoryId)));
    return record ?? null;
  }

  static async create(userId: string, input: CategoryInput, client?: DatabaseClient) {
    const database = withClient(client);
    const timestamp = nowMs();
    const id = input.id ?? randomUUID();
    await database.insert(categories).values({
      id,
      userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      type: input.type,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return this.get(userId, id, database);
  }

  static async update(userId: string, categoryId: string, input: CategoryUpdateInput, client?: DatabaseClient) {
    const database = withClient(client);
    const payload: Record<string, unknown> = { updatedAt: nowMs() };
    if (typeof input.name === 'string') payload.name = input.name;
    if (typeof input.icon === 'string') payload.icon = input.icon;
    if (typeof input.color === 'string') payload.color = input.color;
    if (typeof input.type === 'string') payload.type = input.type;

    await database
      .update(categories)
      .set(payload)
      .where(and(eq(categories.userId, userId), eq(categories.id, categoryId)));

    return this.get(userId, categoryId, database);
  }

  static async delete(userId: string, categoryId: string, client?: DatabaseClient) {
    const database = withClient(client);
    await database.delete(categories).where(and(eq(categories.userId, userId), eq(categories.id, categoryId)));
  }
}
