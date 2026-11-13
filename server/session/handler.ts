/// <reference types="node" />
/**
 * `GET /api/session` — the one place the UI can read membership flags (B1).
 * One endpoint, so this stays a named module rather than `routes/session.ts`:
 * `OVERVIEW.md:33` creates a routes module with the second endpoint.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  sessionFailure,
  statusForSession,
  type SessionBody,
} from '../../src/lib/session.ts';
import { sendJson } from '../http.ts';
import type { SessionSource } from './source.ts';

export function createSessionHandler(source: SessionSource) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
      res.setHeader('allow', 'GET');
      res.statusCode = 405;
      res.end();
      return;
    }

    source
      .read(req)
      .then((user) => {
        if (!user) {
          sendJson(
            res,
            statusForSession('unauthorized'),
            sessionFailure('unauthorized', 'Sign in to continue.'),
          );
          return;
        }
        const body: SessionBody = { ok: true, user };
        sendJson(res, 200, body);
      })
      .catch(() => {
        if (res.headersSent) return;
        sendJson(
          res,
          statusForSession('not_configured'),
          sessionFailure('not_configured', 'The session could not be verified.'),
        );
      });
  };
}
