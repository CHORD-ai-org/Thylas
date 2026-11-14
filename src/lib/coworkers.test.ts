import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIND_FRAMEWORK,
  MIND_MAX_ITEMS,
  MIND_MAX_TEXT,
  defaultMindFramework,
  isMindFramework,
  mindFrameworkOf,
  mindFrameworkRows,
} from './coworkers';

/** The contract is a declared config record. Bad envelopes lose the framework,
    never the Coworker. These are the ways a hand-edited payload breaks. */
describe('Mind Framework contract', () => {
  it('ships a valid default and gives each Coworker its own arrays', () => {
    expect(isMindFramework(DEFAULT_MIND_FRAMEWORK)).toBe(true);
    const a = defaultMindFramework();
    const b = defaultMindFramework();
    a.principles.push('changed');
    expect(b.principles).toEqual(DEFAULT_MIND_FRAMEWORK.principles);
    expect(a).not.toBe(b);
  });

  it('rejects a non-object, a wrong version and missing dimensions', () => {
    expect(isMindFramework(null)).toBe(false);
    expect(isMindFramework('text')).toBe(false);
    expect(isMindFramework({ ...DEFAULT_MIND_FRAMEWORK, version: 2 })).toBe(false);
    const withoutReflection: Record<string, unknown> = { ...DEFAULT_MIND_FRAMEWORK };
    delete withoutReflection.reflection;
    expect(isMindFramework(withoutReflection)).toBe(false);
  });

  it('rejects malformed lists and overlong text', () => {
    expect(isMindFramework({ ...DEFAULT_MIND_FRAMEWORK, principles: ['ok', 7] })).toBe(false);
    expect(isMindFramework({ ...DEFAULT_MIND_FRAMEWORK, principles: ['   '] })).toBe(false);
    expect(
      isMindFramework({
        ...DEFAULT_MIND_FRAMEWORK,
        decisionRules: Array.from({ length: MIND_MAX_ITEMS + 1 }, () => 'ask'),
      }),
    ).toBe(false);
    expect(
      isMindFramework({ ...DEFAULT_MIND_FRAMEWORK, contextPolicy: 'x'.repeat(MIND_MAX_TEXT + 1) }),
    ).toBe(false);
    expect(isMindFramework({ ...DEFAULT_MIND_FRAMEWORK, uncertaintyPolicy: 4 })).toBe(false);
  });

  it('returns undefined for a bad framework instead of throwing', () => {
    expect(mindFrameworkOf({ version: 1 })).toBeUndefined();
    expect(mindFrameworkOf(DEFAULT_MIND_FRAMEWORK)).toEqual(DEFAULT_MIND_FRAMEWORK);
  });

  it('renders six labelled rows with lists joined', () => {
    const rows = mindFrameworkRows(DEFAULT_MIND_FRAMEWORK);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({
      label: 'Reasoning principles',
      value: DEFAULT_MIND_FRAMEWORK.principles.join(' · '),
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Reasoning principles',
      'Context policy',
      'Uncertainty policy',
      'Decision rules',
      'Reflection',
      'Method selection',
    ]);
    expect(rows.every((r) => r.value.length > 0)).toBe(true);
  });
});
