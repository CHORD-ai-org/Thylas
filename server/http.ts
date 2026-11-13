/// <reference types="node" />
/**
 * Shared HTTP primitives for server routes (P1-4, P1-6). A named module, not a
 * `utils/` grab-bag: JSON responses, bounded request bodies, and streamed
 * uploads. `readBody()` must never be used for a file — its 64 KB cap is for
 * JSON contracts only.
 */
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'invalid_json' | 'io' };

/**
 * Bounded JSON body reader for the chat state surface (P1-7). `readBody()` is
 * capped at 64 KB for contracts; a full chat envelope can be much larger.
 * Past `maxBytes` it keeps draining so the caller can still answer 413.
 */
export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = 8 * 1024 * 1024,
): Promise<JsonBodyResult> {
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  try {
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        tooLarge = true;
        continue;
      }
      chunks.push(buffer);
    }
  } catch {
    return { ok: false, reason: 'io' };
  }
  if (tooLarge) return { ok: false, reason: 'too_large' };
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

export type UploadResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: 'too_large' | 'io' };

/**
 * Streams a request body to disk without buffering it. Past `maxBytes` it keeps
 * draining but writes nothing, then removes the partial file — the caller can
 * still answer 413 instead of the socket resetting. `flags: 'wx'` refuses to
 * overwrite an existing file id.
 */
export async function pipeBodyToFile(
  req: IncomingMessage,
  destination: string,
  maxBytes: number,
): Promise<UploadResult> {
  let bytes = 0;
  let tooLarge = false;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        tooLarge = true;
        callback(null, Buffer.alloc(0));
        return;
      }
      callback(null, chunk);
    },
  });

  const output = createWriteStream(destination, { flags: 'wx' });
  let created = false;
  output.on('open', () => {
    created = true;
  });

  try {
    await pipeline(req, counter, output);
  } catch {
    /* EEXIST means the file was never ours — never delete someone else's bytes. */
    if (created) await unlink(destination).catch(() => {});
    return { ok: false, reason: 'io' };
  }
  if (tooLarge) {
    if (created) await unlink(destination).catch(() => {});
    return { ok: false, reason: 'too_large' };
  }
  return { ok: true, bytes };
}
