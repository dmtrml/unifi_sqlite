import { NextResponse } from 'next/server';
import { and, eq, gte, lte, inArray, sql } from 'drizzle-orm';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { db } from '@/server/db/connection';
import { transactions, accounts } from '@/server/db/schema';
import { convertAmount } from '@/lib/currency';
import type { Currency, IncomeExpensePoint } from '@/lib/types';
import { UsersRepository } from '@/server/db/repositories/users-repo';

const parseNumber = (value: string | null) => {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export async function GET(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const user = await UsersRepository.getById(userId);
    const mainCurrency = (user?.mainCurrency ?? 'USD') as Currency;

    const searchParams = new URL(request.url).searchParams;
    const startDate = parseNumber(searchParams.get('startDate'));
    const endDate = parseNumber(searchParams.get('endDate'));

    const filters = [eq(transactions.userId, userId), inArray(transactions.transactionType, ['income', 'expense'])];
    if (typeof startDate === 'number') {
      filters.push(gte(transactions.date, startDate));
    }
    if (typeof endDate === 'number') {
      filters.push(lte(transactions.date, endDate));
    }

    const monthBucket = sql<string>`strftime('%Y-%m-01', datetime(${transactions.date} / 1000, 'unixepoch'))`;
    const currencyExpr = sql<string>`coalesce(${accounts.currency}, 'USD')`;
    const totalExpr = sql<number>`sum(coalesce(${transactions.amountCents}, 0))`;

    const rows = db
      .select({
        bucket: monthBucket,
        transactionType: transactions.transactionType,
        currency: currencyExpr,
        totalCents: totalExpr,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...filters))
      .groupBy(monthBucket, transactions.transactionType, accounts.currency)
      .all();

    const map = new Map<string, { income: number; expense: number }>();
    rows.forEach(({ bucket, transactionType, currency, totalCents }) => {
      if (!bucket || !transactionType) return;
      const amount = (totalCents ?? 0) / 100;
      const fromCurrency = (currency ?? 'USD') as Currency;
      const converted = convertAmount(amount, fromCurrency, mainCurrency);
      const entry = map.get(bucket) ?? { income: 0, expense: 0 };
      if (transactionType === 'income') {
        entry.income += converted;
      } else {
        entry.expense += converted;
      }
      map.set(bucket, entry);
    });

    const items: IncomeExpensePoint[] = Array.from(map.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([month, values]) => ({
        month,
        income: values.income,
        expense: values.expense,
      }));

    return NextResponse.json({ mainCurrency, items });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
