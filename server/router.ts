/// <reference types="node" />
/**
 * The one API router, shared by the Vite plugin and the standalone host
 * (P1-1, P1-4, P1-5, P1-6, P1-7). A path that is not under `/api/` is handed
 * to `next()` so Vite can serve the SPA; the standalone host passes a final 404.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AI_PATH, AI_STATUS_PATH, AI_STREAM_PATH, failure } from '../src/lib/ai.ts';
import { CHAT_STATE_PATH } from '../src/lib/chat.ts';
import { CONVERSATIONS_PATH } from '../src/lib/conversations.ts';
import { FILES_PATH } from '../src/lib/files.ts';
import { SESSION_PATH } from '../src/lib/session.ts';
import { PROFILE_PATH } from '../src/lib/profile.ts';
import { createAiHandlers } from './ai-handler.ts';
import type { ServerConfig } from './config.ts';
import { sendJson } from './http.ts';
import { createDb } from './persistence/client.ts';
import { createChatRouter } from './routes/chat.ts';
import { createConversationRouter } from './routes/conversations.ts';
import { createFilesRouter } from './routes/files.ts';
import { createDefaultProfileRouter } from './routes/profile.ts';
import { createSessionHandler } from './session/handler.ts';
import { createSessionSource } from './session/source.ts';
import { createLocalStorage } from './storage/local.ts';

export type ApiRouter = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void,
) => void;

export function createApiRouter(config: ServerConfig): ApiRouter {
  const ai = createAiHandlers(config);
  const sessionSource = createSessionSource(config);
  const session = createSessionHandler(sessionSource);
  const db = createDb(config);
  const conversations = createConversationRouter(db, sessionSource);
  const files = createFilesRouter(db, createLocalStorage(config), sessionSource);
  const chat = createChatRouter(db, sessionSource);
  const profile = createDefaultProfileRouter(config, sessionSource);

  return (req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (path === AI_STATUS_PATH) return ai.status(req, res);
    if (path === AI_STREAM_PATH) return ai.stream(req, res);
    if (path === AI_PATH) return ai.completion(req, res);
    if (path === SESSION_PATH) return session(req, res);
    if (path === PROFILE_PATH || path.startsWith(`${PROFILE_PATH}/`)) {
      return profile(req, res, path);
    }
    if (path === CHAT_STATE_PATH) return chat(req, res, path);
    if (path === CONVERSATIONS_PATH || path.startsWith(`${CONVERSATIONS_PATH}/`)) {
      return conversations(req, res, path);
    }
    if (path === FILES_PATH || path.startsWith(`${FILES_PATH}/`)) {
      return files(req, res, path);
    }
    if (path.startsWith('/api/')) {
      sendJson(res, 404, failure('contract', 'Unknown API path.'));
      return;
    }
    next?.();
  };
}
