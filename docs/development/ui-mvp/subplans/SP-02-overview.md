# SP-02 · Overview

**Status:** Completed 2026-11-07 · **Depends:** SP-01 · **Blocks:** SP-09
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
- Needs-you rows lead with the run's question (last state event), then name the run, its workspace and its age on a second line; the action chip (`answer`/`review`) sits at the right of that second line. Clicking opens the run detail.
- Intent input: real field, real state; **Start is permanently disabled** with a visible reason until SP-07. It never claims to have sent anything, and nothing appears after a click. See D-017.
- Workspace cards: name, scope badge, counts, membership line. No "New workspace" card.

## E. Visual specification

One display element per screen. Rows 44px minimum, 13/20; metadata 11/16; section labels compose `grammar.label` with the 6px tick (shared primitive now, so every surface gets it). The Needs-you column is `--w-panel` (340px) because the question is the longest line on the screen; the action chip moves to the meta line so it cannot cut that question. Accent budget: none locally — the primary button and live dot are shared primitives. Hover = tint only.

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
| T4 | Intent input: permanently disabled Start + reason + `aria-describedby` | Click does nothing; reason is visible before |
| T5 | Hover/accent pass | No terracotta text; zero local accent declarations |

## H. Acceptance criteria

1. Exactly one element ≥ 24px; no element < 11px except glyph tiles.
2. Changing the mock to zero `needs_input` runs changes the lede and the empty copy.
3. Every row navigates to the object it names, in the right workspace.
4. Start is `disabled` at all times with `title` + `aria-describedby`; the reason is visible before any interaction; nothing appears after a click.
5. `grep -n "accent" overview.module.css` returns nothing — accent lives only in the shared Button/StatusDot primitives.

## I. Validation

`npm run check && npm run lint && npm test && npm run e2e`; screenshots 1280/1440; keyboard: Tab to the input (the reason is announced via `aria-describedby`), type, `↵` sends nothing. A native `disabled` button is not a Tab stop, so the DOM asserts `disabled` + `aria-describedby` instead of "Tab to Start" (D-017).

## J. Risks and open questions

- Removing the "New workspace" card may read as a regression; the footer sentence is the replacement (M4).
- The intent input becomes a completion box in SP-07 — keep the copy neutral so it survives that change.


## Result (2026-11-07, done)

Shipped: one 32/40 greeting (`--t-display`); a computed lede via `pendingLede(needsInput().length)`; Continue derived from `recent().slice(0, 3)` with type / workspace / last-touched, and the file glyph now read from `getFile(id).kind` instead of a hard-coded `pdf`; Needs-you rows led by the question, with run name / workspace / age and the action chip on the second line; a real zero state (`EmptyState`); workspace cards with tabular counts, no dashed "New workspace" card, and one sentence naming the missing service; the intent field is editable while Start is disabled with `title` + `aria-describedby`, and the reason line is present before any click.

**Deviations, with reasons**

1. **Start is disabled regardless of the text, not "until text"** (D-017). §D said "disabled until text"; the confirmed contract §6 says the reason must be visible *before* the click and that a service-missing submit is rendered disabled. An enabled button that does nothing is the exact fake control the audit removed. The field still holds typed text so SP-07 can consume it.
2. **The action chip moved off the row's right edge.** In a 300px column a trailing chip truncated the question — the only piece of text that justifies the row. The chip now sits on the meta line and the column uses `--w-panel` (340px). Verified: "which section should hold counter-evidence?" is complete at 1440 and 1280.
3. **SectionLabel composes `grammar.label` globally** (D-018) rather than Overview adding its own tick. The 6px index tick is a brand carrier; it now appears on every surface. Files/Notes/Processes screenshots show no regression.
4. **`plural()` needed an explicit plural.** `plural(2, 'process')` produced "processs"; `pendingLede` now passes `'processes'`. Found by the lede assertion, not by reading.

**Evidence:** `npm run check` 0 · `npm run lint` 0 · `npm test` 11/11 · `npm run e2e` 37/37 (12 new SP-02 assertions) · `npm run build` CSS 54.5 KB / JS 128.8 KB gzip. `grep -n accent src/pages/overview.module.css` = 0 hits. Zero state verified by temporarily changing both `needs_input` runs in `mock.ts` to `succeeded`: DOM contained "Nothing needs you right now" and "Runs that ask for a decision will appear here", section aside became 0; mock restored byte-for-byte (`git diff` empty). Screenshots: `sp02-overview-v3`, `sp02-overview-1280-v3`, `sp02-zero`, `sp02-files`.

**Left for later units:** SP-07b enables Start and wires the completion path; SP-04 migrates the remaining page-local `.notice` recipes to `grammar.module.css`; M1 (deeper `--ink-2`, AA-safe button fill) is still an unapproved decision, so caption text remains at 3.37:1 on the app ground.
