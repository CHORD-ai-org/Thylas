# 12 · Verification and handover

**Sprint:** S4 · **Estimate:** 0.75 day + 1.5 day buffer · **Gate:** G4 · **Depends:** 01–11

## Objective

Leave behind a gate that a stranger can run, instead of a claim that the UI is finished. This sub-plan turns the contract into ~10 static rules and ~24 runtime assertions, then records the evidence.

## Done when

- `npm run gates` exists and fails on: a raw `font-size`, a 450/550 weight, a hex outside tokens, a serif reference, `transition: all`, an `onClick` on `span`/`div`, scene dimensions outside `scene.ts`, a reachable post-click apology, more than 3 local `.notice` blocks, a missing state selector on a known interactive class.
- CDP suite: 24/24 green, including reduced motion, keyboard traversal and disabled reasons.
- Lighthouse on `/w/ws-research/files` (production build): performance ≥ 90, accessibility ≥ 95.
- Bundle: JS ≤ 160 KB gzip, CSS ≤ 60 KB gzip.
- Seven final screenshots at 1440 committed under `design/screenshots/`; QA shots stay in `.workbuddy/shots/` (ignored).
- `plan/README.md` status board fully `done`, with the gate evidence line per row.

## Steps

1. **`scripts/gates.mjs`** — Node script, no dependencies. Implement each rule as a function returning `{ ok, file, line, message }`; exit 1 on any failure; print a table. Rules:
   ```
   R1  no `font-size:` in src/**/*.css (outside tokens/typography)
   R2  no `450`/`550` in src, design
   R3  no `#[0-9a-f]{6}` in component CSS (tokens files excepted)
   R4  no `serif` in src
   R5  no `transition: all`; transitions limited to width/grid/background/opacity
   R6  no onClick on span/div (JSX scan)
   R7  1032 / 560 only in boards/scene.ts
   R8  no reachable "Nothing was sent" / "not connected" outside a title= or caption
   R9  `.notice {` blocks in src/pages <= 3
   R10 every class in a known list has :hover/:focus-visible/:disabled nearby
   ```
2. **`package.json`** — `"gates": "node scripts/gates.mjs && npm run check"`, and keep `build` as is.
3. **CDP suite** (`scripts/ui-checks.mjs`, port from `.workbuddy/tmp/cdp.mjs` so it is committed and runnable): 24 assertions —
   - nav ×4: rail→files, workspace switch, palette open/close, 404 route
   - tabs ×5: open object, close active → room index, tab count, persistence after reload, `+N` at 9 tabs
   - panel ×3: toggle via button, via `⌘\`, width persists
   - files ×4: selection drives panel, disclosure keyboard, `↵` opens, 1280 column count
   - notes ×2: note opens, reader width 660–680
   - processes ×3: filter narrows, capability-missing → no button, run bands render
   - a11y/motion ×3: skip link focuses main, `esc` closes palette, reduced-motion screenshot has no animation
4. **Lighthouse** — `npm run build && npx serve dist` (npx only, not a dependency), run on the files route, save the JSON under `design/screenshots/`.
5. **Bundle check** — read `dist/assets/*.js` gzip sizes in the gates script (Node `zlib.gzipSync`) and fail above budget.
6. **Final screenshots** — 7 routes at 1440×900, full viewport, no devtools: overview, files, file detail, board, processes, run, notes, account (pick 7; run detail replaces file detail if space matters). Commit under `design/screenshots/` with a one-line caption file.
7. **Identity test** — three people who have not seen the product; show the 7 screenshots with the brand mark cropped; ask two questions: *is this one product?* and *what is it for?* Pass = 3/3 "one product" and none of the answers is "dashboard". Record the answers verbatim in this sub-plan.
8. **Handover** — update `plan/README.md` status board; add one paragraph to `docs/design/interaction-model.md` listing what is now real vs still sample; note the next milestone (editor) and its blockers (dirty-tab guard, save path).

## Files

| Action | Path |
| --- | --- |
| add | `scripts/gates.mjs`, `scripts/ui-checks.mjs` |
| add | `design/screenshots/*.png` + `design/screenshots/README.md` |
| edit | `package.json` (script), `plan/README.md` (status), `docs/design/interaction-model.md` |

## Verify

```bash
npm run gates                      # exit 0, table all green
node scripts/ui-checks.mjs         # 24/24
npm run build                      # JS <= 160KB gzip, CSS <= 60KB gzip
```

Lighthouse JSON attached; identity-test answers pasted below.

## Risks

- **Gate rules that are easy to cheat** (a `style={{fontSize}}` inline) — add R1b: no `fontSize` in TSX.
- The CDP suite depends on dev server + Chrome path; make the path configurable via `CHROME_PATH` and skip with a clear message if absent, never silently pass.
- Screenshots in git grow the repo; cap at 7 files, ≤ 150 KB each.

## Identity test record

| Reviewer | One product? | What is it for? | Notes |
| --- | --- | --- | --- |
| — | — | — | to be filled at G4 |

## Handoff

After G4 the next plan is **not** a continuation of this folder: it is the editor milestone (`docs/planning/roadmap.md` M3a), which needs a dirty-tab guard and a save path before it can be drawn.
