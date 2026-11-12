/// <reference types="node" />
/**
 * Vite adapter for the model endpoints. The implementation lives in
 * `ai-handler.ts` so the standalone Node host mounts exactly the same code
 * (D-055, P1-1). Mounted by `vite.config.ts` in dev and preview.
 *
 * `overrides` carries the project's `.env` files; a variable the shell already
 * set wins, so a one-off `DEEPSEEK_MODEL=… npm run dev` behaves as expected and
 * a `.env.local` cannot silently redirect a test that sets its own value.
 */
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { AI_PATH, AI_STATUS_PATH, AI_STREAM_PATH } from '../src/lib/ai.ts';
import { readConfig } from './config.ts';
import { createAiHandlers } from './ai-handler.ts';

/* Kept here so the HTTP integration tests keep their existing import path. */
export { handleAiRequest, handleAiStreamRequest } from './ai-handler.ts';

export function aiMiddleware(overrides: Record<string, string | undefined> = {}): Plugin {
  const env: Record<string, string | undefined> = { ...overrides, ...process.env };
  const config = readConfig(env);
  const handlers = createAiHandlers(config);

  return {
    name: 'thylas-ai-endpoint',
    configureServer(server: ViteDevServer) {
      /* Registered longest-path-first: `/api/ai` is a prefix of both `/api/ai/status`
         and `/api/ai/stream`, so the longer paths have to win the match. */
      server.middlewares.use(AI_STATUS_PATH, handlers.status);
      server.middlewares.use(AI_STREAM_PATH, handlers.stream);
      server.middlewares.use(AI_PATH, handlers.completion);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(AI_STATUS_PATH, handlers.status);
      server.middlewares.use(AI_STREAM_PATH, handlers.stream);
      server.middlewares.use(AI_PATH, handlers.completion);
    },
  };
}
