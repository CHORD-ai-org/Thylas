# SP-10 · Visual quality

**Status:** proposed 11-08 · **Depends:** SP-07 (closed) · **Blocks:** SP-09b
**Decided 11-08:** radius scale `4 / 8 / 12 / 16 + pill` (D-041); Inter for Latin UI, Plex Mono and Noto SC kept (D-042). 10a shipped the same day.

## A. Goal

Make the rendered surface hold up beside a commercial product without losing what it is: the same palette, the same hairlines, the same refusal to decorate. Three things are wrong today and one of them is not cosmetic.

## B. What is there now (measured 11-08)

| Thing | Today | Why it reads amateur |
| --- | --- | --- |
| Radius | `1px` `2px`×11 `3px` `4px` `6px` `8px` `9px` `11px` `50%`; tokens are `--r-chip: 2px`, `--r-surface: 4px`, `--r-overlay: 6px` | eleven values with no scale. A 2px corner on a 38px row is not "square by design", it is a rounding that failed |
| Type | IBM Plex Sans 400/500/600 + Plex Mono 400 + Noto SC 400/500, seven steps (11/12/13/16/20/24/32) | six hardcoded `8px`–`10px` sizes survive beside the tokens; no optical weight, no tabular figures outside mono |
| Icons | 24 paths at 16px, 1.2px stroke | eight places still draw a character: `▦` `▤` `N` `×` `▶` `•` `→` `◦` |
| States | `:hover` ×31, `:active` ×1, `:focus-visible` ×1, `:disabled` ×1 | a control has no pressed language, so it feels dead when clicked |
| Elevation | one hairline everywhere, no shadow layer | panels, menus and the palette sit on the same plane as the page; nothing reads as "above" |

## C. Phases

### 10a · One radius scale (0.5 day) — **Done 11-08**

Replaced eleven values with four tokens plus a pill:

```
--r-xs   4px   kbd, 12px markers, checkbox
--r-sm   8px   buttons, inputs, chips, table row hover
--r-md  12px   cards, panels, menus, popovers, code blocks
--r-lg  16px   command palette, dialogs
--r-pill 999px section capsules, tabs, status chips
```

Rule that keeps the identity: **a radius belongs to something you can point at**. A page, a table, a band, a divider stays square — a rounded page is a card, and this product is not made of cards. The note reader keeps `0`, the run bands keep `0`, the file table keeps `0`.

Shipped as token overrides in `src/styles/tokens.css`: the forty `--r-chip` / `--r-surface` / `--r-overlay` call sites moved by changing three values, not by editing forty rules. Eighteen raw values were replaced by the step they were reaching for, and row hover/selection now draws inset through `grammar.rowState` so a row has a corner without breaking column alignment.

Exit: `grep -rn "border-radius: [0-9]" src` → 0; the four corners photographed at 1440.

**Decision change:** `visual-system.md` §1 test 4 ("No corner radius above 4px except overlays") is superseded (D-041).

### 10b · Typeface (1 day)

**Decided: B.** The comparison is kept because the cost of reversing it is one line here:

| | A · keep the skeleton (rejected) | B · change the face (chosen) |
| --- | --- | --- |
| Latin UI | IBM Plex Sans 400/500/600 | **Inter Variable** 400–700 |
| Mono | IBM Plex Mono | IBM Plex Mono (kept — tabular figures are better here) |
| Chinese | Noto Sans SC | Noto Sans SC (kept) |
| Work | re-cut the ramp to 5 steps, drop 6 hardcoded 8–10px sizes, add letter-spacing per step | download + subset, size-adjust against Noto, re-measure every step, re-cut the ramp |
| Risk | fixes legibility, does not change the "engineer tool" feel | Inter's x-height is 4% taller than Plex; CJK lines shift unless `size-adjust` is tuned |
| Cost | 0.5 day | 1 day |

Either way: 11px minimum, `font-variant-numeric: tabular-nums` wherever figures align, `font-feature-settings: "ss01"` only if it does not change the τ.

