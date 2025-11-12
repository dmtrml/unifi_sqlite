import { NextResponse } from 'next/server';
import { colorOptions } from '@/lib/colors';
import type { NormalizedImportRow, ImportSummary } from '@/lib/imports';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { AccountsRepository } from '@/server/db/repositories/accounts-repo';
import { CategoriesRepository } from '@/server/db/repositories/categories-repo';
import { ImportsRepository } from '@/server/db/repositories/imports-repo';
import { TransactionsService } from '@/server/db/services/transactions-service';
import { toCents } from '@/server/db/utils';

type ImportRequestBody = {
  source?: string;
  rows: NormalizedImportRow[];
  defaultCurrency?: string;
};

const DEFAULT_ACCOUNT_ICON = 'Landmark';
const DEFAULT_ACCOUNT_TYPE = 'Bank Account';
const DEFAULT_CATEGORY_ICON = 'MoreHorizontal';

const normalizeCurrency = (value?: string | null, fallback?: string) => {
  const candidate = value ?? fallback ?? 'USD';
  return candidate.trim().toUpperCase();
};

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = (await request.json()) as ImportRequestBody;

    if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
      return NextResponse.json({ message: 'rows must be a non-empty array.' }, { status: 400 });
    }

    const defaultCurrency = normalizeCurrency(payload.defaultCurrency, 'USD');
    const source = (payload.source ?? 'csv').toString();

    const existingAccounts = await AccountsRepository.list(userId);
    const existingCategories = await CategoriesRepository.list(userId);

    const accountIdMap = new Map(existingAccounts.map((account) => [account.id, account]));
    const accountNameMap = new Map(
      existingAccounts.map((account) => [account.name.trim().toLowerCase(), account]),
    );

    const categoryIdMap = new Map(existingCategories.map((category) => [category.id, category]));
    const categoryNameMap = new Map(
      existingCategories.map((category) => [category.name.trim().toLowerCase(), category]),
    );

    const summary: ImportSummary = {
      successCount: 0,
      errorCount: 0,
      newAccounts: 0,
      newCategories: 0,
    };

    let colorCursor = 0;
    const nextColor = () => {
      if (!colorOptions.length) return 'hsl(var(--muted-foreground))';
      const color = colorOptions[colorCursor % colorOptions.length]?.value;
      colorCursor += 1;
      return color ?? 'hsl(var(--muted-foreground))';
    };

    const resolveAccount = async (input: {
      id?: string | null;
      name?: string | null;
      currency?: string | null;
    }) => {
      if (input.id) {
        const record = accountIdMap.get(input.id);
        if (!record) throw new Error(`Account ${input.id} not found.`);
        return record;
      }

      const name = input.name?.trim();
      if (!name) {
        throw new Error('Account name is required.');
      }

      const key = name.toLowerCase();
      const existing = accountNameMap.get(key);
      if (existing) return existing;

      const created = await AccountsRepository.create(userId, {
        name,
        balanceCents: 0,
        icon: DEFAULT_ACCOUNT_ICON,
        color: nextColor(),
        type: DEFAULT_ACCOUNT_TYPE,
        currency: normalizeCurrency(input.currency, defaultCurrency),
      });

      if (!created) throw new Error('Failed to create account.');

      accountIdMap.set(created.id, created);
      accountNameMap.set(key, created);
      summary.newAccounts += 1;
      return created;
    };

    const resolveCategory = async (input: {
      id?: string | null;
      name?: string | null;
      type: 'income' | 'expense';
    }) => {
      if (input.id) {
        const record = categoryIdMap.get(input.id);
        if (!record) throw new Error(`Category ${input.id} not found.`);
        return record;
      }

      const name = input.name?.trim();
      if (!name) return null;

      const key = name.toLowerCase();
      const existing = categoryNameMap.get(key);
      if (existing) return existing;

      const created = await CategoriesRepository.create(userId, {
        name,
        icon: DEFAULT_CATEGORY_ICON,
        color: nextColor(),
        type: input.type,
      });

      if (!created) throw new Error('Failed to create category.');

      categoryIdMap.set(created.id, created);
      categoryNameMap.set(key, created);
      summary.newCategories += 1;
      return created;
    };

    const ensurePositive = (value?: number | null) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error('Amount must be greater than zero.');
      }
      return numeric;
    };

    const processRow = async (row: NormalizedImportRow) => {
      const dateValue = Number(row.date);
      if (!Number.isFinite(dateValue)) {
        throw new Error('Invalid date.');
      }

      const description = row.description ?? '';
      if (row.transactionType === 'transfer') {
        const debit = ensurePositive(row.amountSent ?? row.amount);
        const credit = ensurePositive(row.amountReceived ?? row.amount);

        const fromAccount = await resolveAccount({
          id: row.fromAccountId ?? row.accountId ?? null,
          name: row.fromAccountName ?? row.accountName ?? null,
          currency: row.fromAccountCurrency ?? row.accountCurrency ?? defaultCurrency,
        });

        const toAccount = await resolveAccount({
          id: row.toAccountId,
          name: row.toAccountName,
          currency: row.toAccountCurrency ?? defaultCurrency,
        });

        await TransactionsService.create(userId, {
          transactionType: 'transfer',
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          categoryId: null,
          amountCents: debit === credit ? toCents(debit) : undefined,
          amountSentCents: toCents(debit),
          amountReceivedCents: toCents(credit),
          date: dateValue,
          description,
        });
        return;
      }

      const amount = ensurePositive(row.amount ?? row.amountSent ?? row.amountReceived);
      const account = await resolveAccount({
        id: row.accountId,
        name: row.accountName,
        currency: row.accountCurrency ?? defaultCurrency,
      });

      const category =
        (await resolveCategory({
          id: row.categoryId,
          name: row.categoryName,
          type: row.transactionType,
        })) ?? null;

      await TransactionsService.create(userId, {
        transactionType: row.transactionType,
        accountId: account.id,
        categoryId: category?.id ?? null,
        amountCents: toCents(amount),
        date: dateValue,
        description,
        expenseType: row.transactionType === 'expense' ? 'optional' : null,
        incomeType: row.transactionType === 'income' ? 'active' : null,
      });
    };

    for (const row of payload.rows) {
      try {
        await processRow(row);
        summary.successCount += 1;
      } catch (rowError) {
        console.error('Failed to import row', rowError);
        summary.errorCount += 1;
      }
    }

    await ImportsRepository.create(userId, {
      source,
      status: summary.errorCount ? 'failed' : 'completed',
      meta: summary,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Import API error', error);
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
