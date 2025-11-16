import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { AccountsRepository } from '@/server/db/repositories/accounts-repo';
import { CategoriesRepository } from '@/server/db/repositories/categories-repo';
import { BudgetsRepository } from '@/server/db/repositories/budgets-repo';
import { TransactionsRepository } from '@/server/db/repositories/transactions-repo';
import { RecurringRepository } from '@/server/db/repositories/recurring-repo';
import { TransactionsService } from '@/server/db/services/transactions-service';
import { CURRENT_BACKUP_SCHEMA_VERSION, type BackupPayload } from '@/lib/backups';

const backupSchema = z.object({
  meta: z.object({
    schemaVersion: z.number(),
    exportedAt: z.string(),
  }),
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      balance: z.number(),
      icon: z.string(),
      color: z.string(),
      userId: z.string(),
      type: z.string(),
      currency: z.string(),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      name: z.string(),
      icon: z.string(),
      color: z.string(),
      type: z.enum(['expense', 'income']),
      parentId: z.string().nullable(),
    }),
  ),
  budgets: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      categoryId: z.string(),
      amount: z.number(),
      currency: z.string(),
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      transactionType: z.enum(['expense', 'income', 'transfer']),
      accountId: z.string().nullable(),
      fromAccountId: z.string().nullable(),
      toAccountId: z.string().nullable(),
      categoryId: z.string().nullable(),
      amount: z.number().nullable(),
      amountSent: z.number().nullable(),
      amountReceived: z.number().nullable(),
      date: z.number(),
      description: z.string(),
    }),
  ),
  recurring: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      accountId: z.string(),
      categoryId: z.string(),
      amount: z.number(),
      description: z.string(),
      frequency: z.enum(['weekly', 'bi-weekly', 'monthly']),
      startDate: z.number(),
    }),
  ),
});

const mapTransaction = (
  record: Awaited<ReturnType<typeof TransactionsRepository.listRange>>[number],
) => ({
  id: record.id,
  userId: record.userId,
  transactionType: record.transactionType as BackupPayload['transactions'][number]['transactionType'],
  accountId: record.accountId,
  fromAccountId: record.fromAccountId,
  toAccountId: record.toAccountId,
  categoryId: record.categoryId,
  amount: record.amountCents != null ? record.amountCents / 100 : null,
  amountSent: record.amountSentCents != null ? record.amountSentCents / 100 : null,
  amountReceived: record.amountReceivedCents != null ? record.amountReceivedCents / 100 : null,
  date: record.date,
  description: record.description ?? '',
});

export async function GET() {
  try {
    const userId = await getUserIdOrThrow();
    const [accounts, categories, budgets, transactions, recurring] = await Promise.all([
      AccountsRepository.list(userId),
      CategoriesRepository.list(userId),
      BudgetsRepository.list(userId),
      TransactionsRepository.listRange(userId),
      RecurringRepository.list(userId),
    ]);

    const payload: BackupPayload = {
      meta: {
        schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        balance: account.balanceCents / 100,
        icon: account.icon,
        color: account.color,
        userId: account.userId,
        type: account.type as BackupPayload['accounts'][number]['type'],
        currency: account.currency as BackupPayload['accounts'][number]['currency'],
      })),
      categories: categories.map((category) => ({
        id: category.id,
        userId: category.userId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type as BackupPayload['categories'][number]['type'],
        parentId: category.parentId ?? null,
      })),
      budgets: budgets.map((budget) => ({
        id: budget.id,
        userId: budget.userId,
        categoryId: budget.categoryId,
        amount: budget.amountCents / 100,
        currency: budget.currency as BackupPayload['budgets'][number]['currency'],
      })),
      transactions: transactions.map(mapTransaction),
      recurring: recurring.map((item) => ({
        id: item.id,
        userId: item.userId,
        accountId: item.accountId,
        categoryId: item.categoryId,
        amount: item.amountCents / 100,
        description: item.description,
        frequency: item.frequency as BackupPayload['recurring'][number]['frequency'],
        startDate: item.startDate,
      })),
    };

    const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}