Exit: no `font-size:` below 11px outside tokens; six font requests or fewer on `/overview`; a side-by-side screenshot at 13/16/24.

### 10c · Characters become paths (0.5 day)

| Where | Today | Becomes |
| --- | --- | --- |
| `Recently.tsx:21` | `▦` | `IconBoards` (already exists) |
| `TabStrip.tsx:154,198` | `×` | `IconClose` (already exists) |
| `ui.tsx:129` | `▶` | `IconChevron` rotated, or a new `IconDisclosure` |
| `Processes.tsx:344,438` | `▤` `▦` `N` | `TypeGlyph` / `NoteGlyph` / `IconBoards` |
| `Processes.tsx:262` | `·` `N` | same three at 11px |
| `Processes.tsx:412` | `•` | a 3px CSS dot, not a glyph |
| `Boards.tsx:844` | `→` | `IconArrow` (new) |
| `Notes.tsx:125` | `◦` | a 3px CSS dot |

`⌘` `↵` `↑` `↓` stay text: they are keyboard symbols, and a drawn ⌘ is a lie about what the keyboard prints.

Exit: a script scans `.tsx` for a one-character text node outside `kbd` and returns zero; every replacement keeps its `aria-label`.

### 10d · Surface, states, density (1 day)

- **Elevation:** three layers only — `raised` (1px line), `float` (line + 1px offset shadow), `overlay` (12% scrim behind a palette). Radius and shadow appear together; neither appears alone.
- **States:** every interactive class gets `:hover`, `:active` (a 1px translate, not a colour), `:focus-visible`, `:disabled`. The audit counted 31 hovers against one of each of the others.
- **Density:** row 38 → 40, table head 36 → 40, panel padding 16 → 20. Fewer rows per screen, more air; measured, not guessed.
- **Empty and loading:** one component for each, used everywhere a list can be empty (K9).
- **Motion:** 150ms `ease-out` on state changes only; nothing enters.

Exit: four states photographed per control class; the palette, the board and the reader all still fit 1440×900 without scroll.

### 10e · Accessibility pass (0.5 day) — **Done 11-09**

From `interaction-audit.md`, the four findings that do not change a single pixel and still matter more than the rest of this file:

| # | Problem | Fix |
| --- | --- | --- |
| A1 | The palette is `aria-modal` with no focus trap; six Tabs walk out into the rail | a trap on `Tab`/`Shift+Tab` over the dialog's focusables |
| A2 | Closing it drops focus to `<body>` | remember the opener and restore it |
| A3 | The palette input has no name and no `aria-activedescendant` | `aria-label="Search"`, active option mirrored on the input |
| A4, A9 | Rail rows announce `"ResearchPERSONAL"`; two buttons share `Collapse sidebar` | explicit `aria-label` per row; unique names |

Exit met: eight real Tabs stay inside the dialog; Esc returns focus to the opener (`Search or jump to (Ctrl K)`); `Collapse sidebar` and `New workspace` each name one control. A1–A4 and A9 are closed in `interaction-audit.md`.

## D. Order and cost

| Phase | Days | Why this order |
| --- | --- | --- |
| 10a radius | 0.5 | Changes the most pixels for the least risk; every later screenshot depends on it |
| 10c icons | 0.5 | Independent of type; unblocks clean screenshots for 10b |
| 10b type | 1.0 | Every measurement after this one is against the final face |
| 10d surface | 1.0 | Needs the final radius and type to judge spacing |
| 10e accessibility | 0.5 | Blocking findings from the interaction audit; no pixel changes, so it can go first |

Total 3.5 days, before SP-09a (gates) and SP-09b (audit). SP-09b then re-runs the audit and closes A3, A10, I6, I7, K9.

## E. Parent acceptance

