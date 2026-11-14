/**
 * Client side of the User contract (Phase 2 A1). Fire-and-forget from the
 * store's point of view: nothing throws, failures come back as a typed value so
 * the local envelope can stay as the fallback.
 */
import { USER_PATH, userFailure, type UserPatch, type UserResultBody } from '../../lib/user';

export type UserClient = {
  get: () => Promise<UserResultBody>;
  patch: (patch: UserPatch) => Promise<UserResultBody>;
};

export function createUserClient(fetcher: typeof fetch = fetch): UserClient {
  async function request(init?: RequestInit): Promise<UserResultBody> {
    try {
      const res = await fetcher(USER_PATH, { ...init, credentials: 'include' });
      return (await res.json()) as UserResultBody;
    } catch {
      return userFailure('upstream', 'The user API could not be reached.');
    }
  }

  return {
    get: () => request(),
    patch: (patch) =>
      request({
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
  };
}
