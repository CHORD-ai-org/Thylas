# Visual & Interaction Optimization Plan

**Status:** proposed, for approval. 2026-11-09.
**Scope:** the Thylas application. Not the website, not WAM.
**Consumes:** `QUALITY-BAR.md` (scoring), `docs/design/interaction-lifecycles.md` (completeness), `docs/research/eden-benchmark.md` (composition reference), `SP-10` (10a done, 10b–10f).
**Does not reopen:** the palette (D-040), the radius scale (D-041), the face decision (D-042). It sequences them and adds what they leave out.

---

## A. Diagnosis

Four surfaces were measured on 11-09 at 1440×900. Scores are out of 24 (`QUALITY-BAR.md` §1).

| Surface | Score | What fails |
| --- | --- | --- |
| Files | 21 | `SOURCE` truncates to `produced · #…` with the panel open (Q4) |
| Overview | 18 | content ends at 880px of 1440; nothing occupies the right (Q2) |
| Boards | 16 | two cards in the top 250px, ~600px empty below (Q2, Q3) |
| Processes | 16 | 8 rows then ~380px empty; `TYPE` uppercase vs `STATE` lowercase; numbers left-aligned (Q2, Q7) |

The defects are not four separate bugs. They are three causes:

| # | Cause | Evidence | What it costs |
| --- | --- | --- | --- |
| C1 | **One region in a wide field.** The panel is closed by default, list surfaces are short, so 1440 shows a 660px column and 500px of paper | Overview, Boards, Processes captures | Reads unfinished at the size most users have |
| C2 | **Objects without a next action.** A row says what a thing is, not what you can do with it; provenance exists only in the file panel | Files rows, Process rows | The user has to guess the product's intent |
| C3 | **Conventions diverge per component.** Case, numeric alignment, state words, character-glyphs | Processes rows, `▦ ▶ ×` in 8 places | Breaks the "instrument" reading in the places that matter most |

Underneath all three: the type ramp exists (seven steps) but six hardcoded 8–10px sizes survive beside it, so hierarchy is carried by ad-hoc sizes; and every interactive class has a hover but almost none has pressed/focus/disabled.

---

## B. Target — six statements, each testable

1. At 1440×900, **no surface ends in more than 120px of unexplained void**.
2. **Every object shows identity + state + provenance in its resting state**; the panel explains, it does not reveal.
3. **One convention per concept** — five state words, one case rule, one numeric alignment, one provenance line — across all eight surfaces.
4. **Hierarchy comes from four steps** (11 / 13 / 16 / 20–32 display), not from twelve.
5. **Nothing moves on mount**; every transition that exists can be explained in one sentence.
6. A stranger completes *open note → write → link → board → connect → ask AI* **without instruction** (T5).

---

## C. Visual style plan

### C1 · Type — one ramp, five steps

| Step | Size / line | Weight | Use | Replaces |
| --- | --- | --- | --- | --- |
| `caption` | 11 / 16 | 500 | labels, column heads, meta | six 8–10px hardcodes |
| `ui` | 13 / 20 | 400 · 500 | rows, controls, panel | unchanged |
| `read` | 16 / 26 | 400 | note body, lede, 66–72ch | unchanged |
| `display` | 32 / 40 | 500 | one per screen (greeting, page title) | 24px `page` merged into 20 or 32 |
| `mono` | 12 / 18 | 400 | ids, numbers, states | 11px mono for meta only |

Rules: `font-size` appears only in `typography.css`; **tabular figures on every numeric column**; tracking `.02em` at 11, `-.01em` at 32; Latin = Inter Variable (D-042), CJK = Noto SC with `size-adjust` tuned against Inter, mono = Plex Mono.
**Doc debt:** `branding-desk.md` §3 still claims Plex ([C]) — it must be amended to D-042 in W0, or the brand authority contradicts the build.

### C2 · Rhythm — 4px, three row heights

`row 40` (lists, menus) · `row-dense 32` (tables over 12 rows) · `toolbar 44` · `strip 40` · page padding `32` · section gap `48` (24 inside a section).
Nothing is 38, 36, or 34. A row height that is not a multiple of 4 does not exist.

