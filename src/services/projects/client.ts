/**
 * Client side of the projects contract (P1). Wire shapes come from
 * `src/lib/projects.ts` — the same file the server route imports — so a field
 * change is a compile error on both sides (D-006). House style: nothing throws
 * across this boundary; every call resolves with a typed value.
 */
import {
  PROJECTS_PATH,
  projectFailure,
  type CandidateBody,
  type CandidateListBody,
  type ConnectionBody,
  type ConnectionDeleteBody,
  type ConnectionListBody,
  type CreateCandidateBody,
  type CreateConnectionBody,
  type CreateHandoffBody,
  type CreateProjectBody,
  type EntriesBody,
  type HandoffBody,
  type HandoffListBody,
  type MemberBody,
  type MemberDeleteBody,
  type MemberListBody,
  type PatchConnectionBody,
  type PatchProjectBody,
  type ProjectBody,
  type ProjectDeleteBody,
  type ProjectErr,
  type ProjectListBody,
  type ProjectResultBody,
  type UpsertMemberBody,
} from '../../lib/projects';

type Fetcher = typeof fetch;

export type ProjectsClient = {
  list: (workspaceId?: string) => Promise<ProjectListBody | ProjectErr>;
  create: (body: CreateProjectBody) => Promise<ProjectBody | ProjectErr>;
  get: (id: string) => Promise<ProjectBody | ProjectErr>;
  patch: (id: string, body: PatchProjectBody) => Promise<ProjectBody | ProjectErr>;
  remove: (id: string) => Promise<ProjectDeleteBody | ProjectErr>;
  listConnections: (projectId: string) => Promise<ConnectionListBody | ProjectErr>;
  createConnection: (
    projectId: string,
    body: CreateConnectionBody,
  ) => Promise<ConnectionBody | ProjectErr>;
  patchConnection: (
    projectId: string,
    connectionId: string,
    body: PatchConnectionBody,
  ) => Promise<ConnectionBody | ProjectErr>;
  checkConnection: (
    projectId: string,
    connectionId: string,
  ) => Promise<ConnectionBody | ProjectErr>;
  removeConnection: (
    projectId: string,
    connectionId: string,
  ) => Promise<ConnectionDeleteBody | ProjectErr>;
  /** One level of a connected folder (`path` is relative to the root). */
  listEntries: (
    projectId: string,
    connectionId: string,
    path?: string,
  ) => Promise<EntriesBody | ProjectErr>;
  listMembers: (projectId: string) => Promise<MemberListBody | ProjectErr>;
  upsertMember: (
    projectId: string,
    actorId: string,
    body: UpsertMemberBody,
  ) => Promise<MemberBody | ProjectErr>;
  removeMember: (projectId: string, actorId: string) => Promise<MemberDeleteBody | ProjectErr>;
  listCandidates: (projectId: string) => Promise<CandidateListBody | ProjectErr>;
  createCandidate: (
    projectId: string,
    body: CreateCandidateBody,
  ) => Promise<CandidateBody | ProjectErr>;
  setCandidateStatus: (
    projectId: string,
    candidateId: string,
    accept: boolean,
  ) => Promise<CandidateBody | ProjectErr>;
  listHandoffs: (projectId: string) => Promise<HandoffListBody | ProjectErr>;
  createHandoff: (projectId: string, body: CreateHandoffBody) => Promise<HandoffBody | ProjectErr>;
  setHandoffStuck: (projectId: string, handoffId: string) => Promise<HandoffBody | ProjectErr>;
  resumeHandoff: (projectId: string, handoffId: string) => Promise<HandoffBody | ProjectErr>;
};

