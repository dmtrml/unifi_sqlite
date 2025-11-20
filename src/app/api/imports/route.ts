import { NextResponse } from 'next/server';
import { colorOptions } from '@/lib/colors';
import { inferAccountType } from '@/lib/account-types';
import type { NormalizedImportRow, ImportSummary, ImportErrorCode } from '@/lib/imports';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { AccountsRepository } from '@/server/db/repositories/accounts-repo';
import { CategoriesRepository } from '@/server/db/repositories/categories-repo';
import { ImportsRepository } from '@/server/db/repositories/imports-repo';
import { TransactionsService } from '@/server/db/services/transactions-service';
import { toCents } from '@/server/db/utils';
import { getSuggestedCategoryIcon } from '@/lib/category-icon-map';

type ImportRequestBody = {
  source?: string;
  rows: NormalizedImportRow[];
  defaultCurrency?: string;
  profileId?: string | null;
};

const DEFAULT_ACCOUNT_ICON = 'Landmark';
const DEFAULT_CATEGORY_ICON = 'MoreHorizontal';
const MAX_ERROR_DETAILS = 50;

class ImportRowError extends Error {
  code: ImportErrorCode;

  constructor(code: ImportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = 'ImportRowError';
  }
}

const asImportRowError = (error: unknown): ImportRowError => {
  if (error instanceof ImportRowError) return error;
  if (error instanceof Error) {
    return new ImportRowError('unknown', error.message, { cause: error });
  }
  return new ImportRowError('unknown', 'Unexpected error');
};

