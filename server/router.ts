/// <reference types="node" />
/**
 * The one API router, shared by the Vite plugin and the standalone host
 * (P1-1, P1-4). A path that is not under `/api/` is handed to `next()` so Vite
 * can still serve the SPA; the standalone host passes a final 404 instead.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AI_PATH, AI_STATUS_PATH, AI_STREAM_PATH, failure } from '../src/lib/ai.ts';
import { CONVERSATIONS_PATH } from '../src/lib/conversations.ts';
import { createAiHandlers } from './ai-handler.ts';
import type { ServerConfig } from './config.ts';
import { sendJson } from './http.ts';
import { createDb } from './persistence/client.ts';
import { createConversationRouter } from './routes/conversations.ts';

export type ApiRouter = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void,
) => void;

export function createApiRouter(config: ServerConfig): ApiRouter {
  const ai = createAiHandlers(config);
  const conversations = createConversationRouter(createDb(config));

  return (req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (path === AI_STATUS_PATH) return ai.status(req, res);
    if (path === AI_STREAM_PATH) return ai.stream(req, res);
    if (path === AI_PATH) return ai.completion(req, res);
    if (path === CONVERSATIONS_PATH || path.startsWith(`${CONVERSATIONS_PATH}/`)) {
      return conversations(req, res, path);
    }
    if (path.startsWith('/api/')) {
      sendJson(res, 404, failure('contract', 'Unknown API path.'));
      return;
    }
    next?.();
  };
}
