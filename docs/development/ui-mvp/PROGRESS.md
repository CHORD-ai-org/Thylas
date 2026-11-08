# Progress

**Rule of this file:** it describes the repository, not intentions. If a line here disagrees with `git log` or the running app, the file is wrong.

Last updated: 2026-11-08 09:52 (SP-10a shipped; 10b–10d proposed).

---

## Status board

Units are the unit of execution: one branch, one commit, ≤ 1.5 days. The canonical list with order and links is [`subplans/INDEX.md`](subplans/INDEX.md).

| Unit | Parent | Status | Days | Depends | Note |
| --- | --- | --- | --- | --- | --- |
| SP-00 Foundation | — | **Completed** 11-07 | 1.5 | — | lint zones, Vitest 8, e2e 25, grammar recipes |
| SP-01 Application shell | — | **Completed** 11-07 | 2.0 | SP-00 | typed tabs, measured overflow, rail keys, states |
| SP-02 Overview | — | **Completed** 11-07 | 1.0 | SP-01 | computed lede + zero state, honest disabled Start, no new-workspace card, shared section tick |
| SP-03a Tab model | SP-03 | **Completed** 11-07 | 1.0 | SP-01 | pure `lib/tabs.ts` 12 tests, v2 persistence, tombstones, cross-scope isolation |
| SP-03b Panel and restore | SP-03 | **Completed** 11-07 | 0.5 | SP-03a | per-context widths, named-region scroll restore, room-preserving switch, settings deleted |
| SP-04a Table grammar | SP-04 | **Completed** 11-07 | 0.75 | SP-03b | grammar adoption, measured 3-width budgets, no truncation |
| SP-04b File interactions | SP-04 | **Completed** 11-07 | 0.75 | SP-04a | real disclosure, 5-key table, tombstone, honest disabled actions |
| SP-05a Note model | SP-05 | Not Started | 1.0 | SP-04a | store, link parser, backlinks — Q-1 does not block it |
| SP-05b Editor and save | SP-05 | **Blocked** (Q-1) | 1.75 | SP-05a | conflict + dirty guard |
| SP-05c Note library | SP-05 | Not Started | 1.25 | SP-05b | list, search, panel |
| SP-06a Scene model | SP-06 | **Completed** 11-07 | 0.75 | SP-04a | pure `scene.ts`, versioned `store.ts`, 23 tests, byte-identical render |
| SP-06b Viewport | SP-06 | **Completed** 11-07 | 1.25 | SP-06a | ref + rAF zoom/pan, 30/30 steps, 150-card P95 16.7ms |
| SP-06c Cards | SP-06 | **Completed** 11-07 | 1.5 | SP-06b | sections, five fills, folds, eight handles, menus, minimap; second pass against the reference |
| SP-06d Edges | SP-06 | **Completed** 11-07 | 1.5 | SP-06c | anchors, connect, bend, elbow, arrows, labels, 24px target at any zoom |
| SP-07a AI endpoint | SP-07 | **Completed** 11-08 | 1.0 | SP-03b | `POST /api/ai` in dev *and* preview, seven error kinds, key never leaves the server, 35 offline assertions |
| SP-07b AI panel | SP-07 | **Completed** 11-08 | 0.75 | SP-07a, SP-02 | four states, abort, retry by `retryable`, footer meta, 15 e2e assertions |
| SP-07c Process states | SP-07 | **Completed** 11-08 | 0.75 | SP-03b | URL filters, capability-gated controls on a local copy, 700 ms simulator, empty/loading/error |
| SP-08 Account | — | Not Started | 0.5 | SP-01 | density persistence, zero accent |
| SP-10 Visual quality | — | **In progress** — 10a done 11-08 | 3.5 | SP-07 | radius shipped; typeface, icons, surface and accessibility remain |
| SP-09a Gates + e2e | SP-09 | Not Started | 1.0 | SP-02…SP-08 | 10 rules, ≥ 30 assertions |
| SP-09b Visual audit | SP-09 | Not Started | 1.0 | SP-09a | screenshots, a11y, identity test |

Remaining: **6.5 days**. Critical path: SP-09a → SP-09b; SP-05 stays blocked on Q-1, SP-08 is independent.

---

## What actually exists today

