import useSWR from 'swr';
import { Timestamp } from '@/lib/timestamp';
import type { Account, Budget, Category, Transaction, User } from '@/lib/types';
import { useUser } from '@/lib/auth-context';

type DashboardSnapshot = {
  profile: User;
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
};

type FetchKey = [string, string];

const fetcher = async ([url, uid]: FetchKey): Promise<DashboardSnapshot> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-uid': uid,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Failed to load dashboard snapshot');
  }

  const payload = await response.json();
  return {
    profile: payload.profile,
    accounts: payload.accounts ?? [],
    categories: payload.categories ?? [],
    budgets: payload.budgets ?? [],
    transactions: (payload.transactions ?? []).map((item: any) => ({
      ...item,
      amount: item.amount ?? null,
      amountSent: item.amountSent ?? null,
      amountReceived: item.amountReceived ?? null,
      date: Timestamp.fromMillis(item.date),
    })),
  };
};

export function useDashboardSnapshot() {
  const { user } = useUser();
  const swrKey = user ? (['/api/dashboard', user.uid] as FetchKey) : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return {
    snapshot: data,
    isLoading,
    error,
    refresh: mutate,
  };
}
