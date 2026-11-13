/**
 * Wire contract for the files surface (P1-6). Imported by the server route and
 * by the client — a field change is a compile error on the other side (D-006).
 *
 * Uploads are a raw body plus metadata headers; no multipart parser is needed.
 */
export const FILES_PATH = '/api/files';
export const FILE_MAX_BYTES = 100 * 1024 * 1024;

export const FILE_HEADERS = {
  name: 'x-thylas-file-name',
  kind: 'x-thylas-file-kind',
  workspaceId: 'x-thylas-file-workspace',
  folderId: 'x-thylas-file-folder',
} as const;

/** Mirrors `FileKind` in `src/lib/types.ts`; kept here so the server need not import it. */
export const FILE_KINDS = ['pdf', 'csv', 'md', 'parquet', 'json', 'png', 'txt'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export type FileDto = {
  id: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  kind: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type FileErrorKind =
  | 'contract'
  | 'not_found'
  | 'not_configured'
  | 'too_large'
  | 'upstream';

export type FileErr = {
  ok: false;
  kind: FileErrorKind;
  message: string;
  retryable: boolean;
};

export type FileListBody = { ok: true; items: FileDto[] };
export type FileBody = { ok: true; item: FileDto };
export type FileDeleteBody = { ok: true; id: string };
export type FileResultBody = FileListBody | FileBody | FileDeleteBody | FileErr;

/** Only an upstream/storage failure can plausibly end differently on retry. */
const RETRYABLE: Record<FileErrorKind, boolean> = {
  contract: false,
  not_found: false,
  not_configured: false,
  too_large: false,
  upstream: true,
};

export function fileFailure(
  kind: FileErrorKind,
  message: string,
  retryable = RETRYABLE[kind],
): FileErr {
  return { ok: false, kind, message, retryable };
}

export function statusForFile(kind: FileErrorKind): number {
  switch (kind) {
    case 'contract':
      return 400;
    case 'not_found':
      return 404;
    case 'too_large':
      return 413;
    case 'not_configured':
      return 503;
    default:
      return 502;
  }
}

/** Workspace ids, file ids and folder ids are path segments, never paths. */
export function isSafeSegment(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function isFileKind(value: unknown): value is FileKind {
  return typeof value === 'string' && (FILE_KINDS as readonly string[]).includes(value);
}

/** Header values are URL-encoded because HTTP headers cannot carry Unicode. */
export function decodeFileName(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const name = decodeURIComponent(raw).trim();
    return name.length > 0 && name.length <= 255 ? name : null;
  } catch {
    return null;
  }
}
