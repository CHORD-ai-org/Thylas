import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  editLabel,
  emptyHistory,
  pushEdit,
  redoEdit,
  undoEdit,
  type CardEdit,
} from './history';
import type { BoardScene, SceneCard } from './scene';

function card(id: string, x = 0, y = 0): SceneCard {
  return { id, sectionId: 's-1', x, y, w: 200, h: 96, title: id, eyebrow: 'CARD', lines: [] };
}

function scene(cards: SceneCard[]): BoardScene {
  return {
    version: 1,
    id: 'b-1',
    name: 'Board',
    updated: 'now',
    sections: [],
    cards,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe('applyEdit', () => {
  it('adds a card on create and removes it on undo', () => {
    const edit: CardEdit = { kind: 'create', card: card('c-new', 40, 40) };
    const after = applyEdit(scene([card('c-1')]), edit, 'do');
    expect(after.cards.map((c) => c.id)).toEqual(['c-1', 'c-new']);
    const back = applyEdit(after, edit, 'undo');
    expect(back.cards.map((c) => c.id)).toEqual(['c-1']);
  });

  it('restores z-order when a delete is undone', () => {
    const base = scene([card('a'), card('b'), card('c')]);
    const middle = base.cards[1];
    if (!middle) throw new Error('fixture is missing its middle card');
    const edit: CardEdit = { kind: 'delete', entries: [{ index: 1, card: middle }] };
    const after = applyEdit(base, edit, 'do');
    expect(after.cards.map((c) => c.id)).toEqual(['a', 'c']);
    expect(applyEdit(after, edit, 'undo').cards.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves many cards in one step and reverses all of them', () => {
    const base = scene([card('a', 10, 10), card('b', 50, 50)]);
    const edit: CardEdit = {
      kind: 'move',
      moves: [
        { id: 'a', from: { x: 10, y: 10 }, to: { x: 20, y: 30 } },
        { id: 'b', from: { x: 50, y: 50 }, to: { x: 60, y: 70 } },
      ],
    };
    const after = applyEdit(base, edit, 'do');
    expect(after.cards.map((c) => [c.x, c.y])).toEqual([
      [20, 30],
      [60, 70],
    ]);
    expect(applyEdit(after, edit, 'undo').cards.map((c) => [c.x, c.y])).toEqual([
      [10, 10],
      [50, 50],
    ]);
  });

  it('resizes and retitles a single card without touching the others', () => {
    const base = scene([card('a'), card('b')]);
    const resized = applyEdit(base, { kind: 'resize', id: 'a', from: { w: 200, h: 96 }, to: { w: 260, h: 140 } }, 'do');
    expect(resized.cards[0]).toMatchObject({ w: 260, h: 140 });
    expect(resized.cards[1]).toMatchObject({ w: 200, h: 96 });

    const titled = applyEdit(base, { kind: 'title', id: 'b', from: 'b', to: 'Renamed' }, 'do');
    expect(titled.cards[1]?.title).toBe('Renamed');
    expect(applyEdit(titled, { kind: 'title', id: 'b', from: 'b', to: 'Renamed' }, 'undo').cards[1]?.title).toBe('b');
  });
});

describe('history stack', () => {
  const edit: CardEdit = { kind: 'title', id: 'a', from: '', to: 'x' };

  it('drops the redo branch when a new edit is pushed', () => {
    const first = pushEdit(emptyHistory, edit);
    const undone = undoEdit(first);
    expect(undone).not.toBeNull();
    const branched = pushEdit(undone!.history, { kind: 'title', id: 'a', from: '', to: 'y' });
    expect(branched.future).toHaveLength(0);
    expect(branched.past).toHaveLength(1);
  });

  it('redo puts the edit back on the past and returns it', () => {
    const undone = undoEdit(pushEdit(emptyHistory, edit))!;
    const redone = redoEdit(undone.history)!;
    expect(redone.edit).toEqual(edit);
    expect(redone.history.past).toHaveLength(1);
    expect(redone.history.future).toHaveLength(0);
  });

  it('returns null at the ends instead of throwing', () => {
    expect(undoEdit(emptyHistory)).toBeNull();
    expect(redoEdit(emptyHistory)).toBeNull();
  });

  it('caps the stack at 50 steps, dropping the oldest', () => {
    let history = emptyHistory;
    for (let i = 0; i < 60; i += 1) {
      history = pushEdit(history, { kind: 'title', id: 'a', from: `${i}`, to: `${i + 1}` });
    }
    expect(history.past).toHaveLength(50);
    expect((history.past[0] as { from: string }).from).toBe('10');
  });

  it('labels every edit for the status bar', () => {
    expect(editLabel({ kind: 'create', card: card('a') })).toBe('Card added');
    expect(editLabel({ kind: 'delete', entries: [{ index: 0, card: card('a') }] })).toBe('Card deleted');
    expect(
      editLabel({
        kind: 'delete',
        entries: [
          { index: 0, card: card('a') },
          { index: 1, card: card('b') },
        ],
      }),
    ).toBe('2 cards deleted');
  });
});
