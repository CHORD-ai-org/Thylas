import { describe, expect, it } from 'vitest';
import { PROCESSES } from './mock';
import {
  FILTER_EMPTY,
  RUN_FILTERS,
  actionOutcome,
  countFor,
  matchesFilter,
  nextSimulated,
  parseFilter,
} from './runs';
import type { Process, RunState } from './types';

const stateOf = (run: Process): RunState => run.state;
const sample = PROCESSES.filter((p) => p.wsId === 'ws-research');

describe('parseFilter', () => {
  it.each([
    ['running', 'running'],
    ['needs_input', 'needs_input'],
    ['done', 'done'],
    ['all', 'all'],
  ])('accepts %s', (raw, expected) => {
    expect(parseFilter(raw)).toBe(expected);
  });

  it.each(['', 'RUNNING', 'nonsense', 'succeeded'])('falls back to all for %s', (raw) => {
    expect(parseFilter(raw)).toBe('all');
  });

  it('has an id that survives a round trip through filterHref', () => {
    for (const f of RUN_FILTERS) {
      const raw = f.id === 'all' ? null : f.id;
      expect(parseFilter(raw)).toBe(f.id);
    }
  });
});

describe('matchesFilter', () => {
  it('puts queued in running: a queued run has not finished', () => {
    expect(matchesFilter('running', 'queued')).toBe(true);
    expect(matchesFilter('running', 'running')).toBe(true);
    expect(matchesFilter('running', 'needs_input')).toBe(false);
  });

  it('puts stopped and failed in done, because both are over', () => {
    expect(matchesFilter('done', 'succeeded')).toBe(true);
    expect(matchesFilter('done', 'failed')).toBe(true);
    expect(matchesFilter('done', 'stopped')).toBe(true);
    expect(matchesFilter('done', 'running')).toBe(false);
  });

  it('counts partition the sample: three filters cover every run once', () => {
    const total = sample.length;
    const sum =
      countFor('running', sample, stateOf) +
      countFor('needs_input', sample, stateOf) +
      countFor('done', sample, stateOf);
    expect(sum).toBe(total);
    expect(countFor('all', sample, stateOf)).toBe(total);
  });
});

describe('nextSimulated', () => {
  it('walks queued → running → needs you → done', () => {
    expect(nextSimulated('queued')).toBe('running');
    expect(nextSimulated('running')).toBe('needs_input');
    expect(nextSimulated('needs_input')).toBe('succeeded');
  });

  it('stops at the end instead of inventing a next state', () => {
    expect(nextSimulated('succeeded')).toBeNull();
    expect(nextSimulated('failed')).toBeNull();
    expect(nextSimulated('stopped')).toBeNull();
  });
});

describe('actionOutcome', () => {
  it('gives every capability a visible result', () => {
    expect(actionOutcome('stop')).toBe('stopped');
    expect(actionOutcome('answer')).toBe('running');
    expect(actionOutcome('approve')).toBe('succeeded');
    expect(actionOutcome('rerun')).toBe('queued');
    expect(actionOutcome('resume')).toBe('running');
  });

  it('sends pause back to the queue, the closest thing to paused here', () => {
    expect(actionOutcome('pause')).toBe('queued');
  });
});

describe('FILTER_EMPTY', () => {
  it('names every filter, so an empty view can say which one is empty', () => {
    for (const f of RUN_FILTERS) {
      expect(FILTER_EMPTY[f.id]).toMatch(/No |has no/);
    }
  });
});
