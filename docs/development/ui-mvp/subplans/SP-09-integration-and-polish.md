# SP-09 · Integration and polish

**Status:** Not Started · **Depends:** SP-01…SP-08 · **Blocks:** MVP sign-off

**Units:** [SP-09a](SP-09a-gates.md) — gates script and e2e expansion (1d) · [SP-09b](SP-09b-visual-audit.md) — visual, a11y, perf, identity (1d).

## A. Objective

Prove the application is one product: run everything together, measure it, look at it, and leave a gate that fails when the next change breaks a rule.

## B. Scope

**In:** `npm run gates` (static rules), full e2e (≥ 30 assertions across surfaces), Lighthouse on the shell, bundle budget, seven final screenshots, logo-covered identity test, cross-surface audit against `branding-desk.md` §13, a11y sweep (focus order, skip link, contrast), motion/reduced-motion pass, `PROGRESS.md` final state.
**Out:** new features; visual redesign; performance work beyond the budgets.

## C. Dependencies

All prior subplans; Chrome for screenshots; a second person for the identity test.

## D. UX specification

No new behaviour. Two behaviours are *removed* if found: any animation on mount, and any control that changes nothing.

## E. Visual specification

The audit is a checklist, not an opinion: seven type steps only; no text < 11px; one accent per region; hairlines continuous; radii 0/2/4/6; no shadow outside `e1/e2`; density per surface unchanged.

## F. Technical plan

- `scripts/gates.mjs` — node script, no deps: R1 no raw `font-size` outside tokens; R2 no 450/550; R3 no hex outside token files; R4 no serif; R5 transitions limited; R6 no `onClick` on span/div; R7 scene constants only in `scene.ts`; R8 no post-click apology strings; R9 `.notice` copies ≤ 3; R10 interactive classes have four states.
- `package.json` — `"gates": "node scripts/gates.mjs && npm run check && npm run lint && npm test"`.
- `design/screenshots/` — seven PNGs at 1440 + a caption file; QA shots stay in `.workbuddy/shots/`.
- `docs/development/ui-mvp/PROGRESS.md` — final status board, evidence links, known limitations.

## G. Implementation tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Gates script | 10 rules, exit 1 with a table |
| T2 | e2e to ≥ 30 assertions | Covers every surface once |
| T3 | Lighthouse + bundle budget | Shell ≥ 90 perf, ≥ 95 a11y; JS ≤ 160 KB gzip |
| T4 | Screenshot set + identity test | 3 reviewers, logo covered |
| T5 | Cross-surface audit | One page of deviations, all fixed or deferred |
| T6 | Reduced-motion + keyboard sweep | Zero animation; every path reachable |

## H. Acceptance criteria

1. `npm run gates` green from a clean clone; a deliberate violation fails it (demonstrated once).
2. 30+ e2e assertions green, including notes and board flows.
3. Budgets met or the miss is documented with a plan.
4. Three reviewers name the seven screenshots as one product; none says "dashboard".
5. No deferred capability is presented as working in UI, copy, or docs.
6. `PROGRESS.md` shows Completed only where acceptance actually passed.

## I. Validation

The gate itself, plus: Lighthouse JSON committed; screenshots committed; trace for the board budget attached to SP-06.

## J. Risks and open questions

- Gates that are easy to bypass (inline `style={{fontSize}}`) — add R1b for TSX.
- The identity test needs a human; if unavailable, record it as `Review Required`, not passed.