async function request<T extends ProjectResultBody>(
  fetcher: Fetcher,
  url: string,
  init?: RequestInit,
): Promise<T | ProjectErr> {
  try {
    const res = await fetcher(url, init);
    const body = (await res.json()) as ProjectResultBody;
    return body.ok ? (body as T) : body;
  } catch {
    return projectFailure('upstream', 'The projects API could not be reached.');
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function projectPath(id: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(id)}`;
}

function connectionPath(projectId: string, connectionId?: string): string {
  const base = `${projectPath(projectId)}/connections`;
  return connectionId === undefined ? base : `${base}/${encodeURIComponent(connectionId)}`;
}

export function createProjectsClient(fetcher: Fetcher = fetch): ProjectsClient {
  return {
    list: (workspaceId) =>
      request<ProjectListBody>(
        fetcher,
        workspaceId
          ? `${PROJECTS_PATH}?workspaceId=${encodeURIComponent(workspaceId)}`
          : PROJECTS_PATH,
      ),
    create: (body) => request<ProjectBody>(fetcher, PROJECTS_PATH, jsonInit('POST', body)),
    get: (id) => request<ProjectBody>(fetcher, projectPath(id)),
    patch: (id, body) => request<ProjectBody>(fetcher, projectPath(id), jsonInit('PATCH', body)),
    remove: (id) => request<ProjectDeleteBody>(fetcher, projectPath(id), jsonInit('DELETE')),
    listConnections: (projectId) =>
      request<ConnectionListBody>(fetcher, connectionPath(projectId)),
    createConnection: (projectId, body) =>
      request<ConnectionBody>(fetcher, connectionPath(projectId), jsonInit('POST', body)),
    patchConnection: (projectId, connectionId, body) =>
      request<ConnectionBody>(
        fetcher,
        connectionPath(projectId, connectionId),
        jsonInit('PATCH', body),
      ),
    checkConnection: (projectId, connectionId) =>
      request<ConnectionBody>(
        fetcher,
        `${connectionPath(projectId, connectionId)}/check`,
        jsonInit('POST'),
      ),
    removeConnection: (projectId, connectionId) =>
      request<ConnectionDeleteBody>(
        fetcher,
        connectionPath(projectId, connectionId),
        jsonInit('DELETE'),
      ),
    listEntries: (projectId, connectionId, path = '') =>
      request<EntriesBody>(
        fetcher,
        `${connectionPath(projectId, connectionId)}/entries?path=${encodeURIComponent(path)}`,
      ),
    listMembers: (projectId) => request<MemberListBody>(fetcher, `${projectPath(projectId)}/members`),
    upsertMember: (projectId, actorId, body) =>
      request<MemberBody>(
        fetcher,
        `${projectPath(projectId)}/members/${encodeURIComponent(actorId)}`,
        jsonInit('PUT', body),
      ),
    removeMember: (projectId, actorId) =>
      request<MemberDeleteBody>(
        fetcher,
        `${projectPath(projectId)}/members/${encodeURIComponent(actorId)}`,
        jsonInit('DELETE'),
      ),
    listCandidates: (projectId) =>
      request<CandidateListBody>(fetcher, `${projectPath(projectId)}/candidates`),
    createCandidate: (projectId, body) =>
      request<CandidateBody>(fetcher, `${projectPath(projectId)}/candidates`, jsonInit('POST', body)),
    setCandidateStatus: (projectId, candidateId, accept) =>
      request<CandidateBody>(
        fetcher,
        `${projectPath(projectId)}/candidates/${encodeURIComponent(candidateId)}/${accept ? 'confirm' : 'reject'}`,
        jsonInit('POST'),
      ),
    listHandoffs: (projectId) =>
      request<HandoffListBody>(fetcher, `${projectPath(projectId)}/handoffs`),
    createHandoff: (projectId, body) =>
      request<HandoffBody>(fetcher, `${projectPath(projectId)}/handoffs`, jsonInit('POST', body)),
    setHandoffStuck: (projectId, handoffId) =>
      request<HandoffBody>(
        fetcher,
        `${projectPath(projectId)}/handoffs/${encodeURIComponent(handoffId)}/stuck`,
        jsonInit('POST'),
      ),
    resumeHandoff: (projectId, handoffId) =>
      request<HandoffBody>(
        fetcher,
        `${projectPath(projectId)}/handoffs/${encodeURIComponent(handoffId)}/resume`,
        jsonInit('POST'),
      ),
  };
}
