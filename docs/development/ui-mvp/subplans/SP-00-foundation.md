# SP-00 · Foundation

**Status:** In Progress · **Depends:** — · **Blocks:** SP-01…SP-09
**Absorbs:** plan/01 (typography), the tooling half of plan/12, and the grammar seam from plan/06.

## A. Objective

Make the rules executable. Type is already real (commit `cf01df0`); what is missing is anything that *fails* when the architecture or the visual grammar is violated. After this subplan a cross-layer import breaks the build, a pure function can be tested without a browser, and the six copies of the banner have one home to move into.

## B. Scope

**In:** ESLint flat config with zone rules; Vitest with two pure test files; the E2E harness moved into `scripts/` and runnable via npm; `src/styles/grammar.module.css` created with the five recipes (used from SP-04 onward); `CONTRIBUTING`-level notes inside the config (why each zone exists).

**Out:** migrating the nine pages onto the grammar (SP-04+); Playwright (D-011: after SP-01); visual changes of any kind; new runtime dependencies.

## C. Dependencies

None. Node 22.22.2, npm 10, existing Vite 6 / TS 5.7. The fonts are already shipped — do not touch `src/styles/fonts.css` or `typography.css` in this subplan.

## D. UX specification

None. If this subplan changes anything a user can see, it did something wrong. The only visible artefact is `design/specimens/type-specimen.html`, which already exists.

## E. Visual specification

None, except `grammar.module.css`, which must express the *existing* look exactly — same padding, same 2px accent rule, same 11/16 label with the 6px index tick. It is an extraction, not a redesign; SP-04 is where pages start consuming it.

## F. Technical plan

- `eslint.config.js` — flat config, `typescript-eslint`, one `no-restricted-imports`/`import/no-restricted-paths` rule per architectural rule (MASTER-PLAN §3).
- `vitest.config.ts` — `environment: 'node'` for pure tests; `jsdom` only when a component test needs it (not yet).
- `src/lib/routes.test.ts` — every builder returns the path the router declares.
- `src/lib/tone.test.ts` — trivially: the five tones exist and are distinct strings (guards against a rename drifting from CSS class names).
- `scripts/ui-checks.mjs` — the committed CDP harness (from `.workbuddy/tmp/cdp.mjs`), configurable Chrome path, 16 assertions, exits non-zero on failure.
- `src/styles/grammar.module.css` — `.label`, `.tableHead`, `.banner`, `.filters/.filter/.filterOn`, `.fieldRow`.
- `package.json` — scripts `lint`, `test`, `e2e`; devDeps `eslint`, `typescript-eslint`, `vitest`.

**State ownership:** unchanged. **APIs:** none. **Integration points:** none — this subplan must not touch `pages/`, `shell/`, or `data/`.

## G. Implementation tasks

| # | Task | Expected result |
| --- | --- | --- |
| T1 | Add devDeps and scripts | `npm run lint`, `npm test`, `npm run e2e` exist |
| T2 | Write zone rules, including "no `pages/` → `pages/`" | Adding `import { Overview } from '../pages/Overview'` inside a page fails lint |
| T3 | Prove the rule bites | Temporarily add that import, run lint, see the failure, revert |
| T4 | Vitest config + two test files | `npm test` green, and a broken route builder turns it red |
| T5 | Commit the harness in `scripts/` | `npm run e2e` passes 16/16 against a running dev server, or starts one |
| T6 | `grammar.module.css` | File exists, values match the current page CSS line for line |

## H. Acceptance criteria

1. `npm run lint` exits 0 on the current tree.
2. The same command exits non-zero with a forbidden import (demonstrated once, then reverted — record the output in the commit body).
3. `npm test` runs ≥ 2 assertions and fails if `routes.files('x')` is changed to a wrong shape.
4. `npm run e2e` reports 16/16 or starts its own server and does so.
5. `grammar.module.css` is imported by nothing yet; its `.banner` matches `files.module.css` `.notice` numerically (padding, border-left, colours).
6. No visual diff: the 7 screenshots taken before this subplan are unchanged after it.

## I. Validation

```bash
npm run check && npm run build
npm run lint            # 0
npm test                # >= 2 passing
npm run e2e             # 16/16
git diff --stat         # only config, scripts, tests, grammar
```

Then one deliberate violation (T3) with the failure pasted into the commit.

## J. Risks and open questions

- **Zone rules can be too clever.** If `import/no-restricted-paths` needs an allow-list per directory, write explicit zones and accept verbosity; a rule nobody can read gets deleted at the first false positive.
- **ESLint + TS 5.7** — `typescript-eslint` majors track TS support; pin a major that supports 5.7 rather than upgrading TS in this subplan (D-009 keeps TS 5.9 for later).
- **Harness portability** — Chrome path differs per machine; read `CHROME_PATH`, skip with a clear message rather than a false pass.
- **Q:** does the team want ESLint formatting rules too? Default: no — Prettier is not in the repo, so do not add a second opinion about spacing.
