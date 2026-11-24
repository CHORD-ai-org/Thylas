import { describe, expect, it } from 'vitest';
import {
  COLLABORATION_STATES,
  COLLABORATION_VERBS,
  TRANSITION_TABLE,
  canTransition,
  isTerminal,
  transition,
  type CollaborationState,
  type CollaborationVerb,
} from './collaboration';

describe('C4-1a 协作原语状态机', () => {
  it('C4 gate: the state × verb matrix has zero holes', () => {
    let defined = 0;
    let refused = 0;
    for (const state of COLLABORATION_STATES) {
      for (const verb of COLLABORATION_VERBS) {
        const result = transition(state, verb);
        if (result.ok) {
          defined += 1;
          expect(COLLABORATION_STATES).toContain(result.next);
          expect(canTransition(state, verb)).toBe(true);
        } else {
          refused += 1;
          expect(result.reason.length).toBeGreaterThan(0);
          expect(canTransition(state, verb)).toBe(false);
        }
      }
    }
    /* Every cell answered — no undefined, no throw, no silent no-op. */
    expect(defined + refused).toBe(COLLABORATION_STATES.length * COLLABORATION_VERBS.length);
    /* The table only grows on purpose: this pins the current shape. */
    expect(defined).toBe(25);
  });

  it('the table carries no implicit edges', () => {
    for (const state of COLLABORATION_STATES) {
      for (const [verb, next] of Object.entries(TRANSITION_TABLE[state])) {
        expect(COLLABORATION_VERBS).toContain(verb as CollaborationVerb);
        expect(COLLABORATION_STATES).toContain(next as CollaborationState);
      }
    }
  });

  it('lifecycle spine: proposed → … → completed', () => {
    expect(transition('proposed', 'delegate')).toEqual({ ok: true, next: 'delegated' });
    expect(transition('delegated', 'respond')).toEqual({ ok: true, next: 'responded' });
    expect(transition('responded', 'complete')).toEqual({ ok: true, next: 'completed' });
  });

  it('challenge path requires negotiation before resolution', () => {
    expect(transition('responded', 'challenge')).toEqual({ ok: true, next: 'challenged' });
    expect(transition('challenged', 'complete').ok).toBe(false);
    expect(transition('challenged', 'negotiate')).toEqual({ ok: true, next: 'negotiating' });
    expect(transition('negotiating', 'respond')).toEqual({ ok: true, next: 'responded' });
  });

  it('INPUT_REQUIRED: only the human gate leaves needs_human', () => {
    expect(transition('working', 'request_human')).toEqual({ ok: true, next: 'needs_human' });
    expect(transition('needs_human', 'approve')).toEqual({ ok: true, next: 'working' });
    expect(transition('needs_human', 'reject')).toEqual({ ok: true, next: 'cancelled' });
    for (const verb of COLLABORATION_VERBS) {
      if (verb === 'approve' || verb === 'reject' || verb === 'request_human') continue;
      expect(transition('needs_human', verb).ok).toBe(false);
    }
  });

  it('terminal states refuse everything, with a reason', () => {
    for (const state of ['completed', 'cancelled'] as const) {
      expect(isTerminal(state)).toBe(true);
      for (const verb of COLLABORATION_VERBS) {
        const result = transition(state, verb);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain(state === 'completed' ? '完成' : '取消');
      }
    }
    expect(isTerminal('responded')).toBe(false);
  });
});
