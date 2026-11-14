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