| Area | State | Evidence |
| --- | --- | --- |
| Build | Vite 6.4.5, React 19.3.1, react-router-dom 7.18.5, TypeScript 5.7.3 | `package.json`, `npm ls` |
| Routes | 15, all mounted | `src/app/routerChildren.tsx` |
| Surfaces | 9 screens render | screenshots in `.workbuddy/shots/` |
| Tabs | Open/close/persist, rooms pinned | CDP suite 16/16 |
| Typography | Plex/Noto self-hosted, 7 steps, no serif | `cf01df0`, specimen page |
| Data | All mock (`src/data/mock.ts`), no network | — |
| Tests | legacy 16-assertion smoke script, superseded by the committed suite | `.workbuddy/tmp/cdp.mjs` |
| Lint | ESLint 10 + `typescript-eslint`, layering zones; `npm run lint` clean | `eslint.config.js` |
| Unit tests | Vitest 5, 127 assertions: scene maths, store, history, gestures, tabs, routes, selectors, AI contract | `src/**/*.test.ts` |
| E2E | 183 assertions, self-starting dev server, fails the run on a page error | `scripts/ui-checks.mjs` |
| AI endpoint | `POST /api/ai` mounted in `dev` and `preview`; seven failure kinds; the key is read only by the server | `server/ai.ts`, `src/lib/ai.ts` |
| AI client | `ask(prompt)` returns a typed result, never a raw body; `probe()` reports whether the endpoint is configured | `src/services/ai/` |
| AI surface | the Overview field asks; panel draws idle / three bars / answer / error; footer `model · dev endpoint · ms`; `⌘↵` asks, `Stop`/`esc` abort | `src/pages/Overview.tsx`, `SP-07b` |
| Board scene | pure constants + versioned store (v2, v1 migrated) · ref-driven viewport · 2400 × 1600 workspace | `src/pages/boards/` |
| Files | shared table grammar, keyboard table, tombstones, disabled actions | `659cb2f`, `0eab7c1` |
| Board editing | double-click create, drag with one 6px snap on cards *and* frames, marquee, shift-add, multi-drag, eight handles, delete, 1/10px nudge, 40-step undo | `gestures.ts`, `history.ts`, `useBoardEditor.ts` |
| Board structure | sections with a pill and a count, five card fills, folds, `ref` / `live` rows, object and blank menus, minimap, zoom dock | `SP-06c` commits |
| Board edges | hover anchors, drag to connect, bend, elbow, one/both arrowheads, labels, delete, 24px target at any zoom | `SP-06d` commits |
| Tabs | pure `lib/tabs.ts`; versioned sessionStorage v2; tombstones | `e39d117` |
| Panel / scroll | per-context widths, one global scroll restorer | `f2ec062` |

## Known defects (carried into the subplans)

| # | Defect | Where | Owner SP |
| --- | --- | --- | --- |
| K1 | Account's `Create key` still accepts a click, then explains it cannot | `src/pages/Account.tsx` | SP-08 |
| K3 | Reader title 32px but list meta still mixed sizes | `src/pages/notes.module.css` | SP-05 |
| K5 | Density preference does not persist | `src/pages/Account.tsx` | SP-08 |
| K6 | Two page-local `.notice` recipes remain (down from six) | `account/processes.module.css` | SP-07 / SP-08 |
| K7 | Roaming tabindex in the rail not implemented (arrows only) | `src/shell/Rail.tsx` | SP-09 |
| K9 | Only Processes has a loading state (three static rows); the rest still have none | Files, Notes | SP-09 |

## Validation log

