import { useMemo, useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';
import { Timestamp } from '@/lib/timestamp';
import type { Transaction } from '@/lib/types';
import { useUser } from '@/lib/auth-context';
import { subscribeToTransactions } from '@/lib/transactions-events';

export type UseTransactionsFilters = {
  accountId?: string;
  categoryId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
  search?: string;
};

type FetchKey = [string, string, string];
type TransactionPage = {
  items: Transaction[];
  nextCursor: number | null;
  hasMore: boolean;
};

const buildQuery = (filters?: UseTransactionsFilters, cursor?: number | null) => {
  const params = new URLSearchParams();
  const limit = filters?.limit ?? 50;
  params.set('limit', String(limit));
  params.set('sort', filters?.sort ?? 'desc');
  if (filters?.accountId && filters.accountId !== 'all') {
    params.set('accountId', filters.accountId);
  }
  if (filters?.categoryId && filters.categoryId !== 'all') {
    params.set('categoryId', filters.categoryId);
  }
  if (typeof filters?.startDate === 'number') {
    params.set('startDate', String(filters.startDate));
  }
  if (typeof filters?.endDate === 'number') {
    params.set('endDate', String(filters.endDate));
  }
  if (filters?.search) {
    params.set('search', filters.search);
  }
  if (typeof cursor === 'number') {
    params.set('cursor', String(cursor));
  }
  return params.toString();
};

const fetcher = async ([, uid, queryString]: FetchKey): Promise<TransactionPage> => {
  const response = await fetch(`/api/transactions?${queryString}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-uid': uid,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Failed to load transactions');
  }

  const payload = await response.json();
  return {
    items: (payload.items ?? []).map((item: any) => ({
      ...item,
      amount: item.amount ?? null,
      amountSent: item.amountSent ?? null,
      amountReceived: item.amountReceived ?? null,
      date: Timestamp.fromMillis(item.date),
    })),
    nextCursor: typeof payload.nextCursor === 'number' ? payload.nextCursor : null,
    hasMore: Boolean(payload.hasMore),
  };
};

export function useTransactions(filters?: UseTransactionsFilters) {
  const { user } = useUser();
  const limit = filters?.limit ?? 50;
  const normalizedFilters = useMemo(() => ({ ...(filters ?? {}), limit }), [filters, limit]);
  const filtersKey = useMemo(() => JSON.stringify(normalizedFilters), [normalizedFilters]);

  const getKey = (
    pageIndex: number,
    previousPageData: TransactionPage | null,
  ): FetchKey | null => {
    if (!user) return null;
    if (previousPageData && !previousPageData.hasMore) return null;
    const cursor = pageIndex === 0 ? undefined : previousPageData?.nextCursor ?? undefined;
    const queryString = buildQuery(normalizedFilters, cursor);
    return ['/api/transactions', user.uid, queryString];
  };

  const { data, error, size, setSize, mutate } = useSWRInfinite<TransactionPage>(getKey, fetcher);

  useEffect(() => {
    if (!user) return;
    return subscribeToTransactions(() => mutate());
  }, [mutate, user]);

  useEffect(() => {
    if (!user) return;
    setSize(1);
    mutate();
  }, [filtersKey, mutate, setSize, user]);

  const flatTransactions = useMemo(
    () => (data ? data.flatMap((page) => page.items) : []),
    [data],
  );

  const hasMore = data ? data[data.length - 1]?.hasMore ?? false : false;
  const isLoadingInitial = !data && !error;
  const isLoadingMore =
    isLoadingInitial || (size > 0 && data ? typeof data[size - 1] === 'undefined' : false);

  return useMemo(
    () => ({
      transactions: flatTransactions,
      isLoading: isLoadingInitial,
      isLoadingMore,
      hasMore,
      error,
      loadMore: () => {
        if (!hasMore) return Promise.resolve();
        return setSize(size + 1);
      },
      refresh: () => mutate(),
    }),
    [flatTransactions, error, hasMore, isLoadingInitial, isLoadingMore, mutate, setSize, size],
  );
}
