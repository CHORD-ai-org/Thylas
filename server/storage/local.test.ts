/// <reference types="node" />
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../config.ts';
import { createLocalStorage } from './local.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'thylas-storage-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function body(text: string): IncomingMessage {
  return Readable.from([Buffer.from(text)], { objectMode: false }) as unknown as IncomingMessage;
}

describe('createLocalStorage', () => {
  it('is null when STORAGE_DIR is empty', () => {
    expect(createLocalStorage(readConfig({}))).toBeNull();
  });

  it('refuses path segments that could escape the root', () => {
    const storage = createLocalStorage(readConfig({ STORAGE_DIR: dir }));
    expect(storage).not.toBeNull();
    expect(storage?.pathFor('../etc', 'f-1')).toBeNull();
    expect(storage?.pathFor('ws-1', 'a/b')).toBeNull();
    expect(storage?.open('ws-1', '../../secret')).toBeNull();
  });

  it('writes and reads back the same bytes', async () => {
    const storage = createLocalStorage(readConfig({ STORAGE_DIR: dir }));
    const written = await storage?.write('ws-1', 'f-1', body('hello'));
    expect(written).toEqual({ ok: true, bytes: 5 });
    expect(storage?.keyFor('ws-1', 'f-1')).toBe('ws-1/f-1');
    expect(await readFile(join(dir, 'ws-1', 'f-1'), 'utf8')).toBe('hello');

    const stream = storage?.open('ws-1', 'f-1');
    if (!stream) throw new Error('expected a read stream');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello');
  });

  it('discards a file and tolerates a missing one', async () => {
    const storage = createLocalStorage(readConfig({ STORAGE_DIR: dir }));
    await storage?.write('ws-1', 'f-1', body('x'));
    await storage?.discard('ws-1', 'f-1');
    await storage?.discard('ws-1', 'f-1');
  });
});
