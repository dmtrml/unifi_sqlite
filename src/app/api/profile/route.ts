import { NextResponse } from 'next/server';
import type { User } from '@/lib/types';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { UsersRepository } from '@/server/db/repositories/users-repo';

const mapUser = (
  record: NonNullable<Awaited<ReturnType<typeof UsersRepository.getById>>>,
): User => ({
  id: record.id,
  email: record.email ?? undefined,
  name: record.name ?? undefined,
  theme: (record.theme ?? 'light') as User['theme'],
  mainCurrency: (record.mainCurrency ?? 'USD') as User['mainCurrency'],
  mercadoPagoConnected: Boolean(record.mercadoPagoAccessToken),
});

export async function GET() {
  try {
    const userId = await getUserIdOrThrow();
    let record = await UsersRepository.getById(userId);
    if (!record) {
      await UsersRepository.upsert(userId, {});
      record = await UsersRepository.getById(userId);
    }

    if (!record) {
      throw new Error('Unable to load profile');
    }

    return NextResponse.json(mapUser(record));
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();

    const updates: Parameters<typeof UsersRepository.upsert>[1] = {};
    if (typeof payload?.theme === 'string' && ['light', 'dark'].includes(payload.theme)) {
      updates.theme = payload.theme;
    }
    if (typeof payload?.mainCurrency === 'string' && payload.mainCurrency.length > 0) {
      updates.mainCurrency = payload.mainCurrency;
    }
    if (typeof payload?.name === 'string') {
      updates.name = payload.name;
    }
    if (typeof payload?.email === 'string') {
      updates.email = payload.email;
    }

    await UsersRepository.upsert(userId, updates);
    const updated = await UsersRepository.getById(userId);
    if (!updated) {
      throw new Error('Unable to update profile');
    }

    return NextResponse.json(mapUser(updated));
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
