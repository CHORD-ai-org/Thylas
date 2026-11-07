import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from './history';
import type { BoardScene, SceneCard } from './scene';

function card(id: string, x = 0, y = 0): SceneCard {
  return { id, sectionId: 's-1', x, y, w: 200, h: 96, title: id, eyebrow: 'CARD', lines: [], color: 'plain' };
}

function scene(cards: SceneCard[]): BoardScene {
  return { version: 2, id: 'b-1', name: 'Board', updated: 'now', sections: [], cards, edges: [] };
}

const base = scene([card('a'), card('b')]);

describe('snapshot history', () => {
  it('starts empty and reports what can be done', () => {
    expect(canUndo(emptyHistory)).toBe(false);
    expect(canRedo(emptyHistory)).toBe(false);
    expect(undoHistory(emptyHistory, base)).toBeNull();
    expect(redoHistory(emptyHistory, base)).toBeNull();
  });

  it('undoes to the state before the edit and keeps the label', () => {
    const edited = scene([card('a'), card('b', 40, 20)]);
    const history = pushHistory(emptyHistory, base, 'Moved a card');
    const result = undoHistory(history, edited);
    expect(result?.scene).toEqual(base);
    expect(result?.label).toBe('Moved a card');
    expect(canUndo(result!.history)).toBe(false);
    expect(canRedo(result!.history)).toBe(true);
  });

  it('redoes the state the undo left behind', () => {
    const edited = scene([card('a'), card('b', 40, 20)]);
    const undone = undoHistory(pushHistory(emptyHistory, base, 'Moved a card'), edited)!;
    const redone = redoHistory(undone.history, undone.scene)!;
    expect(redone.scene).toEqual(edited);
    expect(canRedo(redone.history)).toBe(false);
    expect(canUndo(redone.history)).toBe(true);
  });

  it('walks three edits backwards and forwards in order', () => {
    const s1 = scene([card('a')]);
    const s2 = scene([card('a'), card('b')]);
    const s3 = scene([card('a'), card('b'), card('c')]);

    let history = pushHistory(emptyHistory, base, 'one');
    history = pushHistory(history, s1, 'two');
    history = pushHistory(history, s2, 'three');

    const back1 = undoHistory(history, s3)!;
    expect(back1.scene).toEqual(s2);
    const back2 = undoHistory(back1.history, back1.scene)!;
    expect(back2.scene).toEqual(s1);
    const back3 = undoHistory(back2.history, back2.scene)!;
    expect(back3.scene).toEqual(base);
    expect(canUndo(back3.history)).toBe(false);

    const fwd = redoHistory(back3.history, back3.scene)!;
    expect(fwd.scene).toEqual(s1);
  });

  it('a new edit drops the redo stack, because that redo would no longer match', () => {
    const a = scene([card('a')]);
    const b = scene([card('a'), card('b')]);
    const undone = undoHistory(pushHistory(emptyHistory, a, 'one'), b)!;
    expect(canRedo(undone.history)).toBe(true);
    const branched = pushHistory(undone.history, undone.scene, 'other');
    expect(canRedo(branched)).toBe(false);
  });

  it('keeps at most forty steps', () => {
    let history = emptyHistory;
    let current = base;
    for (let i = 0; i < HISTORY_LIMIT + 12; i++) {
      history = pushHistory(history, current, `step ${i}`);
      current = scene([...current.cards, card(`x${i}`)]);
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[HISTORY_LIMIT - 1]?.label).toBe(`step ${HISTORY_LIMIT + 11}`);
  });

  it('does not mutate the history it was given', () => {
    const history = pushHistory(emptyHistory, base, 'one');
    const frozenPast = history.past;
    undoHistory(history, base);
    expect(history.past).toBe(frozenPast);
    expect(history.past).toHaveLength(1);
  });
});