| Date | Check | Result |
| --- | --- | --- |
| 11-07 | `npm run check` | pass |
| 11-07 | `npm run build` | 127.9 KB gzip JS / 10.0 KB CSS |
| 11-07 | CDP suite (16) | 16/16 |
| 11-07 | Font trace | 4 woff2, 0 CJK on English routes |
| 11-07 | `npm run lint` | 0 problems; a deliberate `shell → pages` import fails as designed |
| 11-07 | `npm test` | 8/8 |
| 11-07 | `npm run e2e` | 25/25 (typed tabs, overflow, active-tab visibility, rail arrows) |
| 11-07 | Focus ring (real Tab) | `inset 0 0 0 1px rgb(181,111,80)` on the rail item |
| 11-07 | `npm run lint` (SP-02) | 0 problems |
| 11-07 | `npm test` (SP-02) | 11/11, including `pendingLede(0/1/2)` |
| 11-07 | `npm run e2e` (SP-02) | 37/37; 12 new Overview assertions |
| 11-07 | `npm run build` (SP-02) | CSS 54.5 KB / JS 128.8 KB gzip |
| 11-07 | Zero-needs-input DOM | lede + empty copy both changed; mock restored byte-for-byte |
| 11-07 | `grep accent overview.module.css` | 0 hits; hover is a tint only |
| 11-07 | `npm test` (SP-03a) | 23/23; 12 pure tab-model cases |
| 11-07 | `npm run e2e` (SP-03a) | 44/44; deep link, back/forward, tombstone, two scopes |
| 11-07 | Broken storage payload | app renders normally, malformed tabs dropped |
| 11-07 | `npm test` (SP-03b) | 25/25; room detection and scope switching |
| 11-07 | `npm run e2e` (SP-03b) | 55/55; real drag, width persistence, scroll ±2px, room switch |
| 11-07 | `npm run build` (SP-03b) | CSS 54.7 KB / JS 130.4 KB gzip |
| 11-07 | Column budgets (SP-04a) | 1440: 652px/5 cols/332px name · 1280: 492px/4/272px · 1180: 392px/4/212px; no h-scroll |
| 11-07 | `npm run e2e` (SP-04a) | 61/61; grammar, 44/32 rows, tabular, three widths |
| 11-07 | `npm run e2e` (SP-04b) | 81/81; disclosure, 5 keys, disabled actions, tombstone lifecycle |
| 11-07 | Static honesty checks | `<span onClick>` 0 · apology state 0 · page-local `.notice` 3 |
| 11-07 | `npm run build` (SP-04b) | CSS 55.0 KB / JS 131.0 KB gzip |
| 11-07 | `npm test` (SP-06a) | 48/48; 23 new scene/store cases |
| 11-07 | `npm run e2e` (SP-06a) | 86/86; geometry identical, no numeric scene size outside `scene.ts` |
| 11-07 | Board screenshot diff | before/after md5 identical (`0a1cc6b8…`) |
| 11-07 | `grep 1032\|560 src` | 0 outside `boards/scene.ts` |
| 11-07 | 200-card serialisation | < 20ms |
| 11-07 | `npm test` (SP-06b) | 53/53; 5 viewport-maths cases |
| 11-07 | `npm run e2e` (SP-06b) | 100/100; 30 zoom steps, +-2px anchor, 0 card mutations, 1:1 pan, clamps |
| 11-07 | 150-card pan trace | 148 frames · P50 16.7ms · P95 16.7ms · max 16.8ms · 0 >20ms |
| 11-07 | Zoom screenshots | 10% / 51% / 100% / 400%, grid legible at every step |
| 11-07 | `npm run build` (SP-06b) | CSS 55.2 KB / JS 132.3 KB gzip |
| 11-07 | `npm test` (SP-06c) | 84/84; 31 new geometry, command and store cases |
| 11-07 | `npm run e2e` (SP-06c) | 127/127; 27 new card assertions, real mouse input through CDP |
| 11-07 | Card creation | double-click → card + focused title input at 456px (clamped from a click at 505) |
| 11-07 | Drag fidelity | 160 × 100 scene units dragged → 360/356, ±1px |
| 11-07 | Snap | 4px off c-2's left edge → guide at 40, release lands on 40 exactly |
| 11-07 | Undo | delete of 2 cards restored in one step, z-order `c-1…c-6` intact |
| 11-07 | Resize | handle drag +40px → card width +40px (screen), min 180 / 64 enforced |
| 11-07 | Persistence | 7 cards and the moved position survive a reload through `thylas:board:v1` |
| 11-07 | Reset | sample restored, stored copy removed (`getItem` → null) |
| 11-07 | `npm run build` (SP-06c) | CSS 56.7 KB / JS 138.2 KB gzip |
| 11-07 | Screenshots | `sp06c-selection`, `sp06c-guide`, `sp06c-editing`, `sp06c-created` |
| 11-07 | `npm test` (SP-06c pass 2) | 101/101; distribute keyed by caller index |
| 11-07 | `npm run e2e` (SP-06c pass 2) | 183/183; canvas, fit, sections, fills, folds, menus, edges, storage |
| 11-07 | Resize grips | measured 9px dot / 8px handle at 56% and 100% (constant on screen) |
| 11-07 | Edge target | half-width 12px at 56% and 100%; 9px off the line hits, 20px off misses |
| 11-07 | Edge bar hand-off | clicking a card title with an edge selected leaves `Selected · …` and no bar |
| 11-07 | `npm run build` (SP-06d) | CSS 65.6 KB / JS 478.1 KB (149.4 KB gzip) |
| 11-07 | Screenshots | `.workbuddy/tmp/0{1..9}-*.png`: fit, 100%, marquee, menu, edge, zoomed grips |
| 11-08 | `npm test` (SP-07a) | 127/127; 26 new cases: completion parsing, the shape guard, the status table, body → answer |
| 11-08 | `npm run ai` (SP-07a) | 35/35 over HTTP: dev and preview mounts, no-key 503 with zero upstream hits, 401 / 429 / 500 / garbage / timeout, the 8000-character boundary, GET 405 |
| 11-08 | Key containment | key-shaped string in `src/` 0 and in `dist/` 0; no file under `src/` names the variable — the message that names it is built on the server |
| 11-08 | Timeout branch | 504 after ~1.5 s with `DEEPSEEK_TIMEOUT_MS=1500`; the default stays 30 s |
| 11-08 | Upstream priority | shell env wins over `.env.local` (measured: the check's own key beats the file) |
| 11-08 | `npm run e2e` (SP-07a) | 183/183, unchanged — the middleware does not touch a rendered surface |
| 11-08 | `npm run build` (SP-07a) | CSS 66.1 KB / JS 478.2 KB (149.5 KB gzip) |
| 11-08 | `npm test` (SP-07b) | 136/136; 4 new `probe()` cases incl. unreachable → `null` |
| 11-08 | `npm run ai` (SP-07a/07b) | 38/38; the 429 body is reduced to its sentence, not pasted as JSON |
| 11-08 | `npm run e2e` (SP-07b) | 194/194; 15 new AI-surface assertions, incl. a second dev server with no key |
| 11-08 | Answer latency | 384 ms against a 350 ms stub (+10%); the check bounds it at 250–2000 ms |
| 11-08 | No-execution claim | panel text returns false for `\b(started|is running|process is)\b` |
| 11-08 | `npm run build` (SP-07b) | CSS 67.5 KB / JS 483.7 KB (151.5 KB gzip) |
| 11-08 | Screenshots | `.workbuddy/shots/sp07b-{idle,sending,answer,error}.png` |
| 11-08 | `npm test` (SP-07c) | 159/159; 17 cases over the process vocabulary, 6 over the override store |
| 11-08 | `npm run e2e` (SP-07c) | 209/209; 14 new assertions on filters, capability sets, the simulator, its restore, and the source grep |
| 11-08 | Filter is a link | `?state=needs_input` survives a reload and selects its own tab; `Running 0` still shows its count |
| 11-08 | Capability rule | `run-baseline` draws `[Stop, Pause]`, `run-lit` draws `[Answer, Stop]` — the list drives the buttons |
| 11-08 | Simulated path | `Simulating…` for 700 ms, then `done`; the list row reads `done · simulated · local copy` |
| 11-08 | Apology grep | `grep -rn "Nothing was sent" src` → 0, asserted by reading the source in the run |
| 11-08 | `npm run build` (SP-07c) | CSS 68.2 KB / JS 487.4 KB (153.0 KB gzip) |
| 11-08 | Screenshots | `.workbuddy/shots/sp07c-{all,empty,fail,detail,simulated,advanced}.png` |
| 11-08 | Radius scale (SP-10a) | `grep -rn "border-radius: [0-9]" src` → 0; four steps + pill, declared over the archive's names |
| 11-08 | Radius reach | 40 token call sites moved by changing 3 values; 18 raw values mapped to a step |
| 11-08 | `npm run e2e` (SP-10a) | 209/209 unchanged — a radius is paint, not layout |
| 11-08 | Live DeepSeek call | 200 in 1.98 s, `model: deepseek-flash`; the id `deepseek-chat` now resolves to that model |
| 11-08 | Screenshots | `.workbuddy/shots/sp10a-{overview,files,processes,run,board,notes,account}.png` |

## Next concrete action

1. **SP-10b Typeface** (1 day) and **10c Icons** (0.5 day): Inter in, eight characters out. Then **10d**.
2. **SP-09a Gates** (1 day): `scripts/gates.mjs` with eleven rules (R11 already exists inside `scripts/ai-checks.mjs`), plus the e2e surface coverage. SP-07 is now closed, so every rule has something to check.
3. **SP-08 Account** (0.5 day) is independent; density persistence and the last post-click apology.
4. **Do not start SP-05 until Q-1 (CodeMirror 6) is answered.** Q-4 (persisted board viewport) is still unapproved, so `BoardScene.viewport` stays unread: every visit starts fitted.

## Resolved

| # | Defect | Resolved in | Evidence |
| --- | --- | --- | --- |
| R1 | Object tabs carried no type | SP-01 | every object tab has an svg glyph; e2e assertion |
| R2 | Strip scrolled horizontally / no overflow | SP-01 | measured limit 3–8; e2e "strip does not scroll" passes |
| R3 | Hard-coded "Two processes need a decision" lede | SP-02 | `pendingLede(needsInput().length)`; zero state verified in the DOM |
| R4 | "New workspace" card opened the palette as an apology | SP-02 | card removed; one sentence names the missing workspace service |
| R5 | Intent Start clicked, then apologised | SP-02 | Start disabled with a persistent reason; no post-click banner |
| R6 | A parquet file was shown with a `PDF` glyph | SP-02 | glyph derives from `getFile(id).kind` |
| R7 | Accent-coloured hover text on Overview rows | SP-02 | hover is a tint; zero local accent declarations |
| R8 | Notes panel opened at 340 though the spec said 300 | SP-03b | per-context defaults: notes 300, workspace 340 |
| R9 | An already-expanded workspace row collapsed instead of switching | SP-03b | the row always navigates when it is not active |
| R10 | Dead `/w/:id/settings` route builder | SP-03b | deleted; router and route module both checked |
| R11 | Folder chevron was a `span` with `onClick` | SP-04b | two sibling buttons, `aria-expanded`, keyboard target |
| R12 | Upload / New folder apologised after being clicked | SP-04b | disabled with `title` + persistent reason line |
| R13 | At 1180 `1.2 GB` wrapped and names ellipsised | SP-04a | 430px container step, 11px mono, names fully readable |
| R14 | Table-head, label and banner recipes were copied per page | SP-04a/04b | `grammar.tableHead` / `label` / `banner` / `limit` consumed |
| R15 | Scene dimensions were hardcoded in TSX and CSS | SP-06a | one source in `boards/scene.ts`; injected as CSS variables |
| R16 | The board claimed 14 cards and rendered 6 | SP-06c | every count now derives from the scene; e2e asserts `6 CARDS` and no `14 cards` |
| R17 | Section / Edge / Card tools did nothing and apologised after the click | SP-06c | toolbar holds Select, Undo, Redo — all real; no "deferred" copy anywhere |
| R18 | A board could not be written to | SP-06c | create, drag, snap, marquee, resize, delete, nudge, undo all through one command path |
| R19 | "New board" apologised after being clicked | SP-06c | disabled with `title` + persistent `boards-limit` reason |
| R20 | Mock cards overlapped each other and spilled past their frame | SP-06c | frames are all 760 tall, column pitch 145; screenshot at fit shows no overhang |
| R21 | Status bar printed a zoom percentage that only updated on re-render, next to a live one | SP-06c | the status shows counts; zoom lives in the dock (`Boards.tsx`) |
| R22 | Grips and link dots shrank with the canvas (4px at 56%) | SP-06c | `--hud-shrink` on the scene; dot measured 9px at 56% and 100% (D-032) |
| R23 | `distributeRects` wrote positions in sort order, so objects swapped places | SP-06c | keyed by the caller's index; unit test with an out-of-order input |
| R24 | The edge bar covered the card it pointed at and ate its click | SP-06d | bar docked above the status line (D-033); e2e asserts the title is clickable |
| R25 | The edge target shrank to 6px half-width at 56% (`non-scaling-stroke` is ignored by hit testing) | SP-06d | width `calc(24px * --hud-shrink)`; half-width measured 12px at 56% and 100% (D-034) |
| R26 | Discarding an empty card left its edges on the board | SP-06c | the discard commit drops the edges too |
| R27 | A clickable edge label stole the click from the card under it | SP-06d | labels stay inert; the line's band takes the click (D-035) |
