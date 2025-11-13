import { useMemo, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import type { Budget } from '@/lib/types';
import { useUser } from '@/lib/auth-context';

type FetchKey = [string, string];

const fetcher = async ([url, uid]: FetchKey): Promise<Budget[]> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-uid': uid,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Failed to load budgets');
  }

  return response.json();
};

type SavePayload = {
  categoryId: string;
  amount: number;
  currency: Budget['currency'];
};

export function useBudgets() {
  const { user } = useUser();
  const uid = user?.uid;
  const key = useMemo(() => (uid ? (['/api/budgets', uid] as FetchKey) : null), [uid]);

  const { data, error, isLoading } = useSWR(key, fetcher);

  const saveBudget = useCallback(
    async (payload: SavePayload) => {
      if (!uid) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uid': uid,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.json().catch(() => ({}));
        throw new Error(message?.message ?? 'Failed to save budget');
      }

      const saved = await response.json();
      if (key) mutate(key);
      return saved as Budget;
    },
    [key, uid],
  );

  return useMemo(
    () => ({
      budgets: data ?? [],
      isLoading,
      error,
      saveBudget,
      refresh: () => {
        if (key) mutate(key);
      },
    }),
    [data, error, isLoading, key, saveBudget],
  );
}
