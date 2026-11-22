/**
 * Mutation intent — the one record behind every agent-side write to user-owned
 * information (home-interaction 06 §2). Pure: types + rules, no store, no DOM.
 *
 * The central ruling it encodes: **execution permission ≠ commit authority**.
 * An actor may be allowed to run an operation (read sources, compute a
 * proposal) without being allowed to make the result persistent. Agents hold no
 * commit authority by default; a commit is a user act (or an explicit grant).
 */

export type MutationOp = 'create' | 'update' | 'organize' | 'relate' | 'archive' | 'delete';

export type MutationRisk = 'low' | 'medium' | 'high';

export type Actor = { kind: 'user' | 'agent' | 'coworker'; id: string };

export type MutationStatus = 'proposed' | 'approved' | 'rejected' | 'committed' | 'undone';

export type MutationIntent = {
  intentId: string;
  actor: Actor;
  op: MutationOp;
  /** Absent for `create`. */
  target?: { kind: string; id?: string };
  before?: unknown;
  after: unknown;
  provenance: { sources: string[]; evidence: string[]; reasoning?: string };
  risk: MutationRisk;
  requiresApproval: boolean;
  status: MutationStatus;
  committedAt?: number;
  historyRef?: string;
};

/** Risk by operation, before target-specific escalation. Delete is never low. */
export function riskOf(op: MutationOp): MutationRisk {
  if (op === 'delete') return 'high';
  if (op === 'archive' || op === 'relate' || op === 'organize') return 'low';
  return 'medium';
}

/**
 * Approval is required by risk and irreversibility (06 §5), not for everything:
 * low-risk reversible acts lean on undo instead of a prompt.
 */
export function requiresApproval(risk: MutationRisk): boolean {
  return risk !== 'low';
}

/** Commit authority: may this actor make the result persistent? Agents never
    hold it by default (06 §3) unless explicitly granted. */
export function canCommit(actor: Actor, granted = false): boolean {
  return actor.kind === 'user' || granted;
}

export type Validation = { ok: true } | { ok: false; reason: string };

export function validateIntent(intent: MutationIntent): Validation {
  if (!intent.intentId) return { ok: false, reason: 'intentId is required' };
  if (intent.op !== 'create' && !intent.target?.id) return { ok: false, reason: `${intent.op} needs a target id` };
  if (intent.op === 'create' && (intent.before !== undefined)) return { ok: false, reason: 'create has no before' };
  if (!Array.isArray(intent.provenance?.sources)) return { ok: false, reason: 'provenance.sources is required' };
  if (riskOf(intent.op) === 'high' && intent.risk !== 'high')
    return { ok: false, reason: 'a delete is always high risk' };
  return { ok: true };
}

/** A commit is a state transition that needs authority and (for medium/high)
    prior approval. Returns the next state or the reason it is refused. */
export function commitIntent(
  intent: MutationIntent,
  by: Actor,
  granted = false,
): { ok: true; next: MutationIntent } | { ok: false; reason: string } {
  if (!canCommit(by, granted)) return { ok: false, reason: 'no commit authority' };
  if (intent.status === 'committed') return { ok: false, reason: 'already committed' };
  if (intent.requiresApproval && intent.status !== 'approved') return { ok: false, reason: 'not approved' };
  return {
    ok: true,
    next: { ...intent, status: 'committed', committedAt: Date.now() },
  };
}
