import { describe, expect, it } from 'vitest';
import {
  STATE_LABEL,
  STATE_TONE,
  getProcess,
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
});
