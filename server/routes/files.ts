/// <reference types="node" />
/**
 * Files API (P1-6). Five endpoints, so a `routes/` module is due
 * (`OVERVIEW.md:33`). Order: session → membership → write (D-056).
 *
 * No presigned URL: bytes stream through this process to a local directory.
 * N3 direct upload is deferred until an S3-compatible host exists.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import {
  FILES_PATH,
  FILE_HEADERS,
  decodeFileName,
  fileFailure,
  isFileKind,
  isSafeSegment,
  statusForFile,
  type FileDto,
  type FileErrorKind,
  type FileResultBody,
} from '../../src/lib/files.ts';
import {
  sessionFailure,
  statusForSession,
  type SessionErrorKind,
  type SessionUser,
} from '../../src/lib/session.ts';
import { sendJson } from '../http.ts';
import { files as table } from '../persistence/schema.ts';
import type { ConversationDatabase } from '../persistence/client.ts';
import type { SessionSource } from '../session/source.ts';
import type { LocalStorage } from '../storage/local.ts';

export type FilesRouter = (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
) => void;

type Row = typeof table.$inferSelect;

function result(res: ServerResponse, status: number, body: FileResultBody): void {
  sendJson(res, status, body);
}

function fail(res: ServerResponse, kind: FileErrorKind, message: string): void {
  result(res, statusForFile(kind), fileFailure(kind, message));
}

function authFail(res: ServerResponse, kind: SessionErrorKind, message: string): void {
  sendJson(res, statusForSession(kind), sessionFailure(kind, message));
}

function forbidden(res: ServerResponse): void {
  authFail(res, 'forbidden', 'This workspace is not in your memberships.');
}

function isMember(session: SessionUser, workspaceId: string): boolean {
  return session.workspaceIds.includes(workspaceId);
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function toDto(row: Row): FileDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    folderId: row.folderId,
    name: row.name,
    kind: row.kind,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function makeHandlers(database: ConversationDatabase, storage: LocalStorage) {
  const upload = async (
    req: IncomingMessage,
    res: ServerResponse,
    session: SessionUser,
  ): Promise<void> => {
    const name = decodeFileName(header(req, FILE_HEADERS.name));
    const kind = header(req, FILE_HEADERS.kind);
    const workspaceId = header(req, FILE_HEADERS.workspaceId);
    const folderRaw = header(req, FILE_HEADERS.folderId);
    const folderId = folderRaw === undefined || folderRaw === '' ? null : folderRaw;

    if (!name || !isFileKind(kind) || !isSafeSegment(workspaceId)) {
      fail(res, 'contract', 'Expected x-thylas-file-name, -kind and -workspace headers.');
      return;
    }
    if (folderId !== null && !isSafeSegment(folderId)) {
      fail(res, 'contract', 'The folder id is not a valid path segment.');
      return;
    }
    if (!isMember(session, workspaceId)) {
      forbidden(res);
      return;
    }

    const id = randomUUID();
    const written = await storage.write(workspaceId, id, req);
    if (!written.ok) {
      if (written.reason === 'too_large') {
        fail(res, 'too_large', 'The file is over the 100 MB cap.');
        return;
      }
      fail(res, 'upstream', 'The file could not be written.');
      return;
    }

    try {
      const [row] = await database
        .insert(table)
        .values({
          id,
          workspaceId,
          folderId,
          name,
          kind,
          sizeBytes: written.bytes,
          storageKey: storage.keyFor(workspaceId, id),
        })
        .returning();
      if (!row) {
        await storage.discard(workspaceId, id);
        fail(res, 'upstream', 'The file record was not created.');
        return;
      }
      result(res, 201, { ok: true, item: toDto(row) });
    } catch {
      await storage.discard(workspaceId, id);
      fail(res, 'upstream', 'The file record could not be saved.');
    }
  };

  const list = async (
    req: IncomingMessage,
    res: ServerResponse,
    session: SessionUser,
  ): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const workspaceId = url.searchParams.get('workspaceId');
    if (workspaceId !== null && !isMember(session, workspaceId)) {
      forbidden(res);
      return;
    }
    const allowed = workspaceId === null ? session.workspaceIds : [workspaceId];
    const rows = await database
      .select()
      .from(table)
      .where(and(inArray(table.workspaceId, allowed), isNull(table.deletedAt)))
      .orderBy(asc(table.createdAt));
    result(res, 200, { ok: true, items: rows.map(toDto) });
  };

  const readOne = async (
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<Row | undefined> => {
    const [row] = await database.select().from(table).where(eq(table.id, id));
    if (!row || row.deletedAt !== null) {
      fail(res, 'not_found', `No file with id "${id}".`);
      return undefined;
    }
    if (!isMember(session, row.workspaceId)) {
      forbidden(res);
      return undefined;
    }
    return row;
  };

  const read = async (
    _req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (row) result(res, 200, { ok: true, item: toDto(row) });
  };

  const content = async (
    _req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    const stream = storage.open(row.workspaceId, row.id);
    if (!stream) {
      fail(res, 'upstream', 'The stored file could not be opened.');
      return;
    }
    stream.on('error', () => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      fail(res, 'not_found', 'The stored bytes are missing.');
    });
    res.statusCode = 200;
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-length', row.sizeBytes);
    res.setHeader(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    );
    res.setHeader('cache-control', 'no-store');
    stream.pipe(res);
  };

  const remove = async (
    _req: IncomingMessage,
    res: ServerResponse,
    id: string,
    session: SessionUser,
  ): Promise<void> => {
    const row = await readOne(res, id, session);
    if (!row) return;
    /* Soft delete: the tombstone in Files (SP-04b) expects the row to survive.
       Bytes stay on disk until a cleanup job is actually needed. */
    await database.update(table).set({ deletedAt: new Date() }).where(eq(table.id, id));
    result(res, 200, { ok: true, id });
  };

  return { upload, list, read, content, remove };
}