1. `grep -rn "border-radius: [0-9]" src` → 0, and four visible steps in a specimen screenshot.
2. `grep -rn "font-size: [0-9]" src` → 0; smallest rendered text ≥ 11px.
3. No character-as-icon: a scan of `src/**/*.tsx` returns zero outside `kbd`/prose.
4. Every interactive element has four documented states.
5. Nine surfaces at 1440×900 and 1280×800, no horizontal scroll, no clipped text.
6. The AI surface still answers (the key now present must not be the reason a screenshot passes).

---

## F. Experience pass (10f) — added 2026-11-09 by directive

**Why this phase exists.** 10a–10e make the *pixels* right: radius, face, icons, states, contrast. They do not make the *product* feel composed. A measured audit of four surfaces on 11-09 found that defect, and it is not cosmetic: at 1440 the Boards and Processes lists end in 380–600px of void, Files truncates a column while the panel is open, and numeric columns are left-aligned. Those are composition and completeness failures, not styling ones.

**Authority:** `QUALITY-BAR.md` (eight dimensions, scoring, five tests) and `docs/research/eden-benchmark.md` (what the reference actually demonstrates). Both are binding for this phase.
**Execution order:** `docs/design/optimization-plan.md` sequences 10b–10f into six waves (W0–W6, 6 days) with per-wave exit evidence. Where this file and that plan disagree on order, the plan wins; on scope, this file wins.

### 10f.1 · Composition (1 day)

| Surface | Defect | Fix, not a redesign |
| --- | --- | --- |
| Boards (list) | 2 cards in the top quarter of the page, rest empty (A1) | list becomes a 3-column grid of board cards with a thumbnail at 16:10, card count, last-updated, and the owning workspace; ≥ 6 cards above the fold |
| Processes (list) | 8 rows then void, detail is another page (A2) | row selection opens the run detail **in the side panel**: compressed trace header, artifacts, then events. The list keeps its full height; the panel is the third region |
| Overview | content ends at 880/1440 (A6) | the right column becomes a real region: `NEEDS YOU` moves there full-height, and the left column keeps continue + workspaces. Two columns with distinct duties, not two halves of one list |
| Files | `SOURCE` truncates (A3) | column budget recalculated at 1440 with panel open; source collapses to `#12` + tooltip-free full value in the panel's Source row |

### 10f.2 · Object completeness (0.75 day)

- **Row-level primary action** on Files and Notes (open), keyboard reachable, never inside a `…` menu (lifecycle gap 3).
- **Provenance line, one component:** `produced by run #12 · 2h ago` — identical in file row, board card, note reference.
- **State case, one convention:** machine states are lowercase everywhere (`running`, `needs you`); column headers stay uppercase. Fixes A4.
- **Numeric columns:** tabular figures, right-aligned, units stated. Fixes A5.

### 10f.3 · Context and trace (1 day)

- **Context chip** at the top of the AI panel: workspace · selection · attached count, editable before send (T3, lifecycle gap 1). Without it the panel cannot claim to answer "in context".
- **Compressed trace** as the run detail's first block: `read 12 files · 3 searches · produced 2 artifacts`, expandable to the event list (T4).
- **Insert result as note** with provenance (lifecycle gap 2), scoped to notes only — board insertion waits for artifact ingestion (B2).

### 10f.4 · State honesty sweep (0.5 day)

Fix the four `unverified` lifecycle rows that can silently lose work or focus: focus after closing a tab, note write failure keeps text, board scene failure is named, per-board viewport restore. Each gets one assertion in the existing e2e suite.

### 10f exit

| # | Check |
| --- | --- |
| 1 | All eight surfaces scored in `QUALITY-BAR.md` §2; none ≤ 1; ≥ 20/24 each |
| 2 | No surface has more than 120px unexplained void at 1440×900 |
| 3 | `interaction-lifecycles.md` has zero `gap` rows for Files, Notes, Board, AI |
| 4 | T1 contact sheet produced; no Q2 finding repeats a previous pass |
| 5 | Nothing added that carries no information (QUALITY-BAR §7.3) |

