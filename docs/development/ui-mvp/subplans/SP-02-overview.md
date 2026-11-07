# SP-02 · Overview

**Status:** Not Started · **Depends:** SP-01 · **Blocks:** SP-09
**Absorbs:** plan/03.

## A. Objective

Make the landing screen answer "where was I" in one glance, with one display element and copy that is derived from data rather than asserted. It is also where AI enters the product, so the intent input must be honest before SP-07 gives it a server.

## B. Scope

**In:** display step (32/40) for the greeting only; computed lede ("N processes need a decision"); Continue rows (last touched objects); Needs-you rows ordered by `needs_input`; workspace cards with real counts; Recently slice; intent input with disabled Start + reason until SP-07.
**Out:** any AI call; stat cards; charts; workspace creation (removed, M4); a "search" mode (the palette is search).

## C. Dependencies

SP-01 (chrome contrast), `src/data/selectors.ts` (counts), `interaction-contract.md` §6 (honest limiter).

## D. UX specification

- Greeting names the user; the lede states the real count of runs needing input, singular/plural correct, and falls back to "Nothing needs you right now" at zero.
- Continue shows the three most recent objects with type, workspace, and last-touched time; clicking resumes in that context.
- Needs-you rows show the run's question (last event text), the age, and a chip for the action (`answer`/`review`). Clicking opens the run detail.
- Intent input: real field, real state; Start is disabled until text, and a persistent caption states that submission needs WAM. It never claims to have sent anything.
- Workspace cards: name, scope badge, counts, membership line. No "New workspace" card.

## E. Visual specification

One display element per screen. Rows 44px, 13/20; metadata 11/16; section labels use `grammar.label` with the 6px tick. Accent budget: the primary Start button and one live dot. Hover = tint only.

## F. Technical plan

- `src/pages/Overview.tsx` — derive `pending` from selectors; drop the `sent/notice` machinery; remove `wsNew`; disable Start with `aria-describedby`.
- `src/pages/overview.module.css` — type steps, remove hover-accent rule, card radii 4, tabular numerals on counts.
- State: none new. No API.

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Display + row type pass | Only one 32px text on screen |
| T2 | Computed lede + zero state | Count changes with mock data |
| T3 | Remove "New workspace"; add footer sentence | No affordance without a service |
| T4 | Intent input: disabled Start + reason | Click does nothing; reason is visible before |
| T5 | Hover/accent pass | No terracotta text outside Start + live dot |

## H. Acceptance criteria

1. Exactly one element ≥ 24px; no element < 11px except glyph tiles.
2. Changing the mock to zero `needs_input` runs changes the lede and the empty copy.
3. Every row navigates to the object it names, in the right workspace.
4. Start cannot be clicked without text; with text it still does not claim to send.
5. `grep -n "accent" overview.module.css` shows only the primary button/live dot.

## I. Validation

`npm run check && npm run lint && npm test`; screenshots 1280/1440; keyboard: Tab to input, type, `Tab` to Start (disabled announced), `↵` does nothing.

## J. Risks and open questions

- Removing the "New workspace" card may read as a regression; the footer sentence is the replacement (M4).
- The intent input becomes a completion box in SP-07 — keep the copy neutral so it survives that change.
