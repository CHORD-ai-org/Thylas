/**
 * C4-1a 协作原语状态机 (Coworker plan §27): typed state + an explicit
 * transition table — LangGraph semantics borrowed, dependencies not (§23).
 * Every (state × verb) cell is either a defined transition or an explicit
 * refusal; there are no implicit edges and no silent no-ops.
 *
 * Verb ↔ A2A mapping (§18): request_human = INPUT_REQUIRED, approve/reject =
 * the AUTH_REQUIRED gate, handoff = task transfer, complete = terminal.
 *
 * Pure and I/O-free on purpose: persistence and journaling (先落库后执行)
 * arrive in C4-1b, the coordinator in C4-2.
 */

export const COLLABORATION_STATES = [
  'proposed',
  'delegated',
  'working',
  'responded',
  'challenged',
  'negotiating',
  'needs_human',
  'completed',
  'cancelled',
] as const;
export type CollaborationState = (typeof COLLABORATION_STATES)[number];

export const COLLABORATION_VERBS = [
  'delegate',
  'respond',
  'challenge',
  'negotiate',
  'handoff',
  'request_human',
  'approve',
  'reject',
  'complete',
] as const;
export type CollaborationVerb = (typeof COLLABORATION_VERBS)[number];

export type TransitionResult =
  | { ok: true; next: CollaborationState }
  | { ok: false; reason: string };

/**
 * The whole machine. A verb absent from a state's row is refused with the
 * machine's own words — the refusal is data, not an accident.
 */
export const TRANSITION_TABLE: Record<
  CollaborationState,
  Partial<Record<CollaborationVerb, CollaborationState>>
> = {
  proposed: {
    delegate: 'delegated',
    request_human: 'needs_human',
  },
  delegated: {
    respond: 'responded',
    handoff: 'delegated',
    request_human: 'needs_human',
  },
  working: {
    respond: 'responded',
    delegate: 'delegated',
    handoff: 'delegated',
    request_human: 'needs_human',
  },
  responded: {
    respond: 'responded',
    challenge: 'challenged',
    handoff: 'delegated',
    complete: 'completed',
    request_human: 'needs_human',
  },
  challenged: {
    negotiate: 'negotiating',
    respond: 'responded',
    handoff: 'delegated',
    request_human: 'needs_human',
  },
  negotiating: {
    negotiate: 'negotiating',
    respond: 'responded',
    handoff: 'delegated',
    request_human: 'needs_human',
  },
  needs_human: {
    approve: 'working',
    reject: 'cancelled',
    request_human: 'needs_human',
  },
  /* Terminal states refuse everything — that is their meaning. */
  completed: {},
  cancelled: {},
};

export function isTerminal(state: CollaborationState): boolean {
  return state === 'completed' || state === 'cancelled';
}

export function isCollaborationVerb(value: unknown): value is CollaborationVerb {
  return typeof value === 'string' && (COLLABORATION_VERBS as readonly string[]).includes(value);
}

export function canTransition(state: CollaborationState, verb: CollaborationVerb): boolean {
  return TRANSITION_TABLE[state][verb] !== undefined;
}

export function transition(
  state: CollaborationState,
  verb: CollaborationVerb,
): TransitionResult {
  const next = TRANSITION_TABLE[state][verb];
  if (next === undefined) {
    const why = isTerminal(state)
      ? `场次已${state === 'completed' ? '完成' : '取消'}，不接受 ${verb}`
      : `${state} 不接受 ${verb}`;
    return { ok: false, reason: why };
  }
  return { ok: true, next };
}
