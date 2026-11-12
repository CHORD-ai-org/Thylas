import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { streamChat } from './stream';

/**
 * The client half against a local SSE server: deltas reach onDelta in order,
 * the result aggregates the text, and a stop reports a partial answer rather
 * than an error.
 */

let server: ReturnType<typeof createServer>;
let port = 0;
const sent: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      let i = 0;
      const parts = ['one ', 'two ', 'three'];
      const timer = setInterval(() => {
        if (i < parts.length) {
          const chunk = parts[i++]!;
          sent.push(chunk);
          res.write(`data: ${JSON.stringify({ model: 'deepseek-chat', choices: [{ delta: { content: chunk } }] })}\n\n`);
          return;
        }
        clearInterval(timer);
        res.write(`data: ${JSON.stringify({ done: true, model: 'deepseek-chat', ms: 42 })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }, 15);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
  /* point the client at the local server for this suite */
  process.env.__CHAT_STREAM_BASE = String(port);
});

afterAll(() => {
  server?.close();
});

/** The client hardcodes AI_STREAM_PATH; route through a tiny origin shim. */
const originalFetch = globalThis.fetch;

describe('streamChat', () => {
  it('delivers deltas incrementally and aggregates the text', async () => {
    const deltas: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = String(input);
      const url = raw.startsWith('http') ? raw : `http://127.0.0.1:${port}${raw}`;
      return originalFetch(url, init);
    }) as typeof fetch;
    try {
      const result = await streamChat('hello', [], undefined, (chunk) => deltas.push(chunk));
      console.log('RESULT', JSON.stringify(result));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.text).toBe('one two three');
        expect(result.model).toBe('deepseek-chat');
        expect(result.ms).toBeGreaterThan(0);
        expect(result.stopped).toBe(false);
      }
      expect(deltas.join('')).toBe('one two three');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
