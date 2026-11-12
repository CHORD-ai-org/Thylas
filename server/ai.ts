/// <reference types="node" />
/**
 * Vite adapter for the whole API (P1-1, P1-4). The standalone host mounts the
 * same `createApiRouter()`; this file only turns it into a Vite plugin for dev
 * and preview. `ai-handler.ts` still owns the three model endpoints.
 *
 * `overrides` carries the project's `.env` files; a variable the shell already
 * set wins, so a one-off `DEEPSEEK_MODEL=… npm run dev` behaves as expected and
 * a `.env.local` cannot silently redirect a test that sets its own value.
 */
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { readConfig } from './config.ts';
import { createApiRouter } from './router.ts';

/* Kept here so the HTTP integration tests keep their existing import path. */
export { handleAiRequest, handleAiStreamRequest } from './ai-handler.ts';

export function aiMiddleware(overrides: Record<string, string | undefined> = {}): Plugin {
  const env: Record<string, string | undefined> = { ...overrides, ...process.env };
  const router = createApiRouter(readConfig(env));

  return {
    name: 'thylas-api-endpoint',
    configureServer(server: ViteDevServer) {
      /* The router calls next() for anything outside /api/, so Vite still serves
         the SPA and its own middleware chain. */
      server.middlewares.use(router);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(router);
    },
  };
}
