import { startOfMonth, endOfMonth, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import type {
  Account,
  Category,
  CategorySummaryItem,
  Currency,
  IncomeExpensePoint,
  Transaction,
} from '@/lib/types';
import { convertAmount } from '@/lib/currency';
import { getCategoryRootId } from '@/lib/category-tree';

type BuildSummaryArgs = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  mainCurrency: Currency;
  dateRange?: DateRange;
};

export function buildCategorySummaryFromTransactions({
  transactions,
  categories,
  accounts,
  mainCurrency,
  dateRange,
}: BuildSummaryArgs) {
  const now = new Date();
  const rangeStart = dateRange?.from ?? startOfMonth(now);
  const rangeEnd = dateRange?.to ?? endOfMonth(now);
  const inclusiveEnd = new Date(rangeEnd);
  inclusiveEnd.setHours(23, 59, 59, 999);

  const accountCurrency = new Map(accounts.map((account) => [account.id, account.currency]));
  const categoryMeta = new Map(categories.map((category) => [category.id, category]));

  const summary = new Map<string, CategorySummaryItem>();
  let total = 0;

  transactions.forEach((transaction) => {
    if (transaction.transactionType !== 'expense') return;
    const dateValue =
      typeof (transaction.date as any)?.toDate === 'function'
        ? (transaction.date as any).toDate()
        : new Date(
            typeof (transaction.date as any) === 'number'
              ? (transaction.date as any)
              : String(transaction.date),
          );
    if (Number.isNaN(dateValue.getTime())) return;
    if (dateValue < rangeStart || dateValue > inclusiveEnd) return;

    const currency = transaction.accountId ? accountCurrency.get(transaction.accountId) : undefined;
    const fromCurrency = (currency ?? 'USD') as Currency;
    const amount = transaction.amount ?? 0;
    const converted = convertAmount(amount, fromCurrency, mainCurrency);
    if (!converted) return;

    let key = transaction.categoryId ?? 'uncategorized';
    let meta = transaction.categoryId ? categoryMeta.get(transaction.categoryId) : undefined;
    if (transaction.categoryId) {
      const rootId = getCategoryRootId(transaction.categoryId, categories);
      if (rootId) {
        key = rootId;
        meta = categoryMeta.get(rootId) ?? meta;
      }
    }

    const entry =
      summary.get(key) ??
      {
        categoryId: key === 'uncategorized' ? null : key,
        name: meta?.name ?? 'Uncategorized',
        color: meta?.color ?? null,
        icon: meta?.icon ?? null,
        total: 0,
      };
    entry.total += converted;
    total += converted;
    summary.set(key, entry);
  });

  const items = Array.from(summary.values())
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    items,
    total,
  };
}

type IncomeExpenseArgs = {
  transactions: Transaction[];
  accounts: Account[];
  mainCurrency: Currency;
};

export function buildIncomeExpenseSeriesFromTransactions({
  transactions,
  accounts,
  mainCurrency,
}: IncomeExpenseArgs): IncomeExpensePoint[] {
  const accountCurrency = new Map(accounts.map((account) => [account.id, account.currency]));
  const buckets = new Map<string, { income: number; expense: number }>();

  transactions.forEach((transaction) => {
    if (transaction.transactionType === 'transfer') return;
    const dateValue =
      typeof (transaction.date as any)?.toMillis === 'function'
        ? (transaction.date as any).toMillis()
        : typeof (transaction.date as any) === 'number'
        ? (transaction.date as any)
        : Date.parse(String(transaction.date));
    if (!Number.isFinite(dateValue)) return;
    const bucketDate = startOfMonth(new Date(dateValue));
    const key = format(bucketDate, 'yyyy-MM-01');
    const currency = transaction.accountId ? accountCurrency.get(transaction.accountId) : undefined;
    const fromCurrency = (currency ?? 'USD') as Currency;
    const amount = convertAmount(transaction.amount ?? 0, fromCurrency, mainCurrency);
    const entry = buckets.get(key) ?? { income: 0, expense: 0 };
    if (transaction.transactionType === 'income') {
      entry.income += amount;
    } else if (transaction.transactionType === 'expense') {
      entry.expense += amount;
    }
    buckets.set(key, entry);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([month, values]) => ({
      month,
      income: values.income,
      expense: values.expense,
    }));
}
