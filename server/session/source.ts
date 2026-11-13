/// <reference types="node" />
/**
 * The single replaceable session source (P1-5). CHORD IdP is not reachable yet,
 * so an explicit dev stand-in reads a local cookie. When the IdP lands, only
 * `createSessionSource()` changes — no route is rewritten.
 *
 * `pending-idp` fails closed: a configured issuer with no verifier answers 401
 * to every protected request. It never silently falls back to the dev cookie.
 */
import type { IncomingMessage } from 'node:http';
import { SESSION_COOKIE, type SessionUser } from '../../src/lib/session.ts';
import type { ServerConfig } from '../config.ts';

export type SessionSource = {
  mode: 'dev' | 'pending-idp';
  read: (req: IncomingMessage) => Promise<SessionUser | null>;
};

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(rest.join('='));
    } catch {
      return null;
    }
  }
  return null;
}

/** Dev-only cookie format: `dev:<userId>:<workspaceId,workspaceId>`. */
export function parseDevSession(req: IncomingMessage): SessionUser | null {
  const raw = cookieValue(req.headers.cookie, SESSION_COOKIE);
  if (!raw || !raw.startsWith('dev:')) return null;
  const [, userId, csv] = raw.split(':');
  if (!userId) return null;
  const workspaceIds = (csv ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  if (workspaceIds.length === 0) return null;
  return { id: userId, workspaceIds };
}

export function createSessionSource(config: ServerConfig): SessionSource {
  if (config.chordIssuer !== '') {
    return { mode: 'pending-idp', read: async () => null };
  }
  return { mode: 'dev', read: async (req) => parseDevSession(req) };
}
