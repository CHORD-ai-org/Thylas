/**
 * Wire contract for the projects surface (P0-1, P0-3). Imported by the server
 * route and by the client — a field change is a compile error on the other side
 * (D-006). Mirrors the files contract shape (`src/lib/files.ts`).
 *
 * Projects own identity; connections only reference resources (引用不复制).
 * A broken locator never breaks the project card — H1 is enforced here: the
 * project row is independent of any connection's health.
 */
export const PROJECTS_PATH = '/api/projects';

export const PROJECT_STATES = ['active', 'archived', 'deleted'] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export const CONNECTION_KINDS = [
  'local-folder',
  'github-repo',
  'file',
  'note',
  'artifact',
  'gsc-context',
] as const;
export type ConnectionKind = (typeof CONNECTION_KINDS)[number];

export type ConnectionHealth = 'unknown' | 'ok' | 'broken';

export type ProjectDto = {
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  state: ProjectState;
  createdAt: string;
  updatedAt: string;
};

export type ProjectConnectionDto = {
  id: string;
  projectId: string;
  kind: ConnectionKind;
  locator: string;
  label: string;
  health: ConnectionHealth;
  createdAt: string;
  updatedAt: string;
};

export type ProjectErrorKind =
  | 'contract'
  | 'conflict'
  | 'not_found'
  | 'not_configured'
  | 'upstream';

export type ProjectErr = {
  ok: false;
  kind: ProjectErrorKind;
  message: string;
  retryable: boolean;
};

export type ProjectListBody = { ok: true; items: ProjectDto[] };
export type ProjectBody = { ok: true; item: ProjectDto };
export type ProjectDeleteBody = { ok: true; id: string };
export type ConnectionListBody = { ok: true; items: ProjectConnectionDto[] };
export type ConnectionBody = { ok: true; item: ProjectConnectionDto };
export type ConnectionDeleteBody = { ok: true; id: string };

export type CreateProjectBody = { workspaceId: string; name: string; summary?: string };
export type PatchProjectBody = {
  name?: string;
  summary?: string;
  state?: Extract<ProjectState, 'active' | 'archived'>;
};
export type CreateConnectionBody = { kind: ConnectionKind; locator: string; label?: string };
export type PatchConnectionBody = { locator?: string; label?: string };

export type ProjectResultBody =
  | ProjectListBody
  | ProjectBody
  | ProjectDeleteBody
  | ConnectionListBody
  | ConnectionBody
  | ConnectionDeleteBody
  | ProjectErr;

const RETRYABLE: Record<ProjectErrorKind, boolean> = {
  contract: false,
  conflict: false,
  not_found: false,
  not_configured: false,
  upstream: true,
};

export function projectFailure(
  kind: ProjectErrorKind,
  message: string,
  retryable = RETRYABLE[kind],
): ProjectErr {
  return { ok: false, kind, message, retryable };
}

export function statusForProject(kind: ProjectErrorKind): number {
  switch (kind) {
    case 'contract':
      return 400;
    case 'conflict':
      return 409;
    case 'not_found':
      return 404;
    case 'not_configured':
      return 503;
    default:
      return 502;
  }
}

export function isProjectState(value: unknown): value is ProjectState {
  return typeof value === 'string' && (PROJECT_STATES as readonly string[]).includes(value);
}

export function isConnectionKind(value: unknown): value is ConnectionKind {
  return typeof value === 'string' && (CONNECTION_KINDS as readonly string[]).includes(value);
}

export const PROJECT_NAME_MAX = 255;
export const PROJECT_SUMMARY_MAX = 2000;
export const CONNECTION_LOCATOR_MAX = 2048;

export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= PROJECT_NAME_MAX ? name : null;
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  return value.length <= max ? value : null;
}

export function cleanLocator(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const locator = value.trim();
  return locator.length > 0 && locator.length <= CONNECTION_LOCATOR_MAX ? locator : null;
}
