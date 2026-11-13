/**
 * Client side of the conversations contract (Phase 1, next step 2). The wire
 * shapes come from `src/lib/conversations.ts` — the same file the server route
 * imports — so a field change is a compile error on both sides (D-006).
 *
 * Nothing throws across this boundary: every call resolves with a typed value,
 * including failures, the same house style as `src/services/ai/client.ts`.
 * The UI starts using this in P1-7; until then the tests are its consumer.
 */
import {
  CONVERSATIONS_PATH,
  conversationFailure,
  type ConversationBody,
  type ConversationDeleteBody,
  type ConversationErr,
  type ConversationListBody,
  type ConversationResultBody,
  type CreateConversationBody,
  type PatchConversationBody,
} from '../../lib/conversations';

type Fetcher = typeof fetch;

export type ConversationsClient = {
  list: (workspaceId?: string) => Promise<ConversationListBody | ConversationErr>;
  create: (body: CreateConversationBody) => Promise<ConversationBody | ConversationErr>;
  get: (id: string) => Promise<ConversationBody | ConversationErr>;
  patch: (id: string, body: PatchConversationBody) => Promise<ConversationBody | ConversationErr>;
  remove: (id: string) => Promise<ConversationDeleteBody | ConversationErr>;
};

async function request<T extends ConversationResultBody>(
  fetcher: Fetcher,
  url: string,
  init?: RequestInit,
): Promise<T | ConversationErr> {
  try {
    const res = await fetcher(url, init);
    const body = (await res.json()) as ConversationResultBody;
    return body.ok ? (body as T) : body;
  } catch {
    return conversationFailure('upstream', 'The conversations API could not be reached.');
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function pathFor(id?: string): string {
  return id === undefined ? CONVERSATIONS_PATH : `${CONVERSATIONS_PATH}/${encodeURIComponent(id)}`;
}

export function createConversationsClient(fetcher: Fetcher = fetch): ConversationsClient {
  return {
    list: (workspaceId) =>
      request<ConversationListBody>(
        fetcher,
        workspaceId
          ? `${CONVERSATIONS_PATH}?workspaceId=${encodeURIComponent(workspaceId)}`
          : CONVERSATIONS_PATH,
      ),
    create: (body) => request<ConversationBody>(fetcher, pathFor(), jsonInit('POST', body)),
    get: (id) => request<ConversationBody>(fetcher, pathFor(id)),
    patch: (id, body) => request<ConversationBody>(fetcher, pathFor(id), jsonInit('PATCH', body)),
    remove: (id) => request<ConversationDeleteBody>(fetcher, pathFor(id), jsonInit('DELETE')),
  };
}
