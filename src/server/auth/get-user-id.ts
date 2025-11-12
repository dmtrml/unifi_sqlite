import { headers } from 'next/headers';

export async function getUserIdOrThrow(): Promise<string> {
  const hdr = await headers();
  const uid = hdr.get('x-uid');
  if (!uid) {
    throw new Error('Unauthorized');
  }
  return uid;
}
