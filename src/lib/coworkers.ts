/**
 * Wire shape for a Coworker's Mind Framework (Phase 2, D-060).
 *
 * This is a **declared configuration record**, not an executable mind: Thylas
 * stores it, validates it and shows it; the runtime that would apply it is not
 * connected. `DESIGN.md` §10 Q-D stays open — nothing here claims to make a
 * Coworker reason differently.
 *
 * Kept in `src/lib/` so a future server route imports the same shapes (D-006).
 * No API path is declared: this round adds no endpoint.
 */
export const MIND_FRAMEWORK_VERSION = 1;
export const MIND_MAX_ITEMS = 12;
export const MIND_MAX_TEXT = 300;

export type MindFramework = {
  version: number;
  /** How this Coworker reasons about a task. */
  principles: string[];
  /** How its working context is organized — declared sources, never ambient. */
  contextPolicy: string;
  /** What it does when evidence is missing or conflicting. */
  uncertaintyPolicy: string;
  /** When to decide, when to ask a human. */
  decisionRules: string[];
  /** How its own work is evaluated. */
  reflection: string;
  /** How a methodology is selected for a task. */
  methodSelection: string;
};

export const DEFAULT_MIND_FRAMEWORK: MindFramework = {
  version: MIND_FRAMEWORK_VERSION,
  principles: ['State the objective before proposing work.', 'Cite the source for every claim.'],
  contextPolicy: 'Use only declared context: pinned artifacts and task references.',
  uncertaintyPolicy: 'Name what is missing and ask for it instead of guessing.',
  decisionRules: ['Ask a human before a consequential change.'],
  reflection: 'Check the result against the stated objective and name what was not covered.',
  methodSelection: 'Prefer a pinned methodology whose output kind matches the task.',
};

/** A fresh object with fresh arrays — no shared mutable state between Coworkers. */
export function defaultMindFramework(): MindFramework {
  return {
    ...DEFAULT_MIND_FRAMEWORK,
    principles: [...DEFAULT_MIND_FRAMEWORK.principles],
    decisionRules: [...DEFAULT_MIND_FRAMEWORK.decisionRules],
  };
}

function isTextList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MIND_MAX_ITEMS &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= MIND_MAX_TEXT)
  );
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MIND_MAX_TEXT;
}

/** Validated read: a hand-edited envelope loses the bad framework, not the record. */
export function isMindFramework(value: unknown): value is MindFramework {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Partial<MindFramework>;
  return (
    f.version === MIND_FRAMEWORK_VERSION &&
    isTextList(f.principles) &&
    isText(f.contextPolicy) &&
    isText(f.uncertaintyPolicy) &&
    isTextList(f.decisionRules) &&
    isText(f.reflection) &&
    isText(f.methodSelection)
  );
}

export function mindFrameworkOf(value: unknown): MindFramework | undefined {
  return isMindFramework(value) ? value : undefined;
}

export type MindRow = { label: string; value: string };

/** One row per dimension, in the order the config page renders them. */
export function mindFrameworkRows(framework: MindFramework): MindRow[] {
  return [
    { label: 'Reasoning principles', value: framework.principles.join(' · ') },
    { label: 'Context policy', value: framework.contextPolicy },
    { label: 'Uncertainty policy', value: framework.uncertaintyPolicy },
    { label: 'Decision rules', value: framework.decisionRules.join(' · ') },
    { label: 'Reflection', value: framework.reflection },
    { label: 'Method selection', value: framework.methodSelection },
  ];
}

/* --------------------------------------------------------------------------
 * C0: the coworkers wire contract (server route imports these shapes — D-006).
 * The record mirrors the prototype's `Coworker`; `ownerId` is the tenant key
 * (cloud-readiness), events are the append-only trace.
 * -------------------------------------------------------------------------- */

export const COWORKERS_PATH = '/api/coworkers';

export const COWORKER_STATUSES = ['active', 'paused', 'archived'] as const;
export type CoworkerStatusValue = (typeof COWORKER_STATUSES)[number];

export type CoworkerResponsibilities = { forWork: string; notFor: string; output: string };
export type CoworkerMembership = { wsId: string; role: string };