export function createFilesRouter(
  db: ConversationDatabase | null,
  storage: LocalStorage | null,
  source: SessionSource,
): FilesRouter {
  const handlers = db && storage ? makeHandlers(db, storage) : null;

  return (req, res, path) => {
    const method = (req.method ?? 'GET').toUpperCase();
    const tail = path.slice(FILES_PATH.length).replace(/^\//, '');
    let segments: string[] = [];
    try {
      segments = tail === '' ? [] : tail.split('/').map(decodeURIComponent);
    } catch {
      fail(res, 'contract', 'The file path is not valid URL encoding.');
      return;
    }

    const run = async (): Promise<void> => {
      const session = await source.read(req);
      if (!session) {
        authFail(res, 'unauthorized', 'Sign in to continue.');
        return;
      }
      if (!handlers) {
        fail(res, 'not_configured', 'DATABASE_URL and STORAGE_DIR are needed for files.');
        return;
      }
      if (segments.length === 0) {
        if (method === 'GET') {
          await handlers.list(req, res, session);
          return;
        }
        if (method === 'POST') {
          await handlers.upload(req, res, session);
          return;
        }
      } else if (segments.length === 1) {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The file id is not a valid path segment.');
          return;
        }
        if (method === 'GET') {
          await handlers.read(req, res, id, session);
          return;
        }
        if (method === 'DELETE') {
          await handlers.remove(req, res, id, session);
          return;
        }
      } else if (segments.length === 2 && segments[1] === 'content' && method === 'GET') {
        const id = segments[0] ?? '';
        if (!isSafeSegment(id)) {
          fail(res, 'contract', 'The file id is not a valid path segment.');
          return;
        }
        await handlers.content(req, res, id, session);
        return;
      }
      fail(res, 'contract', `${method} is not allowed on this path.`);
    };

    run().catch(() => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      fail(res, 'upstream', 'The files endpoint failed while answering.');
    });
  };
}
