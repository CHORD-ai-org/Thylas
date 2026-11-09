# Interaction audit · 2026-11-08

**Method:** eleven routes driven in headless Chrome at 1440×900. Measured, not judged: focus styles and accessible names read from the live DOM, contrast computed against the nearest opaque background, tab order recorded key by key, the command palette opened and walked. Screenshots at `.workbuddy/shots/sp10a-*.png`.
**Standard:** WCAG 2.2 AA where it applies, plus three rules the brief already claims — a control that cannot act does not accept the click, every action is reachable by keyboard, and nothing is written that the product cannot do.

## What holds

| Claim | Evidence |
| --- | --- |
| Every action is reachable by Tab | 14 stops on Overview, 40 on Files; no `tabindex="-1"` trap found |
| Focus is visible | rail items draw an inset `1px` accent ring; every other control gets `outline: solid 1px` |
| No horizontal overflow | `scrollWidth - clientWidth = 0` on all eleven routes |
| Esc closes the palette | measured; the earlier failure was a consequence of the trap bug below, not of Esc |

## What fails

| # | Severity | Problem | Measured | Fix belongs to |
| --- | --- | --- | --- | --- |
| A1 | **closed 11-09** | The command palette is `aria-modal="true"` but had no focus trap | 8 real Tabs now stay inside the dialog; asserted in e2e | SP-10e |
| A2 | **closed 11-09** | Closing it dropped focus to `<body>` | `closePalette` restores the opener; measured `focusAfterClose: Search or jump to (Ctrl K)` | SP-10e |
| A3 | **closed 11-09** | The palette input had no name and no `aria-activedescendant` | `role=combobox`, `aria-label="Search commands"`, active descendant pointing at the highlighted option and `aria-selected=true` | SP-10e |
| A4 | **closed 11-09** | Rail rows announced a concatenated name | `"Research, personal workspace, 1 need you"` | SP-10e |
| A5 | high | Text below 4.5:1 on every route — the two smallest steps of the ink ramp | `11px label 2.0:1`, `13px nav 3.2:1` (needs 4.5) | SP-10b |
| A6 | high | 8px type survives in four places: workspace initials, file-kind badges | `PQ` `CSV` `PDF` `MD` at 8px | SP-10b |
| A7 | medium | Tap targets under 24×24: tab close, zoom, filter chips | `18×18` ×4, `22×22` ×3, `22` high chips | SP-10d |
| A8 | medium | The note list is six buttons with no arrow-key model | ArrowDown leaves focus in place (an earlier count of 18 was the row's three spans being counted per row) | SP-05c |
| A9 | **closed 11-09** | Two controls shared the name `Collapse sidebar` | the icon beside the wordmark is gone; the labelled row is the only one. The strip's `⌘K` became a hint while the rail is open, so no action has two controls | SP-10e |
| A10 | medium | Empty states carry no next action where one exists | Overview's four blocks leave a third of the fold blank; Processes is empty on the right; Notes shows "Nothing open" above a list of 18 | SP-10d |

Two defects were found by the fix rather than by the audit: Escape only worked while the input itself had focus (after tabbing to an option the dialog could not be closed from the keyboard), and the global focus outline is offset by 1px, so a row spanning a scroll container had it clipped on all four sides. Both are fixed and asserted.

## The one design-level finding

Every route passes the "does it work" test and fails the "would a person who writes for a living keep this open" test. The layout is honest and quiet, and then it under-fills: three of eleven routes have a third of the screen empty, and the two densest (Overview's Continue / Recently) show the same four objects twice.

That is not a styling defect and no radius fixes it. It is an information-architecture decision: Overview should either show one thing well or show nothing, and "Recently" should be the only list of its kind on the screen.

## Order I would fix them

1. **A1, A2, A3, A4, A9** — one pass over the palette and the rail's accessible names. Half a day, no visual change, and it is the difference between "keyboard works" and "keyboard works only if you are sighted".
2. **A5, A6** — the type step, already planned as SP-10b. Contrast is a token change, not a re-layout.
3. **A7, A10** — SP-10d. Target size and empty-state actions.
4. **A8** — falls out of SP-05c for free if the list is rebuilt with a roving tabindex.

## Not audited

Screen readers (no AT on this machine), touch, 200 % zoom, and two of the eleven routes at 1280 (Files and Processes were measured at 1440 only). These are SP-09b's job, and this file is an input to it, not a replacement.
