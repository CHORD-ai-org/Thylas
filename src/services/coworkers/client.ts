/**
 * Client side of the coworkers contract (C0). Wire shapes come from
 * `src/lib/coworkers.ts` — the same file the server route imports. House
 * style: nothing throws across this boundary; every call resolves typed.
 */
import {
  COWORKERS_PATH,
  coworkerFailure,
  type CoworkerBody,
  type CoworkerDeleteBody,
  type CoworkerErr,
  type CoworkerEventBody,
  type CoworkerEventListBody,
  type CoworkerListBody,
  type CoworkerResultBody,
  type CreateCoworkerBody,
  type CreateEventBody,
  type PatchCoworkerBody,
} from '../../lib/coworkers';

type Fetcher = typeof fetch;

export type CoworkersClient = {
  list: () => Promise<CoworkerListBody | CoworkerErr>;
  create: (body: CreateCoworkerBody) => Promise<CoworkerBody | CoworkerErr>;
  get: (id: string) => Promise<CoworkerBody | CoworkerErr>;
  patch: (id: string, body: PatchCoworkerBody) => Promise<CoworkerBody | CoworkerErr>;
  remove: (id: string) => Promise<CoworkerDeleteBody | CoworkerErr>;
  listEvents: (id: string) => Promise<CoworkerEventListBody | CoworkerErr>;
  createEvent: (id: string, body: CreateEventBody) => Promise<CoworkerEventBody | CoworkerErr>;
};

async function request<T extends CoworkerResultBody>(
  fetcher: Fetcher,
  url: string,
  init?: RequestInit,
): Promise<T | CoworkerErr> {
  try {
    const res = await fetcher(url, init);
    const body = (await res.json()) as CoworkerResultBody;
    return body.ok ? (body as T) : body;
  } catch {
    return coworkerFailure('upstream', 'The coworkers API could not be reached.');
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function pathFor(id: string, tail = ''): string {
  return `${COWORKERS_PATH}/${encodeURIComponent(id)}${tail}`;
}

export function createCoworkersClient(fetcher: Fetcher = fetch): CoworkersClient {
  return {
    list: () => request<CoworkerListBody>(fetcher, COWORKERS_PATH),
    create: (body) => request<CoworkerBody>(fetcher, COWORKERS_PATH, jsonInit('POST', body)),
    get: (id) => request<CoworkerBody>(fetcher, pathFor(id)),
    patch: (id, body) => request<CoworkerBody>(fetcher, pathFor(id), jsonInit('PATCH', body)),
    remove: (id) => request<CoworkerDeleteBody>(fetcher, pathFor(id), jsonInit('DELETE')),
    listEvents: (id) => request<CoworkerEventListBody>(fetcher, pathFor(id, '/events')),
    createEvent: (id, body) =>
      request<CoworkerEventBody>(fetcher, pathFor(id, '/events'), jsonInit('POST', body)),
  };
}
