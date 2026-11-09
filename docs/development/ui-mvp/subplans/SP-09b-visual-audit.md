# SP-09b · Visual, accessibility, performance, identity

**Parent:** [SP-09](SP-09-integration-and-polish.md) · **Days:** 1.0 · **Status:** Not Started · **Depends:** SP-09a

## Objective

Look at the finished application as a product rather than as nine screens that each passed their own tests — then write down what is still wrong instead of declaring it done.

## Scope

**In:** cross-surface audit against `branding-desk.md` §13; seven screenshots at 1440 committed under `design/screenshots/`; Lighthouse (perf ≥ 90 shell, a11y ≥ 95); bundle budget (JS ≤ 160 KB gzip); reduced-motion pass; keyboard sweep; logo-covered identity test with three reviewers; final `PROGRESS.md`.
**Out:** redesigns, new components, performance micro-optimisation.

## UX

No new behaviour. Two removals are allowed and expected: any animation on mount, and any control that changes nothing.

## Visual

The audit is a checklist: seven type steps only; no text < 11px; one accent per region; continuous hairlines; radii 0/2/4/6; shadows only `e1/e2`; density per surface unchanged; no serif.

## Technical plan

- Screenshot set: overview, files, file detail, board, processes, run, notes, account (seven + one spare).
- Lighthouse via `npx serve dist` (no dependency added); JSON committed.
- Bundle check: read `dist/assets/*.js` gzip size in `gates.mjs` (already budgeted) and fail above 160 KB.
- Reduced motion: Chrome emulation, screenshot the running row (dot present, no animation).
- Keyboard: complete J1 and J4 paths only with keys; log every stop.
- Identity test: three people, brand mark cropped, two questions (one product? what for?); record answers verbatim.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Audit pass | One page of deviations, each fixed or deferred |
| T2 | Screenshots + captions | Seven files, committed |
| T3 | Lighthouse + bundle | Numbers recorded |
| T4 | Reduced motion + keyboard | Zero animation; paths complete |
| T5 | Identity test | 3/3 recorded |
| T6 | Final PROGRESS | Statuses match evidence |

## Acceptance

1. Every checklist item is either true or listed as a deferred defect with an owner.
2. Seven screenshots at 1440, no devtools, committed with a caption file.
3. Shell performance ≥ 90, accessibility ≥ 95, or the miss is documented with its cause.
4. JS ≤ 160 KB gzip, CSS ≤ 60 KB gzip.
5. Three reviewers say "one product" and none says "dashboard".
6. `PROGRESS.md` shows Completed only where acceptance passed; deferred items are marked, not hidden.

## Validation

The gate, the screenshots, the Lighthouse JSON, and the recorded interview answers.

## Risks

- Screenshots go stale the moment someone edits; they are evidence at a commit, not a live view.
- The identity test needs three humans; if unavailable, the item stays `Review Required` rather than being marked passed.

---

## Added 2026-11-09 — maturity review (binding)

The checklist above asks whether the surface obeys the brand. It does not ask whether the product feels finished. This audit now also runs the review in `QUALITY-BAR.md`:

| Step | Artefact |
| --- | --- |
| Score all eight surfaces on Q1–Q8 | table appended to `QUALITY-BAR.md` §4, one row per surface, with evidence links |
| T1 reference contact sheet | six 1440 captures beside the corresponding public reference renders — composition only |
| T2 three-second reading | five answers recorded verbatim |
| T3 zero-instruction task | completion time, dead ends, page jumps |
| T4 orphan component | five answers, three states per component |
| T5 five-minute session | five steps, pass/fail per step |
| Lifecycle coverage | `interaction-lifecycles.md` rows checked; every `gap` either fixed or explicitly deferred with a reason |

Pass condition: every surface ≥ 20/24, no dimension ≤ 1, zero unexplained `gap` on Files / Notes / Board / AI.

## Validation (amended)

Gate + screenshots + Lighthouse JSON + interview answers + **the scored table** + **the lifecycle coverage check**.
A score without an artefact is recorded as 2, not 3.

