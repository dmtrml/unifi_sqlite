import { useMemo, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { Timestamp } from 'firebase/firestore';
import type { RecurringTransaction } from '@/lib/types';
import { useUser } from '@/firebase';

type FetchKey = [string, string];

type RecurringResponse = Array<
  Omit<RecurringTransaction, 'startDate'> & {
    startDate: number;
    amount: number;
  }
>;

const recurringFetcher = async ([url, uid]: FetchKey): Promise<RecurringResponse> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-uid': uid,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Failed to load recurring transactions');
  }

  return response.json();
};

export const recurringKey = (uid: string): FetchKey => ['/api/recurring', uid];

const toTimestampRecord = (items: RecurringResponse): RecurringTransaction[] =>
  items.map((item) => ({
    ...item,
    startDate: Timestamp.fromMillis(item.startDate),
  }));

export type CreateRecurringPayload = {
  accountId: string;
  categoryId: string;
  description: string;
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  amount: number;
  startDate: number;
};

export type UpdateRecurringPayload = Partial<CreateRecurringPayload>;

const requestJson = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Request failed');
  }
  return response.json();
};

export const recurringApi = {
  create: async (uid: string, payload: CreateRecurringPayload) =>
    requestJson('/api/recurring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uid': uid,
      },
      body: JSON.stringify(payload),
    }),
  update: async (uid: string, id: string, payload: UpdateRecurringPayload) =>
    requestJson(`/api/recurring/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-uid': uid,
      },
      body: JSON.stringify(payload),
    }),
  remove: async (uid: string, id: string) =>
    requestJson(`/api/recurring/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-uid': uid,
      },
    }),
};

export function useRecurringTransactions() {
  const { user } = useUser();
  const uid = user?.uid;
  const key = uid ? recurringKey(uid) : null;

  const { data, error, isLoading } = useSWR<RecurringResponse>(key, recurringFetcher);

  const createRecurring = useCallback(
    async (payload: CreateRecurringPayload) => {
      if (!uid) throw new Error('User not authenticated');
      const result = await recurringApi.create(uid, payload);
      if (key) mutate(key);
      return result;
    },
    [key, uid],
  );

  const updateRecurring = useCallback(
    async (id: string, payload: UpdateRecurringPayload) => {
      if (!uid) throw new Error('User not authenticated');
      const result = await recurringApi.update(uid, id, payload);
      if (key) mutate(key);
      return result;
    },
    [key, uid],
  );

  const deleteRecurring = useCallback(
    async (id: string) => {
      if (!uid) throw new Error('User not authenticated');
      await recurringApi.remove(uid, id);
      if (key) mutate(key);
    },
    [key, uid],
  );

  return useMemo(
    () => ({
      recurringTransactions: data ? toTimestampRecord(data) : [],
      isLoading,
      error,
      createRecurring,
      updateRecurring,
      deleteRecurring,
      refresh: () => {
        if (key) mutate(key);
      },
    }),
    [createRecurring, data, deleteRecurring, error, isLoading, key, updateRecurring],
  );
}
