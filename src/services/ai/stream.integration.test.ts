import { createServer as createHttpServer } from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import { handleAiStreamRequest } from '../../../server/ai';

/**
 * Level-1 integration: the real stream handler against a stub upstream,
 * driven by a real HTTP client. No vite, no browser — if deltas are lost,
 * this shows which side drops them.
 */

const UPSTREAM_PARTS = ['alpha ', 'beta ', 'gamma'];

function startStub(): Promise<string> {
  return new Promise((resolve) => {
    const server = createHttpServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({ start: true, model: 'stub-model' })}\n\n`);
        let i = 0;
        const timer = setInterval(() => {
          if (i < UPSTREAM_PARTS.length) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: UPSTREAM_PARTS[i++] } }] })}\n\n`);
            return;
          }
          clearInterval(timer);
          res.write(`data: ${JSON.stringify({ done: true, model: 'stub-model', ms: 5 })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }, 20);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as { port: number }).port}`));
  });
}

describe('the stream handler, end to end through HTTP', () => {
  let baseUrl: string;
  let server: ReturnType<typeof createHttpServer>;
  const env = { DEEPSEEK_API_KEY: 'sk-test', DEEPSEEK_BASE_URL: '' };

  afterAll(() => {
    server?.close();
  });

  it('forwards start, deltas and done as its own SSE events', async () => {
    baseUrl = await startStub();
    env.DEEPSEEK_BASE_URL = baseUrl;
    const httpServer = createHttpServer((req, res) => {
      void handleAiStreamRequest(req, res, env);
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    server = httpServer;
    const port = (httpServer.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${port}/api/ai/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const raw = await res.text();
    const events = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());

    expect(events.at(-1)).toBe('[DONE]');
    console.log('EVENTS', JSON.stringify(events));
    expect(events).toContain(JSON.stringify({ start: true, model: 'stub-model' }));
    const deltas = events
      .filter((e) => e.startsWith('{') && JSON.parse(e).delta !== undefined)
      .map((e) => JSON.parse(e).delta as string);
    expect(deltas.join('')).toBe('alpha beta gamma');
    expect(events.some((e) => JSON.parse(e).done === true)).toBe(true);
  }, 15000);
});
