'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEV_USER_ID, DEV_USER_PROFILE } from '@/lib/dev-user';

type DevUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type AuthContextValue = {
  user: DevUser;
};

const defaultUser: DevUser = {
  uid: DEV_USER_ID,
  email: DEV_USER_PROFILE.email ?? null,
  displayName: DEV_USER_PROFILE.name ?? null,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(() => ({ user: defaultUser }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useUser(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useUser must be used inside DevAuthProvider');
  }
  return ctx;
}