export type CoworkerDto = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  status: CoworkerStatusValue;
  responsibilities: CoworkerResponsibilities;
  memberships: CoworkerMembership[];
  pinnedArtifactIds: string[];
  mindFramework: MindFramework | null;
  createdAt: number;
  updatedAt: string;
  deletedAt: string | null;
};

export type CoworkerEventDto = {
  id: string;
  coworkerId: string;
  projectId: string | null;
  actorKind: string;
  verb: string;
  payload: unknown;
  createdAt: string;
};

export type CoworkerErrorKind = 'contract' | 'conflict' | 'not_found' | 'not_configured' | 'upstream';

export type CoworkerErr = {
  ok: false;
  kind: CoworkerErrorKind;
  message: string;
  retryable: boolean;
};

export type CoworkerListBody = { ok: true; items: CoworkerDto[] };
export type CoworkerBody = { ok: true; item: CoworkerDto };
export type CoworkerDeleteBody = { ok: true; id: string };
export type CoworkerEventListBody = { ok: true; items: CoworkerEventDto[] };
export type CoworkerEventBody = { ok: true; item: CoworkerEventDto };

export type CreateCoworkerBody = {
  id?: string;
  name: string;
  description?: string;
  responsibilities?: CoworkerResponsibilities;
  memberships?: CoworkerMembership[];
  mindFramework?: MindFramework;
};
export type PatchCoworkerBody = {
  name?: string;
  description?: string;
  status?: CoworkerStatusValue;
  responsibilities?: CoworkerResponsibilities;
  memberships?: CoworkerMembership[];
  pinnedArtifactIds?: string[];
  mindFramework?: MindFramework;
};
export type CreateEventBody = {
  verb: string;
  projectId?: string;
  actorKind?: string;
  payload?: unknown;
};

export type CoworkerEmploymentDto = {
  coworkerId: string;
  wsId: string;
  role: string;
  grants: string[];
  employedAt: string;
};
export type EmploymentListBody = { ok: true; items: CoworkerEmploymentDto[] };
export type EmploymentBody = { ok: true; item: CoworkerEmploymentDto };
export type EmploymentDeleteBody = { ok: true; wsId: string };
export type UpsertEmploymentBody = { role?: string; grants?: string[] };

export type CoworkerResultBody =
  | CoworkerListBody
  | CoworkerBody
  | CoworkerDeleteBody
  | CoworkerEventListBody
  | CoworkerEventBody
  | EmploymentListBody
  | EmploymentBody
  | EmploymentDeleteBody
  | CoworkerErr;

/** 三层交集红线：有效授权 = 自身配置 ∩ Workspace 给予 ∩ Project 子集。 */
export function effectiveGrants(
  selfToolsets: string[],
  workspaceGrants: string[],
  projectSubset?: string[],
): string[] {
  const base = selfToolsets.filter((t) => workspaceGrants.includes(t));
  return projectSubset === undefined ? base : base.filter((t) => projectSubset.includes(t));
}

const RETRYABLE: Record<CoworkerErrorKind, boolean> = {
  contract: false,
  conflict: false,
  not_found: false,
  not_configured: false,
  upstream: true,
};

export function coworkerFailure(
  kind: CoworkerErrorKind,
  message: string,
  retryable = RETRYABLE[kind],
): CoworkerErr {
  return { ok: false, kind, message, retryable };
}

export function statusForCoworker(kind: CoworkerErrorKind): number {
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

export const COWORKER_NAME_MAX = 60;
export const COWORKER_DESCRIPTION_MAX = 200;
export const COWORKER_EVENT_VERB_MAX = 64;

export function cleanCoworkerName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= COWORKER_NAME_MAX ? name : null;
}

export function isCoworkerStatusValue(value: unknown): value is CoworkerStatusValue {
  return typeof value === 'string' && (COWORKER_STATUSES as readonly string[]).includes(value);
}

export function isResponsibilitiesShape(value: unknown): value is CoworkerResponsibilities {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<CoworkerResponsibilities>;
  return typeof r.forWork === 'string' && typeof r.notFor === 'string' && typeof r.output === 'string';
}

export function isMembershipList(value: unknown): value is CoworkerMembership[] {
  return (
    Array.isArray(value) &&
    value.every(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as CoworkerMembership).wsId === 'string' &&
        typeof (m as CoworkerMembership).role === 'string',
    )
  );
}
