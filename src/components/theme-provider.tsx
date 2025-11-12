"use client";

import * as React from 'react';
import { useUserProfile } from '@/hooks/use-user-profile';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { profile } = useUserProfile();

  React.useEffect(() => {
    const root = window.document.documentElement;
    if (profile?.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [profile?.theme]);

  return <>{children}</>;
}