### C3 · Lines and surfaces

| Plane | Treatment | Used by |
| --- | --- | --- |
| page | `--bg-app`, no border | canvas of every route |
| raised | `--bg-surface` + 1px `--line` | panel, reader page, strip |
| float | raised + `--e1` | board card, floating toolbar |
| overlay | `--bg-surface` + `--e2` + 16% scrim | palette, menu |

Hairlines stay continuous (P3). Radius appears only on things you can point at (D-041): 4 control · 8 input/button · 12 card/panel · 16 overlay · pill state chip.

### C4 · Colour discipline

One accent per region, and only for state. **Secondary text moves from `--taupe` (#927B65, 3.37:1) to `--ink-2` (#75604B, 5.0:1)** wherever it is text; taupe survives as stroke and hairline only. This single swap fixes the "washed out at 13px" reading without changing a hue.

### C5 · Glyphs

Eight character-icons become paths (`▦ ▶ × ▤ N • → ◦`). 16×16, 1.2px stroke, no fill; file types stay as 18px tiles with a 9px mono abbreviation. `⌘ ↵ ↑ ↓` stay text.

### C6 · States — four, defined once

| State | Draw |
| --- | --- |
| hover | `--tint-hover` background, no movement |
| active | 1px down-translate + `--tint-sel` |
| focus-visible | 2px `--accent` ring, 2px offset |
| disabled | text `--ink-3`, no tint, cursor default, reason in `title` |

Every interactive class gets all four; the audit counts 31 hovers against one of each of the others.

### C7 · Density, per surface

| Surface | Rows at 900 | Row height |
| --- | --- | --- |
| Files (panel open) | ≥ 12 | 32 |
| Processes | ≥ 14 | 32 |
| Recently | 10 | 40 |
| Panel lists | 8 | 40 |
| Board cards | 6 in 3 columns | — |

---

## D. Interaction plan

### D1 · Composition — the missing third region

| Change | Rule | Why |
| --- | --- | --- |
| Panel default-open | On Files, Boards, Processes and Notes, the panel opens with the first object selected; its empty state says what it is for | C1; the workbench only exists if two kinds of information are visible at once |
| Selection binding | Panel always renders the **selected** row, never a remembered one; selecting nothing shows the empty state | Prevents the two-writers defect |
| Overview split | Left: continue + workspaces. Right: needs-you, full height | Ends the 560px right margin |
| Boards list | 3-column card grid, ≥ 6 above the fold; card = thumbnail + name + counts + updated | C1/C3 |
| Processes detail | Selecting a run opens the **run panel in place** (compressed trace, artifacts, events); the list keeps its height | Removes the page jump that made the list look empty |

### D2 · Object action model

- One **primary action on the row** (open / resume), visible on hover and on focus, reachable with `↵`.
- Secondary actions live in the panel, not in a `…` menu; if a menu exists it holds ≥ 3 items, otherwise they are rows.
- Provenance is one component: `produced by run #12 · 2h ago`, identical in file row, board card, note reference, run artifact.
- Case rule: **machine states lowercase** (`running`, `needs you`), **column heads uppercase**, **buttons verb + object, sentence case**.

### D3 · AI in context

| Element | Behaviour |
| --- | --- |
| Context chip | Above the answer: `Research · 3 notes · selection`, editable before send; removing an attachment is one click |
| Answer provenance | Quoted material carries its source inline (`from: contradictions.md`) |
| Insert | `Insert as note` writes with `produced by this answer` provenance; `Insert as card` waits for artifact ingestion (B2) |
| Stream | Answer streams; `Stop` aborts; closing the panel aborts |
| Failure | Seven error kinds already exist — the panel shows the next action, never "Something went wrong" |

### D4 · Trace

Run detail opens with one line: `read 12 files · 3 searches · produced 2 artifacts`, expandable to the event list. The list is the evidence; the line is the summary.

### D5 · Keyboard and focus

`↑/↓` roving in rail · `↵` open · `⌘W` close tab · `⌘K` palette · `Esc` closes one layer, never two · focus returns to the opener after any close/delete/abort. One assertion per feature.

### D6 · Motion — keep the discipline, add nothing

Four durations (0 / 90 / 160 / 600ms), two easings, unchanged. The new elements introduce **no new transitions**: panel default-open is a layout state, the chip is a state change, the trace expands at 90ms. Drag feedback is a 1px outline and a cursor, not an animation. `prefers-reduced-motion` still kills everything but the live dot.

---

## E. Sequence

| Wave | Work | Days | Depends | Exit evidence |
| --- | --- | --- | --- | --- |
| **W0** | Doc debt: branding desk §3 + typography.md → D-042 | 0.25 | — | no doc contradicts the shipped face |
| **W1** | Type: Inter + 5-step ramp + tabular + kill <11px | 1.0 | W0 | `grep font-size` → 0 in components; specimen at 11/13/16/32 |
| **W2** | Glyphs (0.5) + four states, elevation, density, empty/loading (1.0) | 1.5 | W1 | character-icons → 0; 4 states per class; 3 planes photographed; one empty + one loading component in use |
| **W3** | Composition: panel default, Overview split, Boards grid, Processes panel, Files column budget | 1.0 | W1 | 4 surfaces re-shot; void ≤ 120px |
| **W4** | Object completeness: row action, provenance, case, numeric alignment | 0.75 | W3 | 4 checks in `QUALITY-BAR` §4 closed |
| **W5** | AI context chip + trace header + insert-as-note | 1.0 | W4 | one AI answer carries 2 sources and inserts with provenance |
| **W6** | Honesty sweep (0.5) + accessibility pass A1–A4, A9 (0.5) + scoring, T1–T5 | 1.0 | W5 | all surfaces ≥ 20/24, no dimension ≤ 1; palette traps focus; Tab leaves it in one press |

**Total 6.5 days** (6.25 of SP-10 remaining + 0.25 doc debt). W2 can overlap W3 only with two people; otherwise sequential.

Order rationale: type first because every later measurement is against the final face; composition before detail because it moves the most score for the least code; AI last because insertion depends on the provenance component from W4.

---

## F. Per-surface delta

| Surface | Today | After |
| --- | --- | --- |
| Rail | 240px, 3 levels, unlabelled accent dots | unchanged except dots gain a tooltip or are removed (decision D4) |
| Overview | one column, 560px empty right | two regions: continue/workspaces left, needs-you right; ≤ 120px void |
| Files | table truncates source | column budget at 1440/1280/1024; source = `#12`, full value in panel |
| Notes | 660px reader, panel 300 | unchanged composition; type ramp + tabular + selection contrast |
| Board | canvas, 24px targets, verified | unchanged; card provenance line matches file row |
| Boards list | 2 cards, 600px void | 3-column grid, ≥ 6 cards |
| Processes | 8 rows, void, no detail | ≥ 14 rows; row select opens run panel with trace |
| AI panel | answers, no scope | context chip, inline source, insert as note |

---

## G. Gates

Each wave is reviewed against `QUALITY-BAR.md` §1 and recorded in `PROGRESS.md`. No wave passes on "it renders"; every claim needs a state pair or a measurement. T1–T5 run at W6, T2/T4/T5 with real people (3–5 reviewers).

---

## H. Decisions needed

| # | Question | Default if silent |
| --- | --- | --- |
| D1 | Is a default-open panel acceptable on every object route, or only where a selection exists? | only where a selection exists |
| D2 | Overview: two-column split, or keep one column and widen the reader? | two-column split |
| D3 | Boards list: 3-up grid at 1440 and 2-up at 1024? | yes |
| D4 | Rail accent dots: label them (needs a state) or remove them (accent is not decoration) | remove |
| D5 | Does W5's `insert as note` ship before WAM exists, given artifact ingestion is deferred (B2)? | yes, notes only |

---

## I. Non-goals

No new hue, no new radius step, no serif, no shadow on cards, no animation on mount, no dark mode, no mobile layout, no redesign of the rail's three levels, no change to the state vocabulary (five words).
