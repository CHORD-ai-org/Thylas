/** Thin client for the Profile Initialization API. No optimistic state: the
    server's state is the only truth the wizard renders (D-006 pattern). */
import { PROFILE_PATH, type ProfileState } from '../../lib/profile';

export type ProfileReply =
  | { ok: true; state: ProfileState }
  | { ok: false; error: { kind: string; message: string; retryable: boolean } | { message: string } };

export async function profileRequest(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  payload?: unknown,
): Promise<ProfileReply> {
  try {
    const response = await fetch(`${PROFILE_PATH}${path}`, {
      method,
      credentials: 'same-origin',
      headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const err = (body as { error?: { kind: string; message: string; retryable: boolean }; message?: string }) ?? {};
      return {
        ok: false,
        error: err.error ?? { message: err.message ?? `The profile service answered ${response.status}.` },
      };
    }
    return body as ProfileReply;
  } catch {
    return { ok: false, error: { message: 'The profile service could not be reached.' } };
  }
}
