/// <reference types="node" />
/**
 * Projects API (P0-1, P0-3 of the Project plan; contract in
 * `src/lib/projects.ts`). Order: session → membership → write (D-056), same as
 * files. Members endpoints are deliberately absent — the P4-1 participation
 * surface lands with the Coworker minimum entity; only the table exists today.
 *
 * H1 is enforced by construction: a connection row carries locator + health,
 * the project row carries neither. A broken locator marks the connection
 * "broken" and the project card keeps living.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import {
  PROJECTS_PATH,
  cleanLocator,
  cleanName,
  cleanText,
  isConnectionKind,
  isProjectState,
  projectFailure,
  statusForProject,
  PROJECT_SUMMARY_MAX,
  type ConnectionDeleteBody,
  type ConnectionHealth,
  type ConnectionKind,
  type ConnectionListBody,
  type ConnectionBody,
  type ProjectBody,
  type ProjectConnectionDto,
  type ProjectDeleteBody,
  type ProjectDto,
  type ProjectErrorKind,
  type ProjectListBody,
  type ProjectResultBody,
  type ProjectState,
} from '../../src/lib/projects.ts';
import {
  sessionFailure,
  statusForSession,
  type SessionErrorKind,
  type SessionUser,
} from '../../src/lib/session.ts';
import { isSafeSegment } from '../../src/lib/files.ts';
import { createConnectorProbe, type LocatorProbe } from '../connectors.ts';
import { sendJson } from '../http.ts';
import {
  projectConnections,
  projects as table,
} from '../persistence/schema.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import type { SessionSource } from '../session/source.ts';

export type ProjectsRouter = (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
) => void;

type Row = typeof table.$inferSelect;
type ConnectionRow = typeof projectConnections.$inferSelect;

function result(res: ServerResponse, status: number, body: ProjectResultBody): void {
  sendJson(res, status, body);
}

function fail(res: ServerResponse, kind: ProjectErrorKind, message: string): void {
  result(res, statusForProject(kind), projectFailure(kind, message));
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

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    if ('code' in current && current.code === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

function toDto(row: Row): ProjectDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    summary: row.summary,
    state: row.state as ProjectState,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toConnectionDto(row: ConnectionRow): ProjectConnectionDto {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as ConnectionKind,
    locator: row.locator,
    label: row.label,
    health: row.health as ConnectionHealth,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeHandlers(database: ConversationDatabase, probe: LocatorProbe) {
  const readProject = async (
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<Row | undefined> => {
    const [row] = await database.select().from(table).where(eq(table.id, id));
    if (!row || row.state === 'deleted') {
      fail(res, 'not_found', `No project with id "${id}".`);
      return undefined;
    }
    if (!isMember(session, row.workspaceId)) {
      forbidden(res);
      return undefined;
    }
    return row;
  };

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
      .where(and(inArray(table.workspaceId, allowed), ne(table.state, 'deleted')))
      .orderBy(asc(table.createdAt));
    result(res, 200, { ok: true, items: rows.map(toDto) } satisfies ProjectListBody);
  };

  const create = async (
    req: IncomingMessage,
    res: ServerResponse,
    session: SessionUser,
  ): Promise<void> => {
    const body = await readJson(req);
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
    const name = cleanName(body.name);
    const summary = cleanText(body.summary ?? '', PROJECT_SUMMARY_MAX);
    if (!isSafeSegment(workspaceId) || name === null || summary === null) {
      fail(res, 'contract', 'Expected workspaceId, name and a summary under 2000 characters.');
      return;
    }
    if (!isMember(session, workspaceId)) {
      forbidden(res);
      return;
    }
    const id = randomUUID();
    try {
      const [row] = await database
        .insert(table)
        .values({ id, workspaceId, name, summary, state: 'active' })
        .returning();
      if (!row) {
        fail(res, 'upstream', 'The project was not created.');
        return;
      }
      result(res, 201, { ok: true, item: toDto(row) } satisfies ProjectBody);
    } catch {
      fail(res, 'upstream', 'The project could not be saved.');
    }
  };

  const read = async (
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, id, session);
    if (row) result(res, 200, { ok: true, item: toDto(row) } satisfies ProjectBody);
  };

  const patch = async (
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, id, session);
    if (!row) return;
    const body = await readJson(req);
    const updates: { name?: string; summary?: string; state?: string } = {};
    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (name === null) {
        fail(res, 'contract', 'The name must be 1-255 characters.');
        return;
      }
      updates.name = name;
    }
    if (body.summary !== undefined) {
      const summary = cleanText(body.summary, PROJECT_SUMMARY_MAX);
      if (summary === null) {
        fail(res, 'contract', 'The summary must stay under 2000 characters.');
        return;
      }
      updates.summary = summary;
    }
    if (body.state !== undefined) {
      if (!isProjectState(body.state) || body.state === 'deleted') {
        fail(res, 'contract', 'State must be "active" or "archived"; delete is DELETE.');
        return;
      }
      updates.state = body.state;
    }
    if (Object.keys(updates).length === 0) {
      fail(res, 'contract', 'Nothing to update.');
      return;
    }
    const [updated] = await database
      .update(table)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(table.id, id))
      .returning();
    if (!updated) {
      fail(res, 'upstream', 'The project was not updated.');
      return;
    }
    result(res, 200, { ok: true, item: toDto(updated) } satisfies ProjectBody);
  };

  const remove = async (
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, id, session);
    if (!row) return;
    /* Soft delete (deleted state). Connections and members stay reachable for
       restore semantics; the design doc (6.3) keeps history and attribution. */
    const [updated] = await database
      .update(table)
      .set({ state: 'deleted', updatedAt: new Date() })
      .where(eq(table.id, id))
      .returning();
    result(res, 200, { ok: true, id: updated?.id ?? id } satisfies ProjectDeleteBody);
  };

  const listConnections = async (
    res: ServerResponse,
    projectId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const rows = await database
      .select()
      .from(projectConnections)
      .where(eq(projectConnections.projectId, projectId))
      .orderBy(asc(projectConnections.createdAt));
    result(res, 200, { ok: true, items: rows.map(toConnectionDto) } satisfies ConnectionListBody);
  };

  const writeConnection = async (
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const body = await readJson(req);
    const kind = body.kind;
    const locator = cleanLocator(body.locator);
    const label = cleanText(body.label ?? '', 255) ?? '';
    if (!isConnectionKind(kind) || locator === null || label === null) {
      fail(res, 'contract', 'Expected a known kind, a locator and a label under 255 characters.');
      return;
    }
    const health = await probe(kind, locator);
    const id = randomUUID();
    try {
      const [created] = await database
        .insert(projectConnections)
        .values({ id, projectId, kind, locator, label, health })
        .returning();
      if (!created) {
        fail(res, 'upstream', 'The connection was not created.');
        return;
      }
      result(res, 201, { ok: true, item: toConnectionDto(created) } satisfies ConnectionBody);
    } catch (err) {
      if (isUniqueViolation(err)) {
        fail(res, 'conflict', 'This resource is already connected to the project.');
        return;
      }
      fail(res, 'upstream', 'The connection could not be saved.');
    }
  };

  const readConnection = async (
    res: ServerResponse,
    projectId: string,
    connectionId: string,
    session: SessionUser,
  ): Promise<ConnectionRow | undefined> => {
    const row = await readProject(res, projectId, session);
    if (!row) return undefined;
    const [connection] = await database
      .select()
      .from(projectConnections)
      .where(eq(projectConnections.id, connectionId));
    if (!connection || connection.projectId !== projectId) {
      fail(res, 'not_found', `No connection with id "${connectionId}".`);
      return undefined;
    }
    return connection;
  };

  const patchConnection = async (
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    connectionId: string,
    session: SessionUser,
  ): Promise<void> => {
    const connection = await readConnection(res, projectId, connectionId, session);
    if (!connection) return;
    const body = await readJson(req);
    const updates: { locator?: string; label?: string; health?: ConnectionHealth } = {};
    if (body.locator !== undefined) {
      const locator = cleanLocator(body.locator);
      if (locator === null) {
        fail(res, 'contract', 'The locator must be 1-2048 characters.');
        return;
      }
      updates.locator = locator;
      updates.health = await probe(connection.kind as ConnectionKind, locator);
    }
    if (body.label !== undefined) {
      const label = cleanText(body.label, 255);
      if (label === null) {
        fail(res, 'contract', 'The label must stay under 255 characters.');
        return;
      }
      updates.label = label;
    }
    if (Object.keys(updates).length === 0) {
      fail(res, 'contract', 'Nothing to update.');
      return;
    }
    try {
      const [updated] = await database
        .update(projectConnections)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(projectConnections.id, connectionId))
        .returning();
      if (!updated) {
        fail(res, 'upstream', 'The connection was not updated.');
        return;
      }
      result(res, 200, { ok: true, item: toConnectionDto(updated) } satisfies ConnectionBody);
    } catch (err) {
      if (isUniqueViolation(err)) {
        fail(res, 'conflict', 'This resource is already connected to the project.');
        return;
      }
      fail(res, 'upstream', 'The connection could not be saved.');
    }
  };

  const checkConnection = async (
    res: ServerResponse,
    projectId: string,
    connectionId: string,
    session: SessionUser,
  ): Promise<void> => {
    const connection = await readConnection(res, projectId, connectionId, session);
    if (!connection) return;
    const health = await probe(connection.kind as ConnectionKind, connection.locator);
    const [updated] = await database
      .update(projectConnections)
      .set({ health, updatedAt: new Date() })
      .where(eq(projectConnections.id, connectionId))
      .returning();
    if (!updated) {
      fail(res, 'upstream', 'The connection was not updated.');
      return;
    }
    result(res, 200, { ok: true, item: toConnectionDto(updated) } satisfies ConnectionBody);
  };

  const removeConnection = async (
    res: ServerResponse,
    projectId: string,
    connectionId: string,
    session: SessionUser,
  ): Promise<void> => {
    const connection = await readConnection(res, projectId, connectionId, session);
    if (!connection) return;
    await database
      .delete(projectConnections)
      .where(eq(projectConnections.id, connectionId));
    result(res, 200, { ok: true, id: connectionId } satisfies ConnectionDeleteBody);
  };

  return {
    list,
    create,
    read,
    patch,
    remove,
    listConnections,
    writeConnection,
    patchConnection,
    checkConnection,
    removeConnection,
  };
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function createProjectsRouter(
  db: ConversationDatabase | null,
  source: SessionSource,
  probe: LocatorProbe = createConnectorProbe(),
): ProjectsRouter {
  const handlers = db ? makeHandlers(db, probe) : null;

  return (req, res, path) => {
    const method = (req.method ?? 'GET').toUpperCase();
    const tail = path.slice(PROJECTS_PATH.length).replace(/^\//, '');
    let segments: string[] = [];
    try {
      segments = tail === '' ? [] : tail.split('/').map(decodeURIComponent);
    } catch {
      fail(res, 'contract', 'The project path is not valid URL encoding.');
      return;
    }

    const run = async (): Promise<void> => {
      const session = await source.read(req);
      if (!session) {
        authFail(res, 'unauthorized', 'Sign in to continue.');
        return;
      }
      if (!handlers) {
        fail(res, 'not_configured', 'DATABASE_URL is needed for projects.');
        return;
      }
      if (segments.length === 0) {
        if (method === 'GET') return handlers.list(req, res, session);
        if (method === 'POST') return handlers.create(req, res, session);
      } else if (segments.length === 1) {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The project id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.read(res, id, session);
        if (method === 'PATCH') return handlers.patch(req, res, id, session);
        if (method === 'DELETE') return handlers.remove(res, id, session);
      } else if (segments.length === 2 && segments[1] === 'connections') {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The project id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.listConnections(res, id, session);
        if (method === 'POST') return handlers.writeConnection(req, res, id, session);
      } else if (segments.length === 3 && segments[1] === 'connections') {
        const id = segments[0] ?? '';
        const connectionId = segments[2] ?? '';
        if (!isSafeSegment(id) || !isSafeSegment(connectionId)) {
          fail(res, 'contract', 'The project or connection id is not a valid path segment.');
          return;
        }
        if (method === 'PATCH') return handlers.patchConnection(req, res, id, connectionId, session);
        if (method === 'DELETE') return handlers.removeConnection(res, id, connectionId, session);
      } else if (
        segments.length === 4 &&
        segments[1] === 'connections' &&
        segments[3] === 'check' &&
        method === 'POST'
      ) {
        const id = segments[0] ?? '';
        const connectionId = segments[2] ?? '';
        if (!isSafeSegment(id) || !isSafeSegment(connectionId)) {
          fail(res, 'contract', 'The project or connection id is not a valid path segment.');
          return;
        }
        return handlers.checkConnection(res, id, connectionId, session);
      }
      fail(res, 'contract', `${method} is not allowed on this path.`);
    };

    run().catch(() => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      fail(res, 'upstream', 'The projects endpoint failed while answering.');
    });
  };
}

/* `projectMembers` lands in the schema now (P0-1, one migration boundary) but
   its participation surface is P4-1 and must arrive with the Coworker minimum
   entity (P4-0) — no endpoints on purpose. */
