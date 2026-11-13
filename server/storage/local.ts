/// <reference types="node" />
/**
 * Local byte store (P1-6). The only module that touches the filesystem for
 * uploads. A future S3 client replaces this one behind the same calls.
 *
 * No presigned URL here: N3 direct upload is deferred until an S3-compatible
 * host exists (`P1-6.md` §1). Storage is flat — `<root>/<wsId>/<fileId>`.
 */
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { join, resolve } from 'node:path';
import { FILE_MAX_BYTES, isSafeSegment } from '../../src/lib/files.ts';
import type { ServerConfig } from '../config.ts';
import { pipeBodyToFile, type UploadResult } from '../http.ts';

export type LocalStorage = {
  keyFor: (wsId: string, fileId: string) => string;
  pathFor: (wsId: string, fileId: string) => string | null;
  write: (wsId: string, fileId: string, req: IncomingMessage) => Promise<UploadResult>;
  open: (wsId: string, fileId: string) => ReadStream | null;
  discard: (wsId: string, fileId: string) => Promise<void>;
};

export function createLocalStorage(config: ServerConfig): LocalStorage | null {
  if (config.storageDir === '') return null;
  const root = resolve(config.storageDir);

  return {
    keyFor: (wsId, fileId) => `${wsId}/${fileId}`,
    pathFor: (wsId, fileId) => {
      if (!isSafeSegment(wsId) || !isSafeSegment(fileId)) return null;
      return join(root, wsId, fileId);
    },
    write: async (wsId, fileId, req) => {
      if (!isSafeSegment(wsId) || !isSafeSegment(fileId)) {
        return { ok: false, reason: 'io' };
      }
      await mkdir(join(root, wsId), { recursive: true });
      return pipeBodyToFile(req, join(root, wsId, fileId), FILE_MAX_BYTES);
    },
    open: (wsId, fileId) => {
      if (!isSafeSegment(wsId) || !isSafeSegment(fileId)) return null;
      return createReadStream(join(root, wsId, fileId));
    },
    discard: async (wsId, fileId) => {
      if (!isSafeSegment(wsId) || !isSafeSegment(fileId)) return;
      await unlink(join(root, wsId, fileId)).catch(() => {});
    },
  };
}
