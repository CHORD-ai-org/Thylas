/// <reference types="node" />
/**
 * Coworkers API (C0-1/C0-3 of the Coworker plan; contract in
 * `src/lib/coworkers.ts`). Order: session → ownership → write (D-056), the
 * projects route's sibling. `ownerId` is the tenant key (cloud §24); there is
 * no workspace scoping here on purpose — employment (入职) is C1.
 *
 * Events are append-only: no PATCH/DELETE path exists for them by design.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { and, asc, eq, isNull } from 'drizzle-orm';
import {
  COWORKER_DESCRIPTION_MAX,
  COWORKER_EVENT_VERB_MAX,
  cleanCoworkerName,
  coworkerFailure,
  isCoworkerStatusValue,
  isMembershipList,
  isMindFramework,
  isResponsibilitiesShape,
  statusForCoworker,
  type CoworkerBody,
  type CoworkerDeleteBody,
  type CoworkerDto,
  type CoworkerErrorKind,
  type CoworkerEventBody,
  type CoworkerEventDto,
  type CoworkerEventListBody,
  type CoworkerListBody,
  type CoworkerResultBody,
  type CreateCoworkerBody,
  type CreateEventBody,
  type EmploymentBody,
  type EmploymentDeleteBody,
  type EmploymentListBody,
  type PatchCoworkerBody,
  type UpsertEmploymentBody,
} from '../../src/lib/coworkers.ts';
import { isSafeSegment } from '../../src/lib/files.ts';
import {
  sessionFailure,
  statusForSession,
  type SessionErrorKind,
  type SessionUser,
} from '../../src/lib/session.ts';
import { sendJson } from '../http.ts';
import { coworkerEmployments, coworkerEvents, coworkers as table } from '../persistence/schema.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import type { SessionSource } from '../session/source.ts';

export type CoworkersRouter = (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
) => void;

type Row = typeof table.$inferSelect;
type EventRow = typeof coworkerEvents.$inferSelect;

function result(res: ServerResponse, status: number, body: CoworkerResultBody): void {
  sendJson(res, status, body);
}

function fail(res: ServerResponse, kind: CoworkerErrorKind, message: string): void {
  result(res, statusForCoworker(kind), coworkerFailure(kind, message));
}

function authFail(res: ServerResponse, kind: SessionErrorKind, message: string): void {
  sendJson(res, statusForSession(kind), sessionFailure(kind, message));
}

function forbidden(res: ServerResponse): void {
  authFail(res, 'forbidden', 'This Coworker belongs to another owner.');
}

function toDto(row: Row): CoworkerDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    status: row.status as CoworkerDto['status'],
    responsibilities: row.responsibilities,
    memberships: row.memberships,
    pinnedArtifactIds: row.pinnedArtifactIds,
    mindFramework: isMindFramework(row.mind) ? row.mind : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function toEventDto(row: EventRow): CoworkerEventDto {
  return {
    id: row.id,
    coworkerId: row.coworkerId,
    projectId: row.projectId,
    actorKind: row.actorKind,
    verb: row.verb,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
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

function makeHandlers(database: ConversationDatabase) {
  const readOne = async (
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<Row | undefined> => {
    const [row] = await database.select().from(table).where(eq(table.id, id));
    if (!row || row.deletedAt !== null) {
      fail(res, 'not_found', `No coworker with id "${id}".`);
      return undefined;
    }
    if (row.ownerId !== session.id) {
      forbidden(res);
      return undefined;
    }
    return row;
  };

  const list = async (
    res: ServerResponse,
    session: SessionUser,
  ): Promise<void> => {
    const rows = await database
      .select()
      .from(table)
      .where(and(eq(table.ownerId, session.id), isNull(table.deletedAt)))
      .orderBy(asc(table.createdAt));
    result(res, 200, { ok: true, items: rows.map(toDto) } satisfies CoworkerListBody);
  };

  const create = async (
    req: IncomingMessage,
    res: ServerResponse,
    session: SessionUser,
  ): Promise<void> => {
    const body = (await readJson(req)) as CreateCoworkerBody;
    const name = cleanCoworkerName(body.name);
    const description = typeof body.description === 'string' ? body.description : '';
    if (name === null || description.length > COWORKER_DESCRIPTION_MAX) {
      fail(res, 'contract', 'Expected a name (1-60) and a description under 200 characters.');
      return;
    }
    if (body.responsibilities !== undefined && !isResponsibilitiesShape(body.responsibilities)) {
      fail(res, 'contract', 'Responsibilities must be { forWork, notFor, output } strings.');
      return;
    }
    if (body.memberships !== undefined && !isMembershipList(body.memberships)) {
      fail(res, 'contract', 'Memberships must be { wsId, role } entries.');
      return;
    }
    if (body.mindFramework !== undefined && !isMindFramework(body.mindFramework)) {
      fail(res, 'contract', 'The mind framework does not match its schema.');
      return;
    }
    const id = body.id !== undefined && isSafeSegment(body.id) ? body.id : randomUUID();
    try {
      const [row] = await database
        .insert(table)
        .values({
          id,
          ownerId: session.id,
          name,
          description,
          status: 'active',
          responsibilities: body.responsibilities ?? { forWork: '', notFor: '', output: '' },
          memberships: body.memberships ?? [],
          pinnedArtifactIds: [],
          mind: body.mindFramework ?? null,
          createdAt: Date.now(),
        })
        .returning();
      if (!row) {
        fail(res, 'upstream', 'The coworker was not created.');
        return;
      }
      result(res, 201, { ok: true, item: toDto(row) } satisfies CoworkerBody);
    } catch {
      fail(res, 'upstream', 'The coworker could not be saved.');
    }
  };

  const read = async (res: ServerResponse, id: string, session: SessionUser): Promise<void> => {
    const row = await readOne(res, id, session);
    if (row) result(res, 200, { ok: true, item: toDto(row) } satisfies CoworkerBody);
  };

  const patch = async (
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    const body = (await readJson(req)) as PatchCoworkerBody;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = cleanCoworkerName(body.name);
      if (name === null) {
        fail(res, 'contract', 'The name must be 1-60 characters.');
        return;
      }
      updates.name = name;
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.length > COWORKER_DESCRIPTION_MAX) {
        fail(res, 'contract', 'The description must stay under 200 characters.');
        return;
      }
      updates.description = body.description;
    }
    if (body.status !== undefined) {
      if (!isCoworkerStatusValue(body.status)) {
        fail(res, 'contract', 'Status must be active, paused or archived.');
        return;
      }
      updates.status = body.status;
    }
    if (body.responsibilities !== undefined) {
      if (!isResponsibilitiesShape(body.responsibilities)) {
        fail(res, 'contract', 'Responsibilities must be { forWork, notFor, output } strings.');
        return;
      }
      updates.responsibilities = body.responsibilities;
    }
    if (body.memberships !== undefined) {
      if (!isMembershipList(body.memberships)) {
        fail(res, 'contract', 'Memberships must be { wsId, role } entries.');
        return;
      }
      updates.memberships = body.memberships;
    }
    if (body.pinnedArtifactIds !== undefined) {
      if (!Array.isArray(body.pinnedArtifactIds) || !body.pinnedArtifactIds.every((x) => typeof x === 'string')) {
        fail(res, 'contract', 'pinnedArtifactIds must be a list of ids.');
        return;
      }
      updates.pinnedArtifactIds = body.pinnedArtifactIds;
    }
    if (body.mindFramework !== undefined) {
      if (!isMindFramework(body.mindFramework)) {
        fail(res, 'contract', 'The mind framework does not match its schema.');
        return;
      }
      updates.mind = body.mindFramework;
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
      fail(res, 'upstream', 'The coworker was not updated.');
      return;
    }
    result(res, 200, { ok: true, item: toDto(updated) } satisfies CoworkerBody);
  };

  const remove = async (res: ServerResponse, id: string, session: SessionUser): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    await database.update(table).set({ deletedAt: new Date() }).where(eq(table.id, id));
    result(res, 200, { ok: true, id } satisfies CoworkerDeleteBody);
  };

  const listEvents = async (
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    const rows = await database
      .select()
      .from(coworkerEvents)
      .where(eq(coworkerEvents.coworkerId, id))
      .orderBy(asc(coworkerEvents.createdAt), asc(coworkerEvents.id));
    result(res, 200, { ok: true, items: rows.map(toEventDto) } satisfies CoworkerEventListBody);
  };

  const appendEvent = async (
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    const body = (await readJson(req)) as CreateEventBody;
    const verb = typeof body.verb === 'string' ? body.verb.trim() : '';
    if (verb.length === 0 || verb.length > COWORKER_EVENT_VERB_MAX) {
      fail(res, 'contract', 'Expected a verb (1-64 characters).');
      return;
    }
    const [created] = await database
      .insert(coworkerEvents)
      .values({
        id: randomUUID(),
        coworkerId: id,
        projectId: typeof body.projectId === 'string' ? body.projectId : null,
        actorKind: typeof body.actorKind === 'string' ? body.actorKind : 'user',
        verb,
        payload: body.payload ?? null,
      })
      .returning();
    if (!created) {
      fail(res, 'upstream', 'The event was not recorded.');
      return;
    }
    result(res, 201, { ok: true, item: toEventDto(created) } satisfies CoworkerEventBody);
  };

  const listEmployments = async (
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    const rows = await database
      .select()
      .from(coworkerEmployments)
      .where(eq(coworkerEmployments.coworkerId, id));
    result(
      res,
      200,
      {
        ok: true,
        items: rows.map((e) => ({
          coworkerId: e.coworkerId,
          wsId: e.wsId,
          role: e.role,
          grants: e.grants,
          employedAt: e.employedAt.toISOString(),
        })),
      } satisfies EmploymentListBody,
    );
  };

  const upsertEmployment = async (
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
    wsId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    const body = (await readJson(req)) as UpsertEmploymentBody;
    const [existing] = await database
      .select()
      .from(coworkerEmployments)
      .where(and(eq(coworkerEmployments.coworkerId, id), eq(coworkerEmployments.wsId, wsId)));
    const role = typeof body.role === 'string' ? body.role.trim().slice(0, 120) : (existing?.role ?? '');
    const grants = body.grants ?? existing?.grants ?? [];
    if (!Array.isArray(grants) || !grants.every((g) => typeof g === 'string')) {
      fail(res, 'contract', 'grants must be a list of tool ids.');
      return;
    }
    const [employment] = await database
      .insert(coworkerEmployments)
      .values({ coworkerId: id, wsId, role, grants })
      .onConflictDoUpdate({
        target: [coworkerEmployments.coworkerId, coworkerEmployments.wsId],
        set: { role, grants },
      })
      .returning();
    if (!employment) {
      fail(res, 'upstream', 'The employment was not saved.');
      return;
    }
    result(
      res,
      200,
      {
        ok: true,
        item: {
          coworkerId: employment.coworkerId,
          wsId: employment.wsId,
          role: employment.role,
          grants: employment.grants,
          employedAt: employment.employedAt.toISOString(),
        },
      } satisfies EmploymentBody,
    );
  };

  const removeEmployment = async (
    res: ServerResponse,
    id: string,
    wsId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    await database
      .delete(coworkerEmployments)
      .where(
        and(eq(coworkerEmployments.coworkerId, id), eq(coworkerEmployments.wsId, wsId)),
      );
    result(res, 200, { ok: true, wsId } satisfies EmploymentDeleteBody);
  };

  return { list, create, read, patch, remove, listEvents, appendEvent, listEmployments, upsertEmployment, removeEmployment };
}

export function createCoworkersRouter(
  db: ConversationDatabase | null,
  source: SessionSource,
): CoworkersRouter {
  const handlers = db ? makeHandlers(db) : null;

  return (req, res, path) => {
    const method = (req.method ?? 'GET').toUpperCase();
    const tail = path.slice('/api/coworkers'.length).replace(/^\//, '');
    let segments: string[] = [];
    try {
      segments = tail === '' ? [] : tail.split('/').map(decodeURIComponent);
    } catch {
      fail(res, 'contract', 'The coworker path is not valid URL encoding.');
      return;
    }

    const run = async (): Promise<void> => {
      const session = await source.read(req);
      if (!session) {
        authFail(res, 'unauthorized', 'Sign in to continue.');
        return;
      }
      if (!handlers) {
        fail(res, 'not_configured', 'DATABASE_URL is needed for coworkers.');
        return;
      }
      if (segments.length === 0) {
        if (method === 'GET') return handlers.list(res, session);
        if (method === 'POST') return handlers.create(req, res, session);
      } else if (segments.length === 1) {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The coworker id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.read(res, id, session);
        if (method === 'PATCH') return handlers.patch(req, res, id, session);
        if (method === 'DELETE') return handlers.remove(res, id, session);
      } else if (segments.length === 2 && segments[1] === 'events') {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The coworker id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.listEvents(res, id, session);
        if (method === 'POST') return handlers.appendEvent(req, res, id, session);
      } else if (segments.length === 2 && segments[1] === 'employments') {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The coworker id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.listEmployments(res, id, session);
      } else if (segments.length === 3 && segments[1] === 'employments') {
        const id = segments[0] ?? '';
        const wsId = segments[2] ?? '';
        if (!isSafeSegment(id) || !isSafeSegment(wsId)) {
          fail(res, 'contract', 'The coworker or workspace id is not a valid path segment.');
          return;
        }
        if (method === 'PUT') return handlers.upsertEmployment(req, res, id, wsId, session);
        if (method === 'DELETE') return handlers.removeEmployment(res, id, wsId, session);
      }
      fail(res, 'contract', `${method} is not allowed on this path.`);
    };

    run().catch(() => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      fail(res, 'upstream', 'The coworkers endpoint failed while answering.');
    });
  };
}
