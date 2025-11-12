import { useMemo, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { Timestamp } from 'firebase/firestore';
import type { Transaction } from '@/lib/types';
import { useUser } from '@/firebase';
import { subscribeToTransactions } from '@/lib/transactions-events';

export type UseTransactionsFilters = {
  accountId?: string;
  categoryId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
};

type FetchKey = [string, string, string];

const buildQuery = (filters?: UseTransactionsFilters) => {
  const params = new URLSearchParams();
  const limit = filters?.limit ?? 500;
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
  return params.toString();
};

const fetcher = async ([, uid, queryString]: FetchKey): Promise<Transaction[]> => {
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
  return (payload.items ?? []).map((item: any) => ({
    ...item,
    amount: item.amount ?? null,
    amountSent: item.amountSent ?? null,
    amountReceived: item.amountReceived ?? null,
    date: Timestamp.fromMillis(item.date),
  }));
};

export function useTransactions(filters?: UseTransactionsFilters) {
  const { user } = useUser();
  const queryString = buildQuery(filters);
  const key = user ? (['/api/transactions', user.uid, queryString] as FetchKey) : null;

  const { data, error, isLoading } = useSWR(key, fetcher);

  useEffect(() => {
    if (!key) return;
    return subscribeToTransactions(() => mutate(key));
  }, [key]);

  return useMemo(
    () => ({
      transactions: data ?? [],
      isLoading,
      error,
      refresh: () => {
        if (key) mutate(key);
      },
    }),
    [data, error, isLoading, key],
  );
}
