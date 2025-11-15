import { NextResponse } from 'next/server';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { db } from '@/server/db/connection';
import { accounts, budgets, transactions } from '@/server/db/schema';
import { convertAmount } from '@/lib/currency';
import type { Currency, DashboardKPI } from '@/lib/types';

const parseNumber = (value: string | null) => {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export async function GET(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const searchParams = new URL(request.url).searchParams;
    const startDate = parseNumber(searchParams.get('startDate'));
    const endDate = parseNumber(searchParams.get('endDate'));
    const mainCurrency = (searchParams.get('currency') ?? 'USD') as Currency;

    const accountRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));

    const budgetRows = await db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId));

    const filters = [eq(transactions.userId, userId)];
    if (typeof startDate === 'number') {
      filters.push(gte(transactions.date, startDate));
    }
    if (typeof endDate === 'number') {
      filters.push(lte(transactions.date, endDate));
    }

    const transactionRows = await db
      .select()
      .from(transactions)
      .where(and(...filters))
      .all();

    const totalIncome = transactionRows
      .filter((tx) => tx.transactionType === 'income')
      .reduce((sum, tx) => {
        const accountCurrency =
          accountRows.find((account) => account.id === tx.accountId)?.currency ?? 'USD';
        return sum + convertAmount((tx.amountCents ?? 0) / 100, accountCurrency as Currency, mainCurrency);
      }, 0);

    const totalExpenses = transactionRows
      .filter((tx) => tx.transactionType === 'expense')
      .reduce((sum, tx) => {
        const accountCurrency =
          accountRows.find((account) => account.id === tx.accountId)?.currency ?? 'USD';
        return sum + convertAmount((tx.amountCents ?? 0) / 100, accountCurrency as Currency, mainCurrency);
      }, 0);

    const totalBudget = budgetRows.reduce((sum, budget) => {
      return sum + convertAmount((budget.amountCents ?? 0) / 100, (budget.currency ?? 'USD') as Currency, mainCurrency);
    }, 0);

    const netWorth = accountRows.reduce((sum, account) => {
      return sum + convertAmount((account.balanceCents ?? 0) / 100, account.currency as Currency, mainCurrency);
    }, 0);

    const result: DashboardKPI = {
      totalIncome,
      totalExpenses,
      totalBudget,
      netWorth,
    };

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
