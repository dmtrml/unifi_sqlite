import type { TransactionFilters } from '@/server/db/repositories/transactions-repo';

const parseNumber = (value: string | null) => {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export const parseTransactionFilters = (url: string): TransactionFilters => {
  const searchParams = new URL(url).searchParams;
  const includeUncategorized = searchParams.get('uncategorized') === 'true';
  const multiCategory = searchParams.getAll('categoryIds').filter(Boolean);
  const singleCategory = searchParams.get('categoryId') ?? undefined;
  return {
    accountId: searchParams.get('accountId') ?? undefined,
    categoryId: singleCategory,
    categoryIds: multiCategory.length > 0 ? multiCategory : singleCategory ? [singleCategory] : undefined,
    includeUncategorized,
    transactionType: (searchParams.get('transactionType') as TransactionFilters['transactionType']) ?? undefined,
    startDate: parseNumber(searchParams.get('startDate')),
    endDate: parseNumber(searchParams.get('endDate')),
    cursor: parseNumber(searchParams.get('cursor')),
    limit: parseNumber(searchParams.get('limit')),
    sort: (searchParams.get('sort') as TransactionFilters['sort']) ?? undefined,
    search: searchParams.get('search') ?? undefined,
  };
};
