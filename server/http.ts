/// <reference types="node" />
/**
 * Shared HTTP primitives for server routes (P1-4). A named module, not a
 * `utils/` grab-bag: it owns exactly two things — writing a JSON response and
 * reading a bounded request body.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

/** 8000 characters is at most ~32 KB of UTF-8; 64 KB is the hard wire cap. */
export const MAX_BODY_BYTES = 64 * 1024;

export function sendJson<T>(res: ServerResponse, status: number, body: T): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(payload));
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

/**
 * Resolves with the body, or `null` when it exceeded MAX_BODY_BYTES. It keeps
 * draining past the cap so the response can still be written: destroying the
 * socket mid-upload turns a readable 413 into a reset connection.
 */
export function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let size = 0;
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(tooLarge ? null : chunks.join('')));
    req.on('error', reject);
  });
}
