import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connection';
import { users } from '@/server/db/schema';
import { nowMs } from '@/server/db/utils';

export type UserProfileUpdate = {
  email?: string | null;
  name?: string | null;
  theme?: 'light' | 'dark' | null;
  mainCurrency?: string | null;
};

export type UserTokenUpdate = {
  mercadoPagoAccessToken?: string | null;
  mercadoPagoRefreshToken?: string | null;
  mercadoPagoTokenExpires?: number | null;
};

export class UsersRepository {
  static async getById(userId: string) {
    const [record] = await db.select().from(users).where(eq(users.id, userId));
    return record ?? null;
  }

  static async upsert(userId: string, data: UserProfileUpdate) {
    const existing = await this.getById(userId);
    const timestamp = nowMs();
    const payload = {
      id: userId,
      email: data.email ?? existing?.email ?? null,
      name: data.name ?? existing?.name ?? null,
      theme: data.theme ?? existing?.theme ?? null,
      mainCurrency: data.mainCurrency ?? existing?.mainCurrency ?? null,
      updatedAt: timestamp,
    };

    if (existing) {
      await db.update(users).set(payload).where(eq(users.id, userId));
      return { ...existing, ...payload };
    }

    await db.insert(users).values({
      ...payload,
      createdAt: timestamp,
    });
    return { ...payload, createdAt: timestamp };
  }

  static async updateTokens(userId: string, data: UserTokenUpdate) {
    const updates = {
      mercadoPagoAccessToken: data.mercadoPagoAccessToken ?? null,
      mercadoPagoRefreshToken: data.mercadoPagoRefreshToken ?? null,
      mercadoPagoTokenExpires: data.mercadoPagoTokenExpires ?? null,
      updatedAt: nowMs(),
    };

    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId));
  }
}
