export const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? 'dev-user';

export const DEV_USER_PROFILE = {
  id: DEV_USER_ID,
  email: 'dev@example.com',
  name: 'Developer',
  theme: 'light' as const,
  mainCurrency: 'USD',
};
