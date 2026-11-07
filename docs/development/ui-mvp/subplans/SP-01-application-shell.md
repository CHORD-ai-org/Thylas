# SP-01 · Application shell

**Status:** In Progress · **Depends:** SP-00 · **Blocks:** SP-02…SP-08
**Absorbs:** plan/02 (shell), the tab half of plan/09.

## A. Objective

Make the shell read as an instrument, not a template: chrome distinguishable from content by weight and tone, tabs identifiable by type, and a strip that stays usable past eight tabs — all without adding colour.

## B. Scope

**In:** rail type/contrast and keyboard traversal; typed object tabs (file/board/run/note glyph); `+N` overflow menu; panel header treatment; the four states (hover/active/focus/disabled) for every interactive class in `shell/`; strip keyboard (`⌘W` closes an object tab, never a room).

**Out:** per-context panel widths (SP-03), tab dirty state (SP-05, needs the editor), palette rewrite (SP-07 if AI entries are added), any content page.

## C. Dependencies

SP-00 (lint zones must exist before shell edits so an accidental `shell/ → pages/` import fails), the typography contract, `interaction-contract.md` §2–§3.

## D. UX specification

**Rail.** One location indicator per level: area = raised surface + 500 weight + 1px inset line; workspace = expanded group + 500 weight; room = raised surface. Terracotta never indicates location. Collapsing to 56px keeps icon positions; workspace rows become initial chips.

**Keyboard.** Tab enters the rail once. `↑↓` move between siblings, `→` expands a workspace, `←` collapses it, `↵` opens, `Home/End` jump to first/last. Focus is always visible.

**Tabs.** Rooms pinned, no close affordance. Object tabs show a 12px type glyph, label, and (when live) a dot. Hover shows only a tint. Focus ring sits inside the tab so the row does not shift. After 8 object tabs, the strip shows the first 7 plus `+N`; the menu lists the rest with their glyphs, closes on `esc`, and always keeps the active tab visible.

**Empty strip.** A workspace with no object tabs shows rooms only — never a placeholder tab.

## E. Visual specification

From `branding-desk.md` §3 and `typography.md` §3; not restated. Values that matter here:

| Element | Value |
| --- | --- |
| Rail item | 32px tall, 13/20; active = `--t-ui-strong`, surface, inset 1px `--line` |
| Room row | 32px, 12/16, indent 22px |
| Section label | 11/16 mono, `+0.06em`, uppercase, 6px tick (M5) |
| Tab | 32px, 13/20; active = 500 + surface + 2px accent underline inset |
| Panel header | 40px, 11/16 label + count; no serif, no 15px name |
| Hover | `--tint-hover` only. Never text colour. |
| Focus | 1px accent ring, inset, identical geometry to active |

## F. Technical plan

**Components**
- `src/shell/TabStrip.tsx` — typed tabs; overflow slice; menu state (`open`, `activeIndex`); `⌘W` handler scoped to object tabs.
- `src/shell/Rail.tsx` — flat list of rail buttons with roving `tabIndex`; single `onKeyDown` on the `<nav>`.
- `src/shell/ContextPanel.tsx` — header markup only (title + count slot + close).
- `src/shell/shell.module.css` — type, states, overflow menu, focus rings.

**Data/state:** tab set stays in `state/app.tsx` (`openObjectTab` remains the only writer). Overflow is a *view* concern: do not persist a truncated set. If the active tab falls outside the first 7, the visible slice rotates so it is included.

**APIs:** none. **Dependencies:** none new.

## G. Implementation tasks

| # | Task | Expected result |
| --- | --- | --- |
| T1 | Rail type + active treatment + section tick | Screenshot: rail reads as chrome, not content |
| T2 | Rail roving keyboard | Keyboard-only: Tab once, `→`, `↓`, `↵` reaches Files |
| T3 | Typed tabs (glyph by `tab.type`) | Four kinds distinguishable at a glance |
| T4 | Overflow after 8 + rotation for the active tab | Opening a 9th tab shows `+1`; the active tab is never hidden |
| T5 | `⌘W` closes active object tab, never a room; `⌘⇧[`/`]` cycle | Keyboard-only tab switching works |
| T6 | State matrix for `.railItem .wsRow .tab .tabClose .stripTools button` | `grep` shows ≥ 4 states per class; no accent on hover |
| T7 | Panel header: label + count, drop page-specific overrides | Files/Notes panel headers match |

## H. Acceptance criteria

1. Rail: every interactive class has hover, active, focus-visible, disabled; no rule sets text colour to accent on hover (`grep`).
2. Object tabs show a glyph; the strip at 9 tabs shows `+N`; the menu lists the hidden tabs and navigates.
3. Closing the active tab lands on the room index; closing a room tab is impossible (no affordance, no handler).
4. Keyboard-only: reach every rail row, open a file, close it with `⌘W`, cycle tabs with `⌘⇧[`/`]`, with a visible focus ring at every step.
5. At 1280 and 1440 the strip never wraps, never scrolls horizontally, and does not shift when the panel toggles.
6. No page file is edited in this subplan (`git diff --stat` proves it).

## I. Validation

```bash
npm run check && npm run build && npm run lint && npm test
npm run e2e                       # extend to 22: typed tabs, overflow, ⌘W, rail keys
```

Screenshots: rail expanded/collapsed; tab default/hover/active/focus/live; strip with 9 tabs and the menu open; panel open/closed. Compare against `.workbuddy/shots/state-*.png` from before the subplan.

## J. Risks and open questions

- **Overflow + persistence:** a hidden active tab is the classic bug. Rotation is the mitigation; test it by opening 10 tabs and navigating to the 8th by URL.
- **`⌘W` shadows the browser's close-tab.** If it fires while a modal/palette is open, the user loses a tab instead of closing the overlay — guard on "no overlay open", and document the override.
- **Roving tabindex is easy to half-finish:** if `tabIndex` changes without focus following, Tab appears broken. Test keyboard-only.
- **Q:** should the overflow menu be a popover or a scrollable tab row? Default: popover (a scrolling strip hides the fact that tabs exist).
