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
  type EntriesBody,
  type FolderEntry,
  type ProjectBody,
  type ProjectConnectionDto,
  type ProjectDeleteBody,
  type ProjectDto,
  type ProjectErrorKind,
  type ProjectListBody,
  type ProjectResultBody,
  type ProjectState,
  type CandidateBody,
  type CandidateListBody,
  type CreateCandidateBody,
  type CreateHandoffBody,
  type HandoffBody,
  type HandoffDto,
  type HandoffListBody,
  type MemberBody,
  type MemberDeleteBody,
  type MemberListBody,
  type ProjectCandidateDto,
  type ProjectMemberDto,
  type UpsertMemberBody,
} from '../../src/lib/projects.ts';
import {
  sessionFailure,
  statusForSession,
  type SessionErrorKind,
  type SessionUser,
} from '../../src/lib/session.ts';
import { isSafeSegment } from '../../src/lib/files.ts';
import {
  createConnectorEntries,
  createConnectorProbe,
  normalizeConnectionLocator,
  type ConnectorEntries,
  type LocatorProbe,
} from '../connectors.ts';
import { sendJson } from '../http.ts';
import {
  coworkerEvents,
  handoffPackages,
  projectCandidates,
  projectConnections,
  projectMembers,
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

type MemberRow = typeof projectMembers.$inferSelect;
type CandidateRow = typeof projectCandidates.$inferSelect;

function toMemberDto(row: MemberRow): ProjectMemberDto {
  return {
    projectId: row.projectId,
    actorId: row.actorId,
    actorKind: row.actorKind,
    role: row.role,
    grants: row.grants,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCandidateDto(row: CandidateRow): ProjectCandidateDto {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    proposedBy: row.proposedBy,
    proposedByName: row.proposedByName,
    status: row.status as ProjectCandidateDto['status'],
    confirmedBy: row.confirmedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type HandoffRow = typeof handoffPackages.$inferSelect;

function toHandoffDto(row: HandoffRow): HandoffDto {
  return {
    id: row.id,
    projectId: row.projectId,
    fromCoworkerId: row.fromCoworkerId,
    fromName: row.fromName,
    toCoworkerId: row.toCoworkerId,
    toName: row.toName,
    task: row.task,
    inputs: row.inputs,
    outputSchema: row.outputSchema,
    maxSteps: row.maxSteps,
    done: row.done,
    openNotes: row.openNotes,
    nextStep: row.nextStep,
    grants: row.grants,
    status: row.status as HandoffDto['status'],
    stuckNote: row.stuckNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeHandlers(
  database: ConversationDatabase,
  probe: LocatorProbe,
  entries: ConnectorEntries = createConnectorEntries(),
) {
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
    const normalized = normalizeConnectionLocator(kind, locator);
    const health = await probe(kind, normalized);
    const id = randomUUID();
    try {
      const [created] = await database
        .insert(projectConnections)
        .values({ id, projectId, kind, locator: normalized, label, health })
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
      const normalized = normalizeConnectionLocator(connection.kind as ConnectionKind, locator);
      updates.locator = normalized;
      updates.health = await probe(connection.kind as ConnectionKind, normalized);
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

  /* Detail-page worktree browsing (08 P0-3). `subpath` is relative and is
     validated against the connection root by the connector; a kind without a
     listing connector answers `not_configured` — no invented entries. */
  const listEntries = async (
    res: ServerResponse,
    projectId: string,
    connectionId: string,
    subpath: string,
    session: SessionUser,
  ): Promise<void> => {
    const connection = await readConnection(res, projectId, connectionId, session);
    if (!connection) return;
    if (cleanText(subpath, 512) === null) {
      fail(res, 'contract', 'The entries path is not valid.');
      return;
    }
    let listed: FolderEntry[] | null;
    try {
      listed = await entries(connection.kind as ConnectionKind, connection.locator, subpath);
    } catch (err) {
      fail(res, 'contract', err instanceof Error ? err.message : 'The entries path is not valid.');
      return;
    }
    if (listed === null) {
      fail(res, 'not_configured', `Browsing "${connection.kind}" connections is not wired in this build.`);
      return;
    }
    result(res, 200, {
      ok: true,
      connectionId,
      path: subpath,
      entries: listed,
    } satisfies EntriesBody);
  };

  /* C2-1 参工层 + C2-2 署名落回 (Coworker plan §27). */
  const listMembers = async (
    res: ServerResponse,
    projectId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const rows = await database
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
    result(res, 200, { ok: true, items: rows.map(toMemberDto) } satisfies MemberListBody);
  };

  const upsertMember = async (
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    actorId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const body = (await readJson(req)) as UpsertMemberBody;
    const [existing] = await database
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.actorId, actorId)));
    const role = typeof body.role === 'string' ? body.role.trim().slice(0, 120) : (existing?.role ?? '');
    const grants = body.grants ?? existing?.grants ?? [];
    if (!Array.isArray(grants) || !grants.every((g) => typeof g === 'string')) {
      fail(res, 'contract', 'grants must be a list of resource ids.');
      return;
    }
    const actorKind =
      typeof body.actorKind === 'string' ? body.actorKind : (existing?.actorKind ?? 'coworker');
    const [member] = await database
      .insert(projectMembers)
      .values({ projectId, actorId, actorKind, role, grants })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.actorId],
        set: { role, grants, actorKind },
      })
      .returning();
    if (!member) {
      fail(res, 'upstream', 'The member was not saved.');
      return;
    }
    result(res, 200, { ok: true, item: toMemberDto(member) } satisfies MemberBody);
  };

  const removeMember = async (
    res: ServerResponse,
    projectId: string,
    actorId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    await database
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.actorId, actorId)));
    result(res, 200, { ok: true, actorId } satisfies MemberDeleteBody);
  };

  const listCandidates = async (
    res: ServerResponse,
    projectId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const rows = await database
      .select()
      .from(projectCandidates)
      .where(eq(projectCandidates.projectId, projectId))
      .orderBy(asc(projectCandidates.createdAt));
    result(res, 200, { ok: true, items: rows.map(toCandidateDto) } satisfies CandidateListBody);
  };

  const createCandidate = async (
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const body = (await readJson(req)) as CreateCandidateBody;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body : '';
    const proposedBy = typeof body.proposedBy === 'string' ? body.proposedBy : '';
    const proposedByName =
      typeof body.proposedByName === 'string' ? body.proposedByName.trim().slice(0, 60) : '';
    if (title.length === 0 || title.length > 255 || text.length > 4000 || !isSafeSegment(proposedBy)) {
      fail(res, 'contract', 'Expected a title (1-255), a body under 4000 and a proposedBy id.');
      return;
    }
    const [created] = await database
      .insert(projectCandidates)
      .values({
        id: randomUUID(),
        projectId,
        title,
        body: text,
        proposedBy,
        proposedByName,
        status: 'proposed',
      })
      .returning();
    if (!created) {
      fail(res, 'upstream', 'The candidate was not recorded.');
      return;
    }
    result(res, 201, { ok: true, item: toCandidateDto(created) } satisfies CandidateBody);
  };

  const setCandidateStatus = async (
    res: ServerResponse,
    projectId: string,
    candidateId: string,
    accept: boolean,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const [candidate] = await database
      .select()
      .from(projectCandidates)
      .where(eq(projectCandidates.id, candidateId));
    if (!candidate || candidate.projectId !== projectId) {
      fail(res, 'not_found', `No candidate with id "${candidateId}".`);
      return;
    }
    const [updated] = await database
      .update(projectCandidates)
      .set({
        status: accept ? 'accepted' : 'rejected',
        confirmedBy: accept ? session.id : candidate.confirmedBy,
        updatedAt: new Date(),
      })
      .where(eq(projectCandidates.id, candidateId))
      .returning();
    if (!updated) {
      fail(res, 'upstream', 'The candidate was not updated.');
      return;
    }
    result(res, 200, { ok: true, item: toCandidateDto(updated) } satisfies CandidateBody);
  };

  /* C3-1/C3-2 交接包 (Coworker plan §27): one row = the whole transfer;
     creation is transactional — failure means the handoff never happened. */
  const listHandoffs = async (
    res: ServerResponse,
    projectId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const rows = await database
      .select()
      .from(handoffPackages)
      .where(eq(handoffPackages.projectId, projectId))
      .orderBy(asc(handoffPackages.createdAt));
    result(res, 200, { ok: true, items: rows.map(toHandoffDto) } satisfies HandoffListBody);
  };

  const createHandoff = async (
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const body = (await readJson(req)) as CreateHandoffBody;
    const task = typeof body.task === 'string' ? body.task.trim() : '';
    const fromCoworkerId = typeof body.fromCoworkerId === 'string' ? body.fromCoworkerId : '';
    const toCoworkerId = typeof body.toCoworkerId === 'string' ? body.toCoworkerId : '';
    const fromName = typeof body.fromName === 'string' ? body.fromName.trim().slice(0, 60) : '';
    const toName = typeof body.toName === 'string' ? body.toName.trim().slice(0, 60) : '';
    const inputs = body.inputs ?? [];
    const grants = body.grants ?? [];
    const maxSteps = typeof body.maxSteps === 'number' && body.maxSteps >= 1 && body.maxSteps <= 100
      ? Math.floor(body.maxSteps)
      : 3;
    if (
      task.length === 0 ||
      task.length > 4000 ||
      !isSafeSegment(fromCoworkerId) ||
      !isSafeSegment(toCoworkerId) ||
      !Array.isArray(inputs) ||
      !inputs.every((x) => typeof x === 'string') ||
      !Array.isArray(grants) ||
      !grants.every((x) => typeof x === 'string')
    ) {
      fail(
        res,
        'contract',
        'Expected a task (1-4000), safe coworker ids and string lists for inputs/grants.',
      );
      return;
    }
    const id = randomUUID();
    try {
      await database.transaction(async (tx) => {
        await tx.insert(handoffPackages).values({
          id,
          projectId,
          fromCoworkerId,
          fromName,
          toCoworkerId,
          toName,
          task,
          inputs,
          outputSchema: typeof body.outputSchema === 'string' ? body.outputSchema.slice(0, 4000) : '',
          maxSteps,
          done: typeof body.done === 'string' ? body.done.slice(0, 4000) : '',
          openNotes: typeof body.openNotes === 'string' ? body.openNotes.slice(0, 4000) : '',
          nextStep: typeof body.nextStep === 'string' ? body.nextStep.slice(0, 4000) : '',
          grants,
          status: 'open',
        });
        const payload = { handoffId: id, projectId };
        await tx.insert(coworkerEvents).values({
          id: randomUUID(),
          coworkerId: fromCoworkerId,
          projectId,
          actorKind: 'coworker',
          verb: 'handoff',
          payload,
        });
        await tx.insert(coworkerEvents).values({
          id: randomUUID(),
          coworkerId: toCoworkerId,
          projectId,
          actorKind: 'coworker',
          verb: 'handoff_received',
          payload,
        });
      });
    } catch {
      fail(res, 'upstream', 'The handoff was not saved — nothing was transferred.');
      return;
    }
    const [created] = await database
      .select()
      .from(handoffPackages)
      .where(eq(handoffPackages.id, id));
    if (!created) {
      fail(res, 'upstream', 'The handoff was not saved — nothing was transferred.');
      return;
    }
    result(res, 201, { ok: true, item: toHandoffDto(created) } satisfies HandoffBody);
  };

  const setHandoffStatus = async (
    res: ServerResponse,
    projectId: string,
    handoffId: string,
    needsHuman: boolean,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readProject(res, projectId, session);
    if (!row) return;
    const [handoff] = await database
      .select()
      .from(handoffPackages)
      .where(eq(handoffPackages.id, handoffId));
    if (!handoff || handoff.projectId !== projectId) {
      fail(res, 'not_found', `No handoff with id "${handoffId}".`);
      return;
    }
    const [updated] = await database
      .update(handoffPackages)
      .set({
        status: needsHuman ? 'needs_human' : 'open',
        stuckNote: needsHuman ? (handoff.stuckNote || '交接停在需要人裁决的一步') : '',
        updatedAt: new Date(),
      })
      .where(eq(handoffPackages.id, handoffId))
      .returning();
    if (!updated) {
      fail(res, 'upstream', 'The handoff was not updated.');
      return;
    }
    result(res, 200, { ok: true, item: toHandoffDto(updated) } satisfies HandoffBody);
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
    listEntries,
    listMembers,
    upsertMember,
    removeMember,
    listCandidates,
    createCandidate,
    setCandidateStatus,
    listHandoffs,
    createHandoff,
    setHandoffStatus,
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
  entries: ConnectorEntries = createConnectorEntries(),
): ProjectsRouter {
  const handlers = db ? makeHandlers(db, probe, entries) : null;

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
      } else if (
        segments.length === 4 &&
        segments[1] === 'connections' &&
        segments[3] === 'entries' &&
        method === 'GET'
      ) {
        const id = segments[0] ?? '';
        const connectionId = segments[2] ?? '';
        if (!isSafeSegment(id) || !isSafeSegment(connectionId)) {
          fail(res, 'contract', 'The project or connection id is not a valid path segment.');
          return;
        }
        let subpath = '';
        try {
          subpath = new URL(req.url ?? '', 'http://localhost').searchParams.get('path') ?? '';
        } catch {
          subpath = '';
        }
        return handlers.listEntries(res, id, connectionId, subpath, session);
      } else if (segments.length === 2 && segments[1] === 'members') {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The project id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.listMembers(res, id, session);
      } else if (segments.length === 3 && segments[1] === 'members') {
        const id = segments[0] ?? '';
        const actorId = segments[2] ?? '';
        if (!isSafeSegment(id) || !isSafeSegment(actorId)) {
          fail(res, 'contract', 'The project or actor id is not a valid path segment.');
          return;
        }
        if (method === 'PUT') return handlers.upsertMember(req, res, id, actorId, session);
        if (method === 'DELETE') return handlers.removeMember(res, id, actorId, session);
      } else if (segments.length === 2 && segments[1] === 'candidates') {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The project id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.listCandidates(res, id, session);
        if (method === 'POST') return handlers.createCandidate(req, res, id, session);
      } else if (segments.length === 4 && segments[1] === 'candidates' && method === 'POST') {
        const id = segments[0] ?? '';
        const candidateId = segments[2] ?? '';
        const action = segments[3] ?? '';
        if (!isSafeSegment(id) || !isSafeSegment(candidateId)) {
          fail(res, 'contract', 'The project or candidate id is not a valid path segment.');
          return;
        }
        if (action === 'confirm') return handlers.setCandidateStatus(res, id, candidateId, true, session);
        if (action === 'reject') return handlers.setCandidateStatus(res, id, candidateId, false, session);
      } else if (segments.length === 2 && segments[1] === 'handoffs') {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The project id is not a valid path segment.');
          return;
        }
        if (method === 'GET') return handlers.listHandoffs(res, id, session);
        if (method === 'POST') return handlers.createHandoff(req, res, id, session);
      } else if (segments.length === 4 && segments[1] === 'handoffs' && method === 'POST') {
        const id = segments[0] ?? '';
        const handoffId = segments[2] ?? '';
        const action = segments[3] ?? '';
        if (!isSafeSegment(id) || !isSafeSegment(handoffId)) {
          fail(res, 'contract', 'The project or handoff id is not a valid path segment.');
          return;
        }
        if (action === 'stuck') return handlers.setHandoffStatus(res, id, handoffId, true, session);
        if (action === 'resume') return handlers.setHandoffStatus(res, id, handoffId, false, session);
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

/* `projectMembers` shipped empty in P0-1; its surface arrived with C2-1
   (参工层) together with the Coworker minimum entity — see the handlers above. */
