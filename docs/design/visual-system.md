# Visual System

**Status:** implemented in `src/styles/` and `src/components/`. Values below exist in code; where a value is a proposal that has not survived a screen, it says so.
**Date:** 2026-11-07
**Source of values:** `design/tokens.css` (palette, type ramps, space, rows, panel widths, radii, elevation, motion). `src/styles/tokens.css` imports it and adds only what a running app needs: tints, scrim, layering.

The direction is Quiet Computationalism. This document is the operating manual for it: what each decision prevents, not what it looks like.

---

## 1. The five tests

A surface is on-brand if all five are true. They are used in review, not as decoration.

| # | Test | Failure it catches |
| --- | --- | --- |
| 1 | Exactly one accent-coloured element per region | Three terracotta buttons and no hierarchy |
| 2 | Every separation is a 1px hairline or a tone step | Cards floating on shadows |
| 3 | ~~The largest type on the surface is serif~~ → the largest type comes from the display step and occurs once per screen | An all-Inter dashboard (superseded by `typography.md`; no serif remains) |
| 4 | No corner radius above 4px except overlays | 12px pills everywhere |
| 5 | Nothing moves unless its state changed | Entrance animations on tab switch |

## 2. Colour: hue is state

The palette is fixed. The roles are the part that has to be enforced.

| Token | Value | Allowed use | Not allowed |
| --- | --- | --- | --- |
| `--bg-app` | `#F1EBDD` | application ground, work surface | content cards |
| `--bg-paper` | `#F7F2E9` | board canvas, recessed wells | page background |
| `--bg-surface` | `#FBF9F4` | rail active row, panel, tab, reader, sheet | large decorative panels |
| `--bg-rail` | `#EBE4D4` | the rail only | anything raised |
| `--ink` | `#493626` | all primary text | — |
| `--ink-2` | `#927B65` | metadata, inactive nav | body copy |
| `--ink-3` | `#B3A08C` | placeholders, disabled, units | labels that must be read |
| `--line` / `--line-strong` | `#E6DED1` / `#D8CCB9` | every divider; control borders | shadows standing in for borders |
| `--accent` | `#B56F50` | active tab underline, primary action, running state, focus | tags, links in prose, decoration |
| `--accent-weak` | `#F0E2D7` | selected row, palette selection | section backgrounds |
| `--ok` `#5E6B50` · `--warn` `#A8792C` · `--error` `#8C3A2B` | | run state only | category colour, charts |

**Implementation notes.**

- Tints are derived, not new hues: `--tint-sel`, `--tint-hover`, `--tint-live`, `--scrim`. Nothing invents a colour outside the six given values and their mixes.
- Chromatic budget per region: accent + at most one state colour. The run detail panel is the only place where two appear (state dot + accent live mark), because that screen *is* about state.
- A "live" card or row is marked by a 2px accent edge or a pulsing dot, never by a tinted background.

## 3. Typography: three families, five roles

> **Superseded on 2026-11-07 by [`typography.md`](typography.md).** The system described below shipped and was audited: the stacks never resolved to their first choices, weights 450/550 were synthesised, and 8–10.5px labels carried the hierarchy (`visual-audit.md` §1). The binding contract is now IBM Plex Sans / Noto Sans SC / IBM Plex Mono with a seven-step scale. This section is kept as the record of what was built, not as guidance.

| Role | Family | Size / line | Weight | Where it is used in code |
| --- | --- | --- | --- | --- |
| Display | serif | 28 / 34 | 400 | Overview greeting, note title (30/36 in the reader), board section titles |
| Section | serif | 18 / 26 | 500 | panel headings, board index title, run title at 24/30 |
| Read | serif | 16 / 26, max 68ch | 400 | note body, run intent |
| UI | grotesque | 13 / 18 | 400 | tree, tabs, buttons, table cells |
| UI strong | grotesque | 13 / 18 | 550 | active tab, selected row, file names, table headers at 10.5px mono instead |
| Caption | grotesque | 11 / 16, +0.02em | 450 | metadata, counts, timestamps |
| Mono | mono | 12 / 18 | 400 | sizes, credits, durations, ids, plan strings |

