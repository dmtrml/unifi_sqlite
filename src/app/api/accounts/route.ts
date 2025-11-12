import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { AccountsRepository } from '@/server/db/repositories/accounts-repo';
import type { Account } from '@/lib/types';

const toAccountDto = (record: Awaited<ReturnType<typeof AccountsRepository.list>>[number]): Account => ({
  id: record.id,
  name: record.name,
  balance: record.balanceCents / 100,
  icon: record.icon,
  color: record.color,
  userId: record.userId,
  type: record.type as Account['type'],
  currency: record.currency as Account['currency'],
});

export async function GET() {
  try {
    const userId = await getUserIdOrThrow();
    const records = await AccountsRepository.list(userId);
    return NextResponse.json(records.map(toAccountDto));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();
    if (!payload?.name) {
      return NextResponse.json({ message: 'Name is required.' }, { status: 400 });
    }

    const balanceValue = typeof payload.balance === 'number' ? payload.balance : 0;
    const record = await AccountsRepository.create(userId, {
      name: payload.name,
      balanceCents: Math.round(balanceValue * 100),
      icon: payload.icon ?? 'Landmark',
      color: payload.color ?? 'hsl(var(--muted-foreground))',
      type: payload.type ?? 'Card',
      currency: payload.currency ?? 'USD',
    });

    if (!record) {
      return NextResponse.json({ message: 'Failed to create account.' }, { status: 500 });
    }

    return NextResponse.json(toAccountDto(record), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}
