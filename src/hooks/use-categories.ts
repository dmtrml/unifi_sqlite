import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import type { Category } from '@/lib/types';
import { useUser } from '@/lib/auth-context';

type FetchKey = [string, string];

const fetcher = async ([url, uid]: FetchKey): Promise<Category[]> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-uid': uid,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Failed to load categories');
  }

  return response.json();
};

export function useCategories() {
  const { user } = useUser();
  const key = useMemo(() => (user ? (['/api/categories', user.uid] as FetchKey) : null), [user]);

  const { data, error, isLoading } = useSWR(key, fetcher);

  return useMemo(
    () => ({
      categories: data ?? [],
      isLoading,
      error,
      refresh: () => {
        if (key) mutate(key);
      },
    }),
    [data, error, isLoading, key],
  );
}
