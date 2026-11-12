/// <reference types="node" />
/**
 * CRUD for conversations — the first server-owned domain (P1-4, chat first).
 * One module per API surface (`OVERVIEW.md:33`); the wire contract comes from
 * `src/lib/conversations.ts` and is never redefined here.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq } from 'drizzle-orm';
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
import { readBody, sendJson } from '../http.ts';
import { conversations as table } from '../persistence/schema.ts';
import type { ConversationDatabase } from '../persistence/client.ts';

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

export function createConversationRouter(db: ConversationDatabase | null): ConversationRouter {
  if (!db) {
    return (_req, res) =>
      fail(res, 'not_configured', 'No DATABASE_URL on the server. Set it and restart.');
  }
  const database: ConversationDatabase = db;

  const list = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const workspaceId = url.searchParams.get('workspaceId');
    const rows = workspaceId
      ? await database
          .select()
          .from(table)
          .where(eq(table.workspaceId, workspaceId))
          .orderBy(asc(table.createdAt))
      : await database.select().from(table).orderBy(asc(table.createdAt));
    result(res, 200, { ok: true, items: rows.map(toDto) });
  };

  const create = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const parsed = await parseBody(req, res);
    if (parsed === undefined) return;
    if (!isCreateConversationBody(parsed)) {
      fail(res, 'contract', 'Expected { id, workspaceId, title? } with non-empty ids.');
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

  const read = async (_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> => {
    const [row] = await database.select().from(table).where(eq(table.id, id));
    if (!row) {
      fail(res, 'not_found', `No conversation with id "${id}".`);
      return;
    }
    result(res, 200, { ok: true, item: toDto(row) });
  };

  const patch = async (req: IncomingMessage, res: ServerResponse, id: string): Promise<void> => {
    const parsed = await parseBody(req, res);
    if (parsed === undefined) return;
    if (!isPatchConversationBody(parsed)) {
      fail(res, 'contract', 'Expected { title?: string, archived?: boolean } with at least one field.');
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

  const remove = async (_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> => {
    const [row] = await database
      .delete(table)
      .where(eq(table.id, id))
      .returning({ id: table.id });
    if (!row) {
      fail(res, 'not_found', `No conversation with id "${id}".`);
      return;
    }
    result(res, 200, { ok: true, id: row.id });
  };

  return (req, res, path) => {
    const method = (req.method ?? 'GET').toUpperCase();
    let id = path.slice(CONVERSATIONS_PATH.length).replace(/^\//, '');
    try {
      id = decodeURIComponent(id);
    } catch {
      fail(res, 'contract', 'The conversation id is not valid URL encoding.');
      return;
    }

    const run = (): Promise<void> => {
      if (id === '') {
        if (method === 'GET') return list(req, res);
        if (method === 'POST') return create(req, res);
      } else {
        if (method === 'GET') return read(req, res, id);
        if (method === 'PATCH') return patch(req, res, id);
        if (method === 'DELETE') return remove(req, res, id);
      }
      fail(res, 'contract', `${method} is not allowed on this path.`);
      return Promise.resolve();
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