const withRecreatedAccounts = async (
  userId: string,
  entries: BackupPayload['accounts'],
) => {
  const existing = await AccountsRepository.list(userId);
  for (const account of existing) {
    await AccountsRepository.delete(userId, account.id);
  }
  for (const entry of entries) {
    await AccountsRepository.create(userId, {
      id: entry.id,
      name: entry.name,
      balanceCents: Math.round(entry.balance * 100),
      icon: entry.icon,
      color: entry.color,
      type: entry.type as any,
      currency: entry.currency,
    });
  }
};

const withRecreatedCategories = async (
  userId: string,
  entries: BackupPayload['categories'],
) => {
  const existing = await CategoriesRepository.list(userId);
  for (const category of existing) {
    await CategoriesRepository.delete(userId, category.id);
  }

  const pending = new Map(entries.map((entry) => [entry.id, entry]));
  const inserted = new Set<string>();

  while (pending.size > 0) {
    let progress = false;
    for (const [id, entry] of pending) {
      if (!entry.parentId || inserted.has(entry.parentId)) {
        await CategoriesRepository.create(userId, {
          id: entry.id,
          name: entry.name,
          icon: entry.icon,
          color: entry.color,
          type: entry.type,
          parentId: entry.parentId,
        });
        inserted.add(id);
        pending.delete(id);
        progress = true;
      }
    }
    if (!progress) {
      throw new Error('Failed to restore categories: missing parents');
    }
  }
};

const withRecreatedBudgets = async (
  userId: string,
  entries: BackupPayload['budgets'],
) => {
  const existing = await BudgetsRepository.list(userId);
  for (const budget of existing) {
    await BudgetsRepository.delete(userId, budget.id);
  }
  for (const entry of entries) {
    await BudgetsRepository.upsert(userId, {
      id: entry.id,
      categoryId: entry.categoryId,
      amountCents: Math.round(entry.amount * 100),
      currency: entry.currency as any,
    });
  }
};

const withRecreatedTransactions = async (
  userId: string,
  entries: BackupPayload['transactions'],
) => {
  await TransactionsRepository.deleteAll(userId);
  for (const entry of entries) {
    await TransactionsService.create(userId, {
      transactionType: entry.transactionType,
      accountId: entry.accountId ?? null,
      fromAccountId: entry.fromAccountId ?? null,
      toAccountId: entry.toAccountId ?? null,
      categoryId: entry.categoryId ?? null,
      amountCents: entry.amount != null ? Math.round(entry.amount * 100) : undefined,
      amountSentCents: entry.amountSent != null ? Math.round(entry.amountSent * 100) : undefined,
      amountReceivedCents: entry.amountReceived != null ? Math.round(entry.amountReceived * 100) : undefined,
      date: entry.date,
      description: entry.description,
    });
  }
};

const withRecreatedRecurring = async (
  userId: string,
  entries: BackupPayload['recurring'],
) => {
  const existing = await RecurringRepository.list(userId);
  for (const rec of existing) {
    await RecurringRepository.delete(userId, rec.id);
  }
  for (const entry of entries) {
    await RecurringRepository.create(userId, {
      id: entry.id,
      accountId: entry.accountId,
      categoryId: entry.categoryId,
      amountCents: Math.round(entry.amount * 100),
      description: entry.description,
      frequency: entry.frequency,
      startDate: entry.startDate,
    });
  }
};

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = backupSchema.parse(await request.json());
    if (payload.meta.schemaVersion !== CURRENT_BACKUP_SCHEMA_VERSION) {
      return NextResponse.json(
        { message: 'Unsupported backup schema version.' },
        { status: 400 },
      );
    }

    await withRecreatedAccounts(userId, payload.accounts);
    await withRecreatedCategories(userId, payload.categories);
    await withRecreatedBudgets(userId, payload.budgets);
    await withRecreatedTransactions(userId, payload.transactions);
    await withRecreatedRecurring(userId, payload.recurring);
    for (const account of payload.accounts) {
      await AccountsRepository.update(userId, account.id, {
        balanceCents: Math.round(account.balance * 100),
      });
    }

    return NextResponse.json({
      message: 'Backup restored successfully.',
      summary: {
        accounts: payload.accounts.length,
        categories: payload.categories.length,
        budgets: payload.budgets.length,
        transactions: payload.transactions.length,
        recurring: payload.recurring.length,
      },
    });
  } catch (error) {
    console.error('Failed to restore backup', error);
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
