/// <reference types="node" />
/**
 * Chat state API (P1-7). Two endpoints over the existing `conversations` and
 * `messages` tables — no new table. `activeId` / `dock` stay client-local.
 *
 * Order: session → membership → read/write (D-056). PUT is optimistic:
 * `expectedVersion` must match, otherwise 409 and the client re-fetches.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import {
  chatFailure,
  isBlock,
  isContextSource,
  isPutChatStateBody,
  statusForChat,
  type Block,
  type ChatErrorKind,
  type ChatResultBody,
  type ChatStateDto,
  type Conversation,
  type Message,
} from '../../src/lib/chat.ts';
import {
  sessionFailure,
  statusForSession,
  type SessionErrorKind,
  type SessionUser,
} from '../../src/lib/session.ts';
import { readJsonBody, sendJson } from '../http.ts';
import { conversations as convTable, messages as msgTable } from '../persistence/schema.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import type { SessionSource } from '../session/source.ts';

export type ChatRouter = (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
) => void;

function result(res: ServerResponse, status: number, body: ChatResultBody): void {
  sendJson(res, status, body);
}

function fail(res: ServerResponse, kind: ChatErrorKind, message: string): void {
  result(res, statusForChat(kind), chatFailure(kind, message));
}

function authFail(res: ServerResponse, kind: SessionErrorKind, message: string): void {
  sendJson(res, statusForSession(kind), sessionFailure(kind, message));
}

/** P1-3 rows may still carry the old `{type}` block shape; map on read. */
function normalizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value): Block[] => {
    if (isBlock(value)) return [value];
    if (typeof value === 'object' && value !== null && 'type' in value) {
      const old = value as { type: unknown; text?: unknown };
      if (old.type === 'text' && typeof old.text === 'string') {
        return [{ kind: 'text', text: old.text }];
      }
    }
    return [];
  });
}

async function load(
  database: ConversationDatabase,
  session: SessionUser,
): Promise<ChatStateDto> {
  const convRows = await database
    .select()
    .from(convTable)
    .where(inArray(convTable.workspaceId, session.workspaceIds))
    .orderBy(asc(convTable.createdAt));
  const ids = convRows.map((c) => c.id);
  const msgRows = ids.length
    ? await database
        .select()
        .from(msgTable)
        .where(inArray(msgTable.conversationId, ids))
        .orderBy(asc(msgTable.position))
    : [];

  const byConversation = new Map<string, Message[]>();
  for (const row of msgRows) {
    const message: Message = {
      id: row.id,
      role: row.role === 'assistant' ? 'assistant' : 'user',
      at: row.atMs ?? row.createdAt.getTime(),
      blocks: normalizeBlocks(row.blocks),
      ...(row.meta ? { meta: row.meta } : {}),
      ...(row.error ? { error: row.error } : {}),
    };
    const list = byConversation.get(row.conversationId) ?? [];
    list.push(message);
    byConversation.set(row.conversationId, list);
  }

  const conversations: Conversation[] = convRows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.getTime(),
    messages: byConversation.get(row.id) ?? [],
    context: Array.isArray(row.context) ? row.context.filter(isContextSource) : [],
  }));
  const version = convRows.reduce((max, row) => Math.max(max, row.syncVersion), 0);
  return {
    ok: true,
    workspaceId: session.workspaceIds[0] ?? '',
    version,
    conversations,
  };
}

export function createChatRouter(
  db: ConversationDatabase | null,
  source: SessionSource,
): ChatRouter {
  return (req, res, _path) => {
    const method = (req.method ?? 'GET').toUpperCase();

    const run = async (): Promise<void> => {
      const session = await source.read(req);
      if (!session) {
        authFail(res, 'unauthorized', 'Sign in to continue.');
        return;
      }
      if (!db) {
        fail(res, 'not_configured', 'DATABASE_URL is needed for the chat state API.');
        return;
      }
      if (session.workspaceIds.length === 0) {
        authFail(res, 'forbidden', 'No workspace membership.');
        return;
      }

      if (method === 'GET') {
        result(res, 200, await load(db, session));
        return;
      }
      if (method === 'PUT') {
        const body = await readJsonBody(req);
        if (!body.ok) {
          fail(
            res,
            body.reason === 'too_large' ? 'contract' : 'upstream',
            body.reason === 'too_large'
              ? 'The chat state body is over 8 MB.'
              : 'The request body is not valid JSON.',
          );
          return;
        }
        if (!isPutChatStateBody(body.value)) {
          fail(res, 'contract', 'Expected { expectedVersion, conversations }.');
          return;
        }
        const workspaceId = session.workspaceIds[0] ?? '';
        const current = await load(db, session);
        if (body.value.expectedVersion !== current.version) {
          fail(res, 'conflict', 'The chat state changed elsewhere; fetch it again.');
          return;
        }
        const nextVersion = current.version + 1;
        const conversations = body.value.conversations;

        try {
          await db.transaction(async (tx) => {
            await tx.execute(
              sql`delete from messages where conversation_id in (select id from conversations where workspace_id = ${workspaceId})`,
            );
            await tx.delete(convTable).where(eq(convTable.workspaceId, workspaceId));
            if (conversations.length > 0) {
              await tx.insert(convTable).values(
                conversations.map((c) => ({
                  id: c.id,
                  workspaceId,
                  title: c.title,
                  context: c.context,
                  syncVersion: nextVersion,
                  createdAt: new Date(c.createdAt),
                })),
              );
              const rows = conversations.flatMap((c) =>
                c.messages.map((m, position) => ({
                  id: m.id,
                  conversationId: c.id,
                  position,
                  role: m.role,
                  blocks: m.blocks,
                  atMs: m.at,
                  meta: m.meta ?? null,
                  error: m.error ?? null,
                })),
              );
              if (rows.length > 0) await tx.insert(msgTable).values(rows);
            }
          });
        } catch {
          fail(res, 'upstream', 'The chat state could not be saved.');
          return;
        }
        result(res, 200, { ok: true, version: nextVersion });
        return;
      }
      fail(res, 'contract', `${method} is not allowed on this path.`);
    };

    run().catch(() => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      fail(res, 'upstream', 'The chat state endpoint failed while answering.');
    });
  };
}