const buildRowSample = (row?: NormalizedImportRow | null) => {
  if (!row) return undefined;
  return {
    transactionType: row.transactionType,
    date: row.date,
    amount: row.amount ?? null,
    amountSent: row.amountSent ?? null,
    amountReceived: row.amountReceived ?? null,
    accountName: row.accountName ?? null,
    fromAccountName: row.fromAccountName ?? null,
    toAccountName: row.toAccountName ?? null,
    categoryName: row.categoryName ?? null,
  };
};

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
    const categoryKey = (name: string, parentId?: string | null) =>
      `${parentId ?? 'root'}::${name.trim().toLowerCase()}`;
    const categoryPathMap = new Map<string, (typeof existingCategories)[number]>();
    existingCategories.forEach((category) => {
      categoryPathMap.set(categoryKey(category.name, category.parentId ?? null), category);
    });

    const errorDetails: NonNullable<ImportSummary['errorDetails']> = [];
    const errorStats = new Map<(ImportErrorCode | 'other'), number>();

    const trackError = (rowIndex: number, error: unknown, row: NormalizedImportRow) => {
      const parsed = asImportRowError(error);
      const key = parsed.code ?? 'other';
      errorStats.set(key, (errorStats.get(key) ?? 0) + 1);
      if (errorDetails.length < MAX_ERROR_DETAILS) {
        errorDetails.push({
          rowIndex: rowIndex + 1,
          code: parsed.code,
          message: parsed.message,
          rowSample: buildRowSample(row),
        });
      }
    };

    const summary: ImportSummary = {
      successCount: 0,
      errorCount: 0,
      newAccounts: 0,
      newCategories: 0,
      newAccountNames: [],
      newCategoryNames: [],
    };

    let colorCursor = 0;
    const nextColor = () => {
      if (!colorOptions.length) return 'hsl(var(--muted-foreground))';
      const color = colorOptions[colorCursor % colorOptions.length]?.value;
      colorCursor += 1;
      return color ?? 'hsl(var(--muted-foreground))';
    };

    type ParsedCategoryField = { parentName: string | null; name: string };

    const parseCategoryField = (value?: string | null): ParsedCategoryField | null => {
      if (!value) return null;
      const normalized = value.trim();
      if (!normalized) return null;
      const separatorIndex = normalized.indexOf('/');
      if (separatorIndex === -1) {
        return { parentName: null, name: normalized };
      }
      const parentSegment = normalized.slice(0, separatorIndex).trim();
      const childSegment = normalized.slice(separatorIndex + 1).trim();
      if (!parentSegment || !childSegment) {
        return { parentName: null, name: normalized };
      }
      return { parentName: parentSegment, name: childSegment };
    };

    const ensureCategoryRecord = async (
      name: string,
      type: 'income' | 'expense',
      options?: { parentId?: string | null; displayPrefix?: string },
    ) => {
      const parentId = options?.parentId ?? null;
      const normalizedName = name.trim();
      if (!normalizedName) {
        throw new ImportRowError('missing_category', 'Category name is required.');
      }
      const key = categoryKey(normalizedName, parentId);
      const existing = categoryPathMap.get(key);
      if (existing) return existing;

      const created = await CategoriesRepository.create(userId, {
        name: normalizedName,
        icon: getSuggestedCategoryIcon(normalizedName, type) ?? DEFAULT_CATEGORY_ICON,
        color: nextColor(),
        type,
        parentId,
      });

      if (!created) throw new ImportRowError('transaction_service_error', 'Failed to create category.');

      categoryIdMap.set(created.id, created);
      categoryPathMap.set(key, created);
      summary.newCategories += 1;
      const label = options?.displayPrefix ? `${options.displayPrefix} / ${created.name}` : created.name;
      summary.newCategoryNames?.push(label);
      return created;
    };

    const resolveAccount = async (input: {
      id?: string | null;
      name?: string | null;
      currency?: string | null;
    }) => {
      if (input.id) {
        const record = accountIdMap.get(input.id);
        if (!record) throw new ImportRowError('missing_account', `Account ${input.id} not found.`);
        return record;
      }

      const name = input.name?.trim();
      if (!name) {
        throw new ImportRowError('missing_account', 'Account name is required.');
      }

      const key = name.toLowerCase();
      const existing = accountNameMap.get(key);
      if (existing) return existing;

      const created = await AccountsRepository.create(userId, {
        name,
        balanceCents: 0,
        icon: DEFAULT_ACCOUNT_ICON,
        color: nextColor(),
        type: inferAccountType(name),
        currency: normalizeCurrency(input.currency, defaultCurrency),
      });

      if (!created) throw new ImportRowError('transaction_service_error', 'Failed to create account.');

      accountIdMap.set(created.id, created);
      accountNameMap.set(key, created);
      summary.newAccounts += 1;
      summary.newAccountNames?.push(created.name);
      return created;
    };

    const resolveCategory = async (input: {
      id?: string | null;
      name?: string | null;
      type: 'income' | 'expense';
    }) => {
      if (input.id) {
        const record = categoryIdMap.get(input.id);
        if (!record) throw new ImportRowError('missing_category', `Category ${input.id} not found.`);
        return record;
      }

      const parsed = parseCategoryField(input.name ?? null);
      if (!parsed) return null;

      if (!parsed.parentName) {
        return ensureCategoryRecord(parsed.name, input.type);
      }

      const parentCategory = await ensureCategoryRecord(parsed.parentName, input.type);
      return ensureCategoryRecord(parsed.name, input.type, {
        parentId: parentCategory.id,
        displayPrefix: parentCategory.name,
      });
    };

    const ensurePositive = (value?: number | null) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new ImportRowError('invalid_amount', 'Amount must be greater than zero.');
      }
      return numeric;
    };

    const createTransactionRecord = async (
      params: Parameters<typeof TransactionsService.create>[1],
    ) => {
      try {
        await TransactionsService.create(userId, params);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create transaction.';
        throw new ImportRowError('transaction_service_error', message, {
          cause: error instanceof Error ? error : undefined,
        });
      }
    };

    const processRow = async (row: NormalizedImportRow) => {
      if (!row.transactionType) {
        throw new ImportRowError('unknown', 'Transaction type is required.');
      }
      const dateValue = Number(row.date);
      if (!Number.isFinite(dateValue)) {
        throw new ImportRowError('invalid_date', 'Invalid date value.');
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

        await createTransactionRecord({
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

      await createTransactionRecord({
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

    for (let index = 0; index < payload.rows.length; index += 1) {
      const row = payload.rows[index];
      try {
        await processRow(row);
        summary.successCount += 1;
      } catch (rowError) {
        console.error('Failed to import row', rowError);
        summary.errorCount += 1;
        trackError(index, rowError, row);
      }
    }

    if (errorDetails.length) {
      summary.errorDetails = errorDetails;
    }
    if (errorStats.size > 0) {
      summary.errorStats = Object.fromEntries(errorStats) as Partial<Record<ImportErrorCode | 'other', number>>;
    }
    summary.processedRows = payload.rows.length;

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
