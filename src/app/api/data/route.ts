import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { db } from '@/server/db/connection';
import {
  accounts,
  budgets,
  categories,
  imports,
  recurringTransactions,
} from '@/server/db/schema';
import { TransactionsService } from '@/server/db/services/transactions-service';

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json().catch(() => ({}));
    const scope = payload?.scope;

    if (scope !== 'transactions' && scope !== 'all') {
      return NextResponse.json({ message: 'Invalid scope.' }, { status: 400 });
    }

    await TransactionsService.deleteAll(userId, { resetAccountBalances: scope === 'transactions' });

    if (scope === 'all') {
      db.delete(recurringTransactions).where(eq(recurringTransactions.userId, userId)).run();
      db.delete(budgets).where(eq(budgets.userId, userId)).run();
      db.delete(categories).where(eq(categories.userId, userId)).run();
      db.delete(accounts).where(eq(accounts.userId, userId)).run();
      db.delete(imports).where(eq(imports.userId, userId)).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
