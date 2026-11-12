/// <reference types="node" />
/**
 * Standalone host for the three `/api/ai*` endpoints (D-055, P1-1).
 *
 * Start with `npm run api`. It is a plain `node:http` server: no Vite, no
 * framework, and the same `createAiHandlers()` the dev plugin uses. Node loads
 * `.env.local` through `--env-file-if-exists`; a real shell variable wins.
 *
 * Smoke test: `curl http://127.0.0.1:8787/api/ai/status` answers
 * `{ configured, model }` without touching the key or the upstream.
 */
import { createServer } from 'node:http';
import { readConfig } from './config.ts';
import { createAiHandlers, handleApiRequest } from './ai-handler.ts';

/* config.ts is the only reader of environment variables (P1-2). */
const config = readConfig(process.env);
const handlers = createAiHandlers(config);

createServer((req, res) => handleApiRequest(req, res, handlers)).listen(
  config.port,
  '127.0.0.1',
  () => {
    /* Never print the key: only whether one is present (ENGINEERING-STANDARDS §4). */
    process.stdout.write(
      `[thylas-api] http://127.0.0.1:${config.port} · model ${config.model} · key ${config.apiKey ? 'set' : 'missing'}\n`,
    );
  },
);
