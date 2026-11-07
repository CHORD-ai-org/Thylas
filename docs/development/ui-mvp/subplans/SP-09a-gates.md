# SP-09a · Gates script and e2e expansion

**Parent:** [SP-09](SP-09-integration-and-polish.md) · **Days:** 1.0 · **Status:** Not Started · **Depends:** SP-02…SP-08

## Objective

Leave a command that fails when the rules are broken, and an e2e suite that exercises every surface at least once — so the next person does not have to trust this document.

## Scope

**In:** `scripts/gates.mjs` with 10 static rules; `npm run gates`; e2e to ≥ 30 assertions covering all surfaces; a documented proof that a violation fails the gate.
**Out:** visual auditing (SP-09b), performance work, new features.

## UX

None. This unit is developer-facing.

## Visual

None.

## Technical plan

Rules (each returns `{ ok, file, line, message }`, exit 1 with a table):

```
R1  no `font-size:` outside tokens/typography/grammar
R1b no inline `fontSize` in TSX
R2  no 450/550 weights
R3  no hex colours outside token files
R4  no `serif` outside the sans-serif keyword
R5  transitions limited to width/grid/background/opacity
R6  no onClick on span/div
R7  scene constants only in boards/scene.ts
R8  no post-click apology strings
R9  `.notice {` blocks in src/pages <= 3
R10 interactive classes have hover/focus-visible/disabled
```

e2e additions: overview AI states (stub), files disclosure/keyboard/tombstone, notes create-link-reload-conflict, board create-drag-connect-undo, processes filter deep link, account density persistence, reduced-motion screenshot.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Gates script + npm script | Runs in < 2s, table output |
| T2 | Prove it fails | Temporarily break R6, capture output |
| T3 | e2e to ≥ 30 | Each surface covered |
| T4 | CI-ready | Exits non-zero; no interactive prompts |

## Acceptance

1. `npm run gates` green on `main`; each rule can be shown failing by a one-line change.
2. e2e ≥ 30 assertions, green from a clean clone (starts its own server).
3. No rule produces a false positive on the current tree.
4. Runtime under 2 minutes total.

## Validation

The gate itself; a table of "rule → deliberate violation → caught" in the PR body.

## Risks

- Rules that grep may catch comments; scope them to non-comment lines or accept a maintenance cost.
- e2e that needs mock state must seed it through the UI or `sessionStorage`, never by editing `data/mock.ts` permanently.
