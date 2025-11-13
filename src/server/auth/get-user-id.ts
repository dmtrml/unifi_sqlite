import { headers } from 'next/headers';
import { ensureDevUser } from '@/server/auth/dev-user';

export async function getUserIdOrThrow(): Promise<string> {
  if (process.env.NODE_ENV !== 'production') {
    return ensureDevUser();
  }

  const hdr = await headers();
  const uid = hdr.get('x-uid');
  if (!uid) {
    throw new Error('Unauthorized');
  }
  return uid;
}
