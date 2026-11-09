# Quality Bar — the review Thylas has to pass

**Status:** active. 2026-11-09. Amends SP-10 and SP-09b.
**Why:** the founder's directive of 2026-11-09 sets Eden-level product maturity as the target. This file turns that into eight scored dimensions, a baseline audit with evidence, and a review procedure that produces a verdict instead of an opinion.
**What it is not:** a visual template. Palette, typography and the Quiet Computationalism rules in `../../brand/branding-desk.md` stay authoritative. Nothing here licenses copying a reference's look.
**Companions:** `docs/research/eden-benchmark.md` (what was observed, and what could not be), `docs/design/interaction-lifecycles.md` (per-feature state requirements).

---

## 1. The eight dimensions

Each dimension has one test that decides it. A dimension is not judged by impression.

| # | Dimension | The test that decides it |
| --- | --- | --- |
| Q1 | **Visual hierarchy** | Squint test at 25% scale: three levels are distinguishable (region / object / metadata). If everything is the same grey, fail |
| Q2 | **Layout composition** | At 1440×900 the primary region occupies 60–85% of the content width, and no region ends in more than 120px of unexplained void |
| Q3 | **Information density** | Count rows/objects per 900px column, compare with the surface's own target (`spatial-language.md`); a list that shows 8 rows where the table can show 20 is a density defect, and so is 20 where 8 are readable |
| Q4 | **Content presentation** | Every object shows identity + state + provenance without opening it. Cards and rows that only show a name fail |
| Q5 | **Interaction completeness** | Every row in `interaction-lifecycles.md` for that surface is `verified`. Any `gap` caps this dimension at 1 |
| Q6 | **Motion quality** | Record the surface for 3 seconds with no input: it must be identical frame 1 and frame 90. Then perform one action: the change must be explainable in one sentence ("the panel got wider") |
| Q7 | **Feedback consistency** | The same state word, the same dot, the same disabled pattern across all surfaces. One divergence fails the dimension |
| Q8 | **Cross-feature coherence** | Take the same object (a file) through Files → Notes reference → Board card → Run provenance. Name, id format, state vocabulary and provenance line must match at every step |

## 2. Scoring

`0` absent · `1` present but visibly wrong · `2` correct, not yet considered · `3` considered, holds under the test.

| Rule | Value |
| --- | --- |
| Ship threshold | ≥ 20 / 24 per surface **and** no dimension ≤ 1 |
| Regression rule | A later change may not lower any dimension below its recorded score |
| Evidence rule | A score of 3 requires an artefact: screenshot, measurement, or recording path. Scores without evidence are recorded as 2 |
| Reviewer rule | The founder is the only reviewer who can award 3 on Q1, Q2 and Q8; the implementer may propose |

## 3. Per-surface expectations

| Surface | Q2 primary region | Q3 target | Known trap |
| --- | --- | --- | --- |
| Rail | 240px fixed | 3 levels visible without scroll at 900px | icon-only collapse losing labels |
| Overview | 60–70% | 3 continues + 2 needs-you + 2 workspaces above the fold | greeting becoming the page's only hierarchy |
| Files | table 55–65% + panel 340px | ≥ 12 rows at 900px | truncating columns instead of budgeting them |
| Notes | reader 660px centred | 66–72 characters | editor chrome eating the reading column |
| Whiteboard | canvas 100% | cards readable at 100%, title-only at ≤60% | empty canvas with no affordance |
| Processes | table 70–85% | ≥ 14 rows at 900px | a list that ends in void because detail is a separate page |
| AI panel | 340px | composer visible with answer | panel treated as a chat toy |
| Account | 60% | one screen, no scroll | settings that look like a pricing page |

## 4. Baseline audit — 2026-11-09, dev build, 1440×900

Measured from four captured surfaces (`/overview`, `/w/ws-research/files`, `/w/ws-research/boards`, `/w/ws-research/processes`). Notes and the open AI panel were **not** captured this pass and are marked unverified rather than assumed.

