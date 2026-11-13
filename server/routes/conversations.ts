/// <reference types="node" />
/**
 * CRUD for conversations — the first server-owned domain (P1-4, P1-5).
 * One module per API surface (`OVERVIEW.md:33`); the wire contract comes from
 * `src/lib/conversations.ts` and is never redefined here.
 *
 * Order is deliberate: session first (401), then membership (403), then the
 * write. B1 — authorisation is checked at execution, never by hiding a button
 * or by returning an empty list.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq, inArray } from 'drizzle-orm';
import {
  CONVERSATIONS_PATH,
  conversationFailure,
  isCreateConversationBody,
  isPatchConversationBody,
  statusForConversation,
  type ConversationDto,
  type ConversationErrorKind,
  type ConversationResultBody,
} from '../../src/lib/conversations.ts';
import {
  sessionFailure,
  statusForSession,
  type SessionErrorKind,
  type SessionUser,
} from '../../src/lib/session.ts';
import { readBody, sendJson } from '../http.ts';
import { conversations as table } from '../persistence/schema.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import type { SessionSource } from '../session/source.ts';

export type ConversationRouter = (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
) => void;

type Row = typeof table.$inferSelect;

function result(res: ServerResponse, status: number, body: ConversationResultBody): void {
  sendJson(res, status, body);
}

function fail(res: ServerResponse, kind: ConversationErrorKind, message: string): void {
  result(res, statusForConversation(kind), conversationFailure(kind, message));
}

function authFail(res: ServerResponse, kind: SessionErrorKind, message: string): void {
  sendJson(res, statusForSession(kind), sessionFailure(kind, message));
}

function forbidden(res: ServerResponse): void {
  authFail(res, 'forbidden', 'This workspace is not in your memberships.');
}

function isMember(session: SessionUser, workspaceId: string): boolean {
  return session.workspaceIds.includes(workspaceId);
}

function toDto(row: Row): ConversationDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

/** `undefined` means a failure response has already been written. */
async function parseBody(req: IncomingMessage, res: ServerResponse): Promise<unknown | undefined> {
  const raw = await readBody(req);
  if (raw === null) {
    fail(res, 'contract', 'The request body is over 64 KB.');
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    fail(res, 'contract', 'The request body is not JSON.');
    return undefined;
  }
}

function makeHandlers(database: ConversationDatabase) {
  const list = async (
    req: IncomingMessage,
    res: ServerResponse,
    session: SessionUser,
  ): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const workspaceId = url.searchParams.get('workspaceId');
    if (workspaceId !== null && !isMember(session, workspaceId)) {
      forbidden(res);
      return;
    }
    const allowed = workspaceId === null ? session.workspaceIds : [workspaceId];
    const rows = await database
      .select()
      .from(table)
      .where(inArray(table.workspaceId, allowed))
      .orderBy(asc(table.createdAt));
    result(res, 200, { ok: true, items: rows.map(toDto) });
  };

  const create = async (
    req: IncomingMessage,
    res: ServerResponse,
    session: SessionUser,
  ): Promise<void> => {
    const parsed = await parseBody(req, res);
    if (parsed === undefined) return;
    if (!isCreateConversationBody(parsed)) {
      fail(res, 'contract', 'Expected { id, workspaceId, title? } with non-empty ids.');
      return;
    }
    if (!isMember(session, parsed.workspaceId)) {
      forbidden(res);
      return;
    }
    const [row] = await database
      .insert(table)
      .values({ id: parsed.id, workspaceId: parsed.workspaceId, title: parsed.title ?? '' })
      .returning();
    if (!row) {
      fail(res, 'upstream', 'The insert returned no row.');
      return;
    }
    result(res, 201, { ok: true, item: toDto(row) });
  };

  const read = async (
    _req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const [row] = await database.select().from(table).where(eq(table.id, id));
    if (!row) {
      fail(res, 'not_found', `No conversation with id "${id}".`);
      return;
    }
    if (!isMember(session, row.workspaceId)) {
      forbidden(res);
      return;
    }
    result(res, 200, { ok: true, item: toDto(row) });
  };

  const patch = async (
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const parsed = await parseBody(req, res);
    if (parsed === undefined) return;
    if (!isPatchConversationBody(parsed)) {
      fail(res, 'contract', 'Expected { title?: string, archived?: boolean } with at least one field.');
      return;
    }
    const [existing] = await database.select().from(table).where(eq(table.id, id));
    if (!existing) {
      fail(res, 'not_found', `No conversation with id "${id}".`);
      return;
    }
    if (!isMember(session, existing.workspaceId)) {
      forbidden(res);
      return;
    }
    const values: Partial<typeof table.$inferInsert> = { updatedAt: new Date() };
    if (parsed.title !== undefined) values.title = parsed.title;
    if (parsed.archived !== undefined) values.archivedAt = parsed.archived ? new Date() : null;
    const [row] = await database.update(table).set(values).where(eq(table.id, id)).returning();
    if (!row) {
      fail(res, 'not_found', `No conversation with id "${id}".`);
      return;
    }
    result(res, 200, { ok: true, item: toDto(row) });
  };

  const remove = async (
    _req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const [existing] = await database.select().from(table).where(eq(table.id, id));
    if (!existing) {
      fail(res, 'not_found', `No conversation with id "${id}".`);
      return;
    }
    if (!isMember(session, existing.workspaceId)) {
      forbidden(res);
      return;
    }
    await database.delete(table).where(eq(table.id, id));
    result(res, 200, { ok: true, id: existing.id });
  };

  return { list, create, read, patch, remove };
}

export function createConversationRouter(
  db: ConversationDatabase | null,
  source: SessionSource,
): ConversationRouter {
  const handlers = db ? makeHandlers(db) : null;

  return (req, res, path) => {
    const method = (req.method ?? 'GET').toUpperCase();
    let id = path.slice(CONVERSATIONS_PATH.length).replace(/^\//, '');
    try {
      id = decodeURIComponent(id);
    } catch {
      fail(res, 'contract', 'The conversation id is not valid URL encoding.');
      return;
    }

    const run = async (): Promise<void> => {
      const session = await source.read(req);
      if (!session) {
        authFail(res, 'unauthorized', 'Sign in to continue.');
        return;
      }
      if (!handlers) {
        fail(res, 'not_configured', 'No DATABASE_URL on the server. Set it and restart.');
        return;
      }
      if (id === '') {
        if (method === 'GET') {
          await handlers.list(req, res, session);
          return;
        }
        if (method === 'POST') {
          await handlers.create(req, res, session);
          return;
        }
      } else {
        if (method === 'GET') {
          await handlers.read(req, res, id, session);
          return;
        }
        if (method === 'PATCH') {
          await handlers.patch(req, res, id, session);
          return;
        }
        if (method === 'DELETE') {
          await handlers.remove(req, res, id, session);
          return;
        }
      }
      fail(res, 'contract', `${method} is not allowed on this path.`);
    };

    run().catch(() => {
      if (res.headersSent) {
        res.end();
        return;
      }
      fail(res, 'upstream', 'The conversations endpoint failed while answering.');
    });
  };
}
