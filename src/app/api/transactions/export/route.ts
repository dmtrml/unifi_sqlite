import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { TransactionsRepository } from '@/server/db/repositories/transactions-repo';
import { AccountsRepository } from '@/server/db/repositories/accounts-repo';
import { CategoriesRepository } from '@/server/db/repositories/categories-repo';
import { parseTransactionFilters } from '@/app/api/transactions/utils';

type ExportFormat = 'csv' | 'json';

const formatDate = (value: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

export async function GET(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') as ExportFormat) ?? 'csv';
    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json({ message: 'Unsupported format.' }, { status: 400 });
    }

    const filters = parseTransactionFilters(request.url);
    const listFilters = { ...filters };
    delete (listFilters as any).cursor;
    delete (listFilters as any).limit;

    const [rows, accounts, categories] = await Promise.all([
      TransactionsRepository.listRange(userId, listFilters),
      AccountsRepository.list(userId),
      CategoriesRepository.list(userId),
    ]);

    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    const exportRows = rows.map((row) => {
      const account = row.accountId ? accountMap.get(row.accountId) : null;
      const fromAccount = row.fromAccountId ? accountMap.get(row.fromAccountId) : null;
      const toAccount = row.toAccountId ? accountMap.get(row.toAccountId) : null;
      const category = row.categoryId ? categoryMap.get(row.categoryId) : null;

      return {
        date: formatDate(row.date),
        type: row.transactionType,
        description: row.description ?? '',
        accountName: account?.name ?? null,
        accountCurrency: account?.currency ?? null,
        categoryName: category?.name ?? null,
        amount: row.amountCents != null ? row.amountCents / 100 : null,
        amountCurrency: account?.currency ?? null,
        fromAccountName: fromAccount?.name ?? null,
        fromAccountCurrency: fromAccount?.currency ?? null,
        toAccountName: toAccount?.name ?? null,
        toAccountCurrency: toAccount?.currency ?? null,
        amountSent: row.amountSentCents != null ? row.amountSentCents / 100 : null,
        amountSentCurrency: fromAccount?.currency ?? null,
        amountReceived: row.amountReceivedCents != null ? row.amountReceivedCents / 100 : null,
        amountReceivedCurrency: toAccount?.currency ?? null,
      };
    });

    if (format === 'json') {
      const filename = `transactions-${new Date().toISOString().slice(0, 10)}.json`;
      return new NextResponse(JSON.stringify(exportRows, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const headers = [
      'date',
      'type',
      'description',
      'accountName',
      'accountCurrency',
      'categoryName',
      'amount',
      'amountCurrency',
      'fromAccountName',
      'fromAccountCurrency',
      'toAccountName',
      'toAccountCurrency',
      'amountSent',
      'amountSentCurrency',
      'amountReceived',
      'amountReceivedCurrency',
    ];

    const csvRows = [headers.join(',')];
    exportRows.forEach((row) => {
      const values = [
        row.date ?? '',
        row.type ?? '',
        row.description ?? '',
        row.accountName ?? '',
        row.accountCurrency ?? '',
        row.categoryName ?? '',
        row.amount != null ? String(row.amount) : '',
        row.amountCurrency ?? '',
        row.fromAccountName ?? '',
        row.fromAccountCurrency ?? '',
        row.toAccountName ?? '',
        row.toAccountCurrency ?? '',
        row.amountSent != null ? String(row.amountSent) : '',
        row.amountSentCurrency ?? '',
        row.amountReceived != null ? String(row.amountReceived) : '',
        row.amountReceivedCurrency ?? '',
      ];

      const csvRow = values
        .map((value) => {
          const stringValue = value ?? '';
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',');
      csvRows.push(csvRow);
    });

    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
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
