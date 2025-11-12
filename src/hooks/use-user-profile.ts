import { useMemo, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import type { User } from '@/lib/types';
import { useUser } from '@/firebase';

type FetchKey = [string, string];

type Profile = Pick<User, 'id' | 'email' | 'name' | 'theme' | 'mainCurrency' | 'mercadoPagoConnected'>;

const fetcher = async ([url, uid]: FetchKey): Promise<Profile> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-uid': uid,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? 'Failed to load profile');
  }

  return response.json();
};

export type ProfileUpdates = Partial<Pick<User, 'theme' | 'mainCurrency' | 'name' | 'email'>>;

export function useUserProfile() {
  const { user } = useUser();
  const uid = user?.uid;
  const key = uid ? (['/api/profile', uid] as FetchKey) : null;
  const { data, error, isLoading } = useSWR(key, fetcher);

  const saveProfile = useCallback(
    async (updates: ProfileUpdates) => {
      if (!uid) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-uid': uid,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Failed to update profile');
      }

      const result = (await response.json()) as Profile;
      if (key) mutate(key);
      return result;
    },
    [key, uid],
  );

  return useMemo(
    () => ({
      profile: data ?? null,
      isLoading,
      error,
      saveProfile,
      refresh: () => {
        if (key) mutate(key);
      },
    }),
    [data, error, isLoading, key, saveProfile],
  );
}
