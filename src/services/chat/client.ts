/**
 * Client side of the chat state contract (P1-7). Both calls are fire-and-forget
 * from the store's point of view: nothing throws, failures come back as a typed
 * value so the local envelope can stay as the fallback.
 */
import {
  CHAT_STATE_PATH,
  chatFailure,
  type ChatErr,
  type ChatPutOk,
  type ChatResultBody,
  type ChatStateDto,
  type PutChatStateBody,
} from '../../lib/chat';

export type ChatClient = {
  getState: () => Promise<ChatStateDto | ChatErr>;
  putState: (body: PutChatStateBody) => Promise<ChatPutOk | ChatErr>;
};

async function request<T extends ChatResultBody>(
  fetcher: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<T | ChatErr> {
  try {
    const res = await fetcher(url, { ...init, credentials: 'include' });
    const body = (await res.json()) as ChatResultBody;
    return body.ok ? (body as T) : body;
  } catch {
    return chatFailure('upstream', 'The chat state API could not be reached.');
  }
}

export function createChatClient(fetcher: typeof fetch = fetch): ChatClient {
  return {
    getState: () => request<ChatStateDto>(fetcher, CHAT_STATE_PATH),
    putState: (body) =>
      request<ChatPutOk>(fetcher, CHAT_STATE_PATH, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };
}
