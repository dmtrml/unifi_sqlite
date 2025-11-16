import { NextResponse } from 'next/server';
import { startOfMonth, endOfMonth } from 'date-fns';
import type { Account, Budget, Category, Transaction, User } from '@/lib/types';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { UsersRepository } from '@/server/db/repositories/users-repo';
import { AccountsRepository } from '@/server/db/repositories/accounts-repo';
import { CategoriesRepository } from '@/server/db/repositories/categories-repo';
import { BudgetsRepository } from '@/server/db/repositories/budgets-repo';
import { TransactionsRepository } from '@/server/db/repositories/transactions-repo';

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

const mapAccount = (
  record: Awaited<ReturnType<typeof AccountsRepository.list>>[number],
): Account => ({
  id: record.id,
  name: record.name,
  balance: record.balanceCents / 100,
  icon: record.icon,
  color: record.color,
  userId: record.userId,
  type: record.type as Account['type'],
  currency: record.currency as Account['currency'],
});

const mapCategory = (
  record: Awaited<ReturnType<typeof CategoriesRepository.list>>[number],
): Category => ({
  id: record.id,
  name: record.name,
  icon: record.icon,
  color: record.color,
  userId: record.userId,
  type: (record.type as Category['type']) ?? 'expense',
  parentId: record.parentId ?? null,
});

const mapBudget = (
  record: Awaited<ReturnType<typeof BudgetsRepository.list>>[number],
): Budget => ({
  id: record.id,
  categoryId: record.categoryId,
  amount: record.amountCents / 100,
  currency: record.currency as Budget['currency'],
  userId: record.userId,
});

type DashboardTransactionPayload = Omit<
  Transaction,
  'date' | 'amount' | 'amountSent' | 'amountReceived'
> & {
  date: number;
  amount?: number | null;
  amountSent?: number | null;
  amountReceived?: number | null;
};

const mapTransaction = (
  record: NonNullable<ReturnType<typeof TransactionsRepository.listRange>[number]>,
): DashboardTransactionPayload => ({
  id: record.id,
  userId: record.userId,
  accountId: record.accountId ?? undefined,
  fromAccountId: record.fromAccountId ?? undefined,
  toAccountId: record.toAccountId ?? undefined,
  categoryId: record.categoryId ?? undefined,
  amount: record.amountCents != null ? record.amountCents / 100 : null,
  amountSent: record.amountSentCents != null ? record.amountSentCents / 100 : null,
  amountReceived: record.amountReceivedCents != null ? record.amountReceivedCents / 100 : null,
  date: record.date,
  description: record.description ?? '',
  transactionType: record.transactionType as Transaction['transactionType'],
  expenseType: (record.expenseType ?? undefined) as Transaction['expenseType'],
  incomeType: (record.incomeType ?? undefined) as Transaction['incomeType'],
});

export async function GET() {
  try {
    const userId = await getUserIdOrThrow();

    let profileRecord = await UsersRepository.getById(userId);
    if (!profileRecord) {
      await UsersRepository.upsert(userId, {});
      profileRecord = await UsersRepository.getById(userId);
    }
    if (!profileRecord) {
      throw new Error('Unable to load profile');
    }

    const rangeStart = startOfMonth(new Date()).getTime();
    const rangeEnd = endOfMonth(new Date()).getTime();

    const [accounts, categories, budgets, transactions] = await Promise.all([
      AccountsRepository.list(userId),
      CategoriesRepository.list(userId),
      BudgetsRepository.list(userId),
      TransactionsRepository.listRange(userId, {
        startDate: rangeStart,
        endDate: rangeEnd,
        sort: 'desc',
      }),
    ]);

    return NextResponse.json({
      profile: mapUser(profileRecord),
      accounts: accounts.map(mapAccount),
      categories: categories.map(mapCategory),
      budgets: budgets.map(mapBudget),
      transactions: transactions.map(mapTransaction),
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
