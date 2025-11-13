import { UsersRepository } from '@/server/db/repositories/users-repo';
import { DEV_USER_ID, DEV_USER_PROFILE } from '@/lib/dev-user';

let hasEnsuredDevUser = false;

/**
 * Creates the stub user record if it does not yet exist and returns the id.
 */
export async function ensureDevUser(): Promise<string> {
  if (!hasEnsuredDevUser) {
    await UsersRepository.upsert(DEV_USER_ID, {
      email: DEV_USER_PROFILE.email,
      name: DEV_USER_PROFILE.name,
      theme: DEV_USER_PROFILE.theme,
      mainCurrency: DEV_USER_PROFILE.mainCurrency,
    });
    hasEnsuredDevUser = true;
  }
  return DEV_USER_ID;
}
