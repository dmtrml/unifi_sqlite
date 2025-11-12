import { NextResponse } from 'next/server';
import type { Budget } from '@/lib/types';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { BudgetsRepository } from '@/server/db/repositories/budgets-repo';
import { toCents } from '@/server/db/utils';

const mapBudget = (
  record: Awaited<ReturnType<typeof BudgetsRepository.list>>[number],
): Budget => ({
  id: record.id,
  categoryId: record.categoryId,
  amount: record.amountCents / 100,
  currency: record.currency as Budget['currency'],
  userId: record.userId,
});

export async function GET() {
  try {
    const userId = await getUserIdOrThrow();
    const items = await BudgetsRepository.list(userId);
    return NextResponse.json(items.map(mapBudget));
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();

    if (!payload?.categoryId) {
      return NextResponse.json({ message: 'categoryId is required.' }, { status: 400 });
    }

    const amountValue =
      typeof payload.amount === 'number' && Number.isFinite(payload.amount)
        ? payload.amount
        : 0;

    const budget = await BudgetsRepository.upsert(userId, {
      id: payload.id,
      categoryId: payload.categoryId,
      amountCents: toCents(amountValue),
      currency: payload.currency ?? 'USD',
    });

    if (!budget) {
      return NextResponse.json({ message: 'Failed to save budget.' }, { status: 500 });
    }

    return NextResponse.json(mapBudget(budget), { status: 201 });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