Rules that the implementation actually obeys:

1. **Serif never below 14px.** Section labels in chrome are mono, not small serif.
2. **Numbers that align in columns are mono.** File size, updated, credits, outputs — all `--t` mono. This is why the file table reads as a table and not as prose.
3. **No letter-spacing on serif.** Tracking is only used on mono labels at 0.1em, which is what makes `USED BY` and `WORKSPACE` read as rules rather than words.
4. ~~**Font stacks are system-first** (`Iowan Old Style / Palatino / Georgia`; `Inter / Segoe UI`). Nothing is downloaded. On Windows the serif resolves to Palatino Linotype; on macOS to Iowan.~~ **Correction (2026-11-07):** measuring a real machine showed Palatino Linotype and Iowan are both absent, so the stack resolved to **Georgia**, and Inter to **Segoe UI**. The identity did not survive; it depended on the OS. Superseded by self-hosted fonts in `typography.md` §2.
5. **Reading measure is 660px**, set by `--w-read`. At 1440 with both notes columns open the reading column is exactly that; it does not stretch.

## 4. Geometry

| Property | Value | Where |
| --- | --- | --- |
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 | padding, gaps, section rhythm |
| Row heights | 28 tree · 32 list/table · 36 process table · 40 recent · 44 file header | `--h-row` and per-surface |
| Control height | 28 default, 24 small | `Button` |
| Rail | 240, collapsed 56 | `--w-rail` |
| Context panel | default 340, drag 280–480, Notes 300 | `--panel-w` |
| Tab strip | 40 tall, tabs 32 | `--h-strip`, `--h-tab` |
| Radii | 2 chips/inputs, 4 surfaces, 6 overlays, 50% status dots | tokens |
| Elevation | `e1` hairline shadow on cards, `e2` for palette/modal only | tokens |

**Borders, not shadows, do the separating.** The only elements with a shadow are: board cards (`e1`), floating board chrome (`e1`), the command palette (`e2`). Everything else is a 1px line or a tone step.

**Grid.** Two layouts exist and nothing else:

- `rail | work` — the application grid, `grid-template-columns: var(--rail-w) minmax(0,1fr)`, one row, `overflow:hidden`.
- `surface | panel` — inside work, a flex row. The strip sits above both, so a tab strip never belongs to a panel.

## 5. Iconography

One hand-written set in `src/components/icons.tsx`: 16px box, 1.2px stroke, round caps, no fills, no two-tone. File types are not icons but 18px bordered tiles with an 8px mono abbreviation (`PDF`, `PQ`, `CSV`), because six drawn file glyphs at 16px are indistinguishable and cost more than they explain.

This is deliberate: a generic icon library brings a second stroke weight, a second corner language, and a hundred symbols nobody uses. The set grows by adding a path, not a dependency.

## 6. Density is per-surface, not global

| Surface | Row height | Columns | Why |
| --- | --- | --- | --- |
| Overview | 44 | one, with a right-aligned state | orientation, not operation |
| Recently | 40 | one, five fields inline | scan history |
| Files | 32 | five, numerics right-aligned | resource navigation |
| Processes | 38 | six, numbers mono right | execution reading |
| Notes list | 44 | two lines | titles need two lines to be recognisable |
| Run detail | 32 per event | time gutter + text + meta | log density, not table density |

The Account preference "row density" toggles `--h-row` between 32 and 26 for this session. It is the only density control, and it is honest about its scope: no persistence, because preferences belong to the account service.

## 7. What this system refuses

- **No second palette for dark mode.** Not in v1: the paper metaphor is a tone argument, and a dark variant would need its own accent, its own tints and its own state colours.
- **No gradients, glass, or blur.** Scrim is a flat 16% brown.
- **No generic card component.** Surfaces are drawn where they are needed; a `Card` primitive would invite wrapping every list row in one.
- **No colour as decoration.** If a hue is not carrying state or selection, it is a bug.
