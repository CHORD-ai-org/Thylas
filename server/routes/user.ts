/// <reference types="node" />
/**
 * `GET|PATCH /api/user` (Phase 2 A1, D-059). Session first (401), then shape
 * validation, then write. The user id comes only from the session source —
 * the client never supplies it, so one user cannot address another's file (B1).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  USER_PATH,
  isUserPatch,
  normalizeDisplayName,
  userFailure,
  type UserResultBody,
} from '../../src/lib/user.ts';
import type { ServerConfig } from '../config.ts';
import { readJsonBody, sendJson } from '../http.ts';
import type { SessionSource } from '../session/source.ts';
import { createUserStore, type UserStore } from '../user/store.ts';

export type UserRouter = (req: IncomingMessage, res: ServerResponse, path: string) => void;

export type UserDeps = {
  store: UserStore;
  sessionSource: SessionSource;
};

const ok = (res: ServerResponse, displayName: string | null): void =>
  sendJson<UserResultBody>(res, 200, { ok: true, user: { displayName } });

export function createUserRouter({ store, sessionSource }: UserDeps): UserRouter {
  return (req, res, path) => {
    void (async () => {
      const session = await sessionSource.read(req);
      if (!session) {
        sendJson(res, 401, userFailure('unauthorized', 'Sign in to continue.'));
        return;
      }
      if (path !== USER_PATH) {
        sendJson(res, 404, userFailure('contract', 'Unknown user path.'));
        return;
      }
      if (req.method === 'GET') {
        ok(res, store.load(session.id).displayName);
        return;
      }
      if (req.method === 'PATCH') {
        const body = await readJsonBody(req, 8 * 1024);
        if (!body.ok) {
          const tooLarge = body.reason === 'too_large';
          sendJson(
            res,
            tooLarge ? 413 : 400,
            userFailure('contract', tooLarge ? 'The request is too large.' : 'The request needs a JSON body.'),
          );
          return;
        }
        if (!isUserPatch(body.value)) {
          sendJson(res, 400, userFailure('contract', 'Send {"displayName": string | null}.'));
          return;
        }
        const displayName = normalizeDisplayName(body.value.displayName);
        store.save(session.id, { displayName });
        ok(res, displayName);
        return;
      }
      sendJson(res, 404, userFailure('contract', 'Unknown user method.'));
    })().catch(() => {
      if (!res.headersSent) {
        sendJson(res, 503, userFailure('upstream', 'The user service failed.'));
      }
    });
  };
}

/** Wires the per-user file store into the shared router. */
export function createDefaultUserRouter(
  config: ServerConfig,
  sessionSource: SessionSource,
): UserRouter {
  return createUserRouter({
    store: createUserStore(config.storageDir === '' ? '.workbuddy/user' : `${config.storageDir}/user`),
    sessionSource,
  });
}
