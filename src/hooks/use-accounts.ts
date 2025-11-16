import useSWR, { mutate } from 'swr';
import { useMemo } from 'react';
import type { Account } from '@/lib/types';
import { useUser } from '@/lib/auth-context';

type FetcherKey = [string, string];

const fetcher = async ([url, uid]: FetcherKey): Promise<Account[]> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-uid': uid,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message ?? 'Failed to load accounts');
  }

  return response.json();
};

export function useAccounts() {
  const { user } = useUser();
  const uid = user?.uid;

  const key = useMemo(() => (uid ? (['/api/accounts', uid] as FetcherKey) : null), [uid]);
  const { data, error, isLoading } = useSWR(key, fetcher);

  const sortedAccounts = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.balance - a.balance);
  }, [data]);

  return useMemo(
    () => ({
      accounts: sortedAccounts,
      isLoading,
      error,
      refresh: () => {
        if (key) mutate(key);
      },
    }),
    [sortedAccounts, error, isLoading, key],
  );
}
