import { NextResponse } from 'next/server';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { db } from '@/server/db/connection';
import { transactions, accounts, categories } from '@/server/db/schema';
import { convertAmount } from '@/lib/currency';
import type { CategorySummaryItem, Currency } from '@/lib/types';
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

    const filters = [eq(transactions.userId, userId), eq(transactions.transactionType, 'expense' as const)];
    if (typeof startDate === 'number') {
      filters.push(gte(transactions.date, startDate));
    }
    if (typeof endDate === 'number') {
      filters.push(lte(transactions.date, endDate));
    }

    const currencyExpr = sql<string>`coalesce(${accounts.currency}, 'USD')`;
    const totalExpr = sql<number>`sum(coalesce(${transactions.amountCents}, 0))`;

    const rows = db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        currency: currencyExpr,
        totalCents: totalExpr,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...filters))
      .groupBy(transactions.categoryId, categories.name, categories.color, categories.icon, accounts.currency)
      .all();

    const map = new Map<string, CategorySummaryItem>();
    let totalSpent = 0;

    rows.forEach((row) => {
      const key = row.categoryId ?? 'uncategorized';
      const existing = map.get(key) ?? {
        categoryId: row.categoryId ?? null,
        name: row.categoryName ?? 'Uncategorized',
        color: row.categoryColor ?? null,
        icon: row.categoryIcon ?? null,
        total: 0,
      };

      const amount = (row.totalCents ?? 0) / 100;
      const fromCurrency = (row.currency ?? 'USD') as Currency;
      const converted = convertAmount(amount, fromCurrency, mainCurrency);
      existing.total += converted;
      totalSpent += converted;
      map.set(key, existing);
    });

    const items = Array.from(map.values())
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ mainCurrency, total: totalSpent, items });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
