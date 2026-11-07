import { describe, expect, it } from 'vitest';
import {
  STATE_LABEL,
  STATE_TONE,
  getProcess,
  needsInput,
  pendingLede,
  processesIn,
  getWorkspace,
  filesInFolder,
} from './selectors';
import type { RunState } from './types';

/* Selectors are the contract between the sample model and the surfaces. These
   tests are cheap and catch the two ways that contract breaks: a state that has
   no label/tone, and a workspace whose counts disagree with its content. */
const STATES: RunState[] = ['queued', 'running', 'needs_input', 'succeeded', 'failed', 'stopped'];

describe('run state vocabulary', () => {
  it('names every state exactly once, with a tone', () => {
    for (const state of STATES) {
      expect(STATE_LABEL[state]).toBeTruthy();
      expect(STATE_TONE[state]).toMatch(/^(live|warn|ok|error|idle)$/);
    }
    const names = new Set(STATES.map((s) => STATE_LABEL[s]));
    expect(names.size).toBe(STATES.length);
  });

  it('uses "needs you" for needs_input, not the enum value', () => {
    expect(STATE_LABEL.needs_input).toBe('needs you');
  });
});

describe('the computed Overview lede (SP-02)', () => {
  it('singular, plural and zero are all distinct and grammatical', () => {
    expect(pendingLede(1)).toContain('1 process needs a decision');
    expect(pendingLede(2)).toContain('2 processes need a decision');
    expect(pendingLede(0)).toContain('Nothing needs you right now');
    expect(pendingLede(0)).not.toContain('0 process');
  });

  it('changes when the model changes', () => {
    expect(pendingLede(0)).not.toBe(pendingLede(1));
  });
});

describe('sample model consistency', () => {
  it('gives every process a workspace that exists', () => {
    for (const ws of ['ws-research', 'ws-onda']) {
      expect(getWorkspace(ws)).toBeTruthy();
      for (const run of processesIn(ws)) expect(run.wsId).toBe(ws);
    }
  });

  it('declares counts that match the files it actually holds', () => {
    const ws = getWorkspace('ws-research');
    expect(ws?.counts.files).toBe(
      filesInFolder('ws-research', 'fd-datasets').length +
        filesInFolder('ws-research', 'fd-normalized').length +
        filesInFolder('ws-research', 'fd-papers').length,
    );
  });

  it('resolves a run by id and returns undefined for a stranger', () => {
    expect(getProcess('run-baseline')?.name).toBe('baseline-sweep');
    expect(getProcess('run-nope')).toBeUndefined();
  });

  it('collects needs_input across workspaces, and nothing else', () => {
    const pending = needsInput();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((p) => p.state === 'needs_input')).toBe(true);
    expect(new Set(pending.map((p) => p.wsId)).size).toBeGreaterThan(1);
    // The lede and the section count read the same list, so a run cannot be
    // announced without a row or shown without a count.
    expect(pending.length).toBe(
      ['ws-research', 'ws-onda'].flatMap((ws) => processesIn(ws)).filter((p) => p.state === 'needs_input').length,
    );
  });
});