| # | Finding | Evidence | Dimension | Owner |
| --- | --- | --- | --- | --- |
| A1 | **Boards list ends in void.** Two cards occupy the top 250px of 900; ~600px empty below, no third region. *Partially fixed 11-09:* cards are now 16:9 blocks with a real thumbnail (top 400px), void down to ~300px. The remaining gap is data-bound: two sample boards cannot fill a three-column grid | `app-board3` → `w3-boards2` | Q2, Q3 | SP-10f.1 (remainder blocked on more boards) |
| A2 | **Processes list ends in void.** 8 rows, then ~380px empty; selecting a run leaves the same page | capture `app-proc` | Q2, Q3, Q4 | SP-10f |
| A3 | **Files truncates a column instead of budgeting it.** With the panel open at 1440, `SOURCE` renders `produced · #…` | capture `app-files3` | Q4 | SP-10f |
| A4 | **Case conventions diverge inside one row.** `TYPE` is uppercase mono, `STATE` is lowercase (`running`, `needs you`) | capture `app-proc` | Q7 | SP-10f |
| A5 | ~~Numeric columns are left-aligned~~ **Retracted on re-measure 11-09.** Re-shot after 10b: `12m / 4m / 1h` and `42 / 11 / 118` share a right edge. The first reading was wrong; tabular figures made the defect look fixed when it was never there | re-capture `w2-proc` | — | closed as invalid |
| A6 | **Overview leaves 200px+ unused at 1440.** Content column ends ~880; panel closed with no replacement region | capture `app-ov3` | Q2 | SP-10f |
| A7 | **Rail status dots are unlabelled.** Terracotta dots on workspace rows do not say what state they mean; the one accent may be decorating rather than reporting | capture `app-ov3` | Q7 | SP-10f (decide: label, or remove) |
| A8 | **Positive:** missing-workspace error is exemplary — names the object, explains, offers a route out | capture `app-files2` | Q5 | — |
| A9 | **Positive:** three surfaces state a missing service in one sentence at the point of action | Files, Boards, Processes banners | Q7 | — |
| A10 | Notes surface, AI panel open state, and all four hover/selection states | not captured | — | SP-09b |

**Baseline scores (four captured surfaces, evidence-backed):**

| Surface | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Overview | 3 | 1 | 2 | 3 | 2 | 3 | 2 | 2 | 18 |
| Files | 3 | 2 | 3 | 2 | 3 | 3 | 2 | 3 | 21 |
| Boards (list) | 2 | 1 | 2 | 2 | 2 | 3 | 2 | 2 | 16 |
| Processes | 3 | 1 | 2 | 2 | 2 | 3 | 1 | 2 | 16 |

None reaches 20 except Files, and Files fails Q4 on truncation. That is the honest starting point.

## 5. The five tests

Adapted from a sibling project's evaluation set (`D:/github projects/HeptaBase RE/Plan/05-评估标准.md`), rewritten for Thylas's objects.

| Test | Procedure | Pass |
| --- | --- | --- |
| **T1 · Reference contact sheet** | Six screenshots at 1440, placed beside the corresponding Eden render — composition only, no colour or type comparison | Every Q2 finding named, none repeated from the previous pass |
| **T2 · Three-second reading** | A stranger sees a screenshot for 3s, then answers: what is this object, what state is it in, what can I do | ≥ 4/5 correct on object and action |
| **T3 · Zero-instruction task** | "Find the file you used yesterday, reference it from a note, and see where it is used" — no help | complete in ≤ 60s, 0 dead ends, 0 page jumps outside the workspace |
| **T4 · Orphan component** | Show one component (row, card, chip, panel header) out of context | ≥ 4/5 say it belongs to this product; empty/disabled/overflow states all handled |
| **T5 · Five-minute session** | Stranger does: open a note, write, link, open a board, connect two cards, ask the AI one question | 5/5 steps without instruction; can say what they would use it for next |

## 6. Procedure

| When | What |
| --- | --- |
| Before starting a unit | Read the lifecycle rows for that surface; anything marked `gap` is in scope, not "later" |
| At unit close | Score the surface on the eight dimensions; attach artefacts; record in `PROGRESS.md` |
| Before SP-09a | All eight surfaces scored; nothing ≤ 1 |
| During SP-09b | Run T1–T5, then re-score; a score that moved without an artefact is rejected |

## 7. Anti-gaming

1. **"It works" is not a score.** Rendering is Q1 minimum; it does not imply Q2–Q8.
2. **A screenshot is not evidence of interaction.** Interaction claims need a state pair (before/after) or a recording path.
3. **No dimension may be raised by adding decoration.** If a fix adds an element, name the information it carries.
4. **A 3 that contradicts `interaction-lifecycles.md` is invalid.**
5. **Reference wins on composition, Thylas wins on identity.** Where they conflict, identity wins and the deviation is recorded (D-043).
