import { describe, expect, it } from 'vitest';
import {
  canCommit,
  commitIntent,
  requiresApproval,
  riskOf,
  validateIntent,
  type MutationIntent,
} from './mutation';

const base: MutationIntent = {
  intentId: 'i-1',
  actor: { kind: 'agent', id: 'a-1' },
  op: 'update',
  target: { kind: 'artifact', id: 'art-1' },
  before: { name: 'old' },
  after: { name: 'new' },
  provenance: { sources: ['diary'], evidence: ['span'] },
  risk: 'medium',
  requiresApproval: true,
  status: 'proposed',
};

describe('risk & approval', () => {
  it('maps operations to risk and never calls delete low', () => {
    expect(riskOf('delete')).toBe('high');
    expect(riskOf('create')).toBe('medium');
    expect(riskOf('relate')).toBe('low');
    expect(riskOf('archive')).toBe('low');
  });

  it('requires approval for medium/high, not for low (undo instead)', () => {
    expect(requiresApproval('low')).toBe(false);
    expect(requiresApproval('medium')).toBe(true);
    expect(requiresApproval('high')).toBe(true);
  });
});

describe('execution permission ≠ commit authority', () => {
  it('an agent cannot commit by default; a user can', () => {
    expect(canCommit({ kind: 'agent', id: 'a' })).toBe(false);
    expect(canCommit({ kind: 'coworker', id: 'c' })).toBe(false);
    expect(canCommit({ kind: 'user', id: 'u' })).toBe(true);
    expect(canCommit({ kind: 'agent', id: 'a' }, true)).toBe(true); // explicit grant
  });

  it('refuses an unapproved commit even for a user', () => {
    const res = commitIntent(base, { kind: 'user', id: 'u' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('not approved');
  });

  it('commits an approved intent with authority and records the transition', () => {
    const approved: MutationIntent = { ...base, status: 'approved' };
    const res = commitIntent(approved, { kind: 'user', id: 'u' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.next.status).toBe('committed');
      expect(typeof res.next.committedAt).toBe('number');
    }
  });

  it('refuses an agent commit and a double commit', () => {
    const approved: MutationIntent = { ...base, status: 'approved' };
    expect(commitIntent(approved, { kind: 'agent', id: 'a' }).ok).toBe(false);
    const committed = { ...approved, status: 'committed' as const };
    const res = commitIntent(committed, { kind: 'user', id: 'u' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('already committed');
  });
});

describe('validation', () => {
  it('rejects a mutation without a target, an illegal before on create, and a mislabelled delete', () => {
    expect(validateIntent({ ...base, target: undefined })).toEqual({ ok: false, reason: 'update needs a target id' });
    expect(validateIntent({ ...base, op: 'create', before: { x: 1 } })).toEqual({
      ok: false,
      reason: 'create has no before',
    });
    expect(validateIntent({ ...base, op: 'delete', risk: 'low' })).toEqual({
      ok: false,
      reason: 'a delete is always high risk',
    });
  });

  it('accepts a well-formed intent', () => {
    expect(validateIntent(base)).toEqual({ ok: true });
  });
});
