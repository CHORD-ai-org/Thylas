/// <reference types="node" />
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pipeBodyToFile } from './http.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'thylas-http-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function body(chunks: Buffer[]): IncomingMessage {
  return Readable.from(chunks, { objectMode: false }) as unknown as IncomingMessage;
}

describe('pipeBodyToFile', () => {
  it('streams bytes to disk without buffering the whole body', async () => {
    const dest = join(dir, 'a');
    const result = await pipeBodyToFile(
      body([Buffer.from('hel'), Buffer.from('lo')]),
      dest,
      100,
    );
    expect(result).toEqual({ ok: true, bytes: 5 });
    expect(await readFile(dest, 'utf8')).toBe('hello');
  });

  it('deletes the partial file and reports too_large past the cap', async () => {
    const dest = join(dir, 'b');
    const result = await pipeBodyToFile(
      body([Buffer.from('1234'), Buffer.from('5678')]),
      dest,
      5,
    );
    expect(result).toEqual({ ok: false, reason: 'too_large' });
    await expect(stat(dest)).rejects.toThrow();
  });

  it('refuses to overwrite an existing file id', async () => {
    const dest = join(dir, 'c');
    expect(await pipeBodyToFile(body([Buffer.from('first')]), dest, 100)).toEqual({
      ok: true,
      bytes: 5,
    });
    const second = await pipeBodyToFile(body([Buffer.from('second')]), dest, 100);
    expect(second).toEqual({ ok: false, reason: 'io' });
    expect(await readFile(dest, 'utf8')).toBe('first');
  });
});
