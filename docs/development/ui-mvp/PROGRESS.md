# Progress

**Rule of this file:** it describes the repository, not intentions. If a line here disagrees with `git log` or the running app, the file is wrong.

Last updated: 2026-11-13 18:05 (Backend Phase 1 **complete** P1-0…P1-8: AUDIT.md rewritten against running code, docs/README.md indexes backend/, check + 44 files / 379 tests + 14 api:check + 302/302 e2e green; Coworker page shipped; Coworker foundation docs (D-054); Artifact page (D-053); Chat (D-051); backend docs (D-052)).

---

## Status board

Units are the unit of execution: one branch, one commit, ≤ 1.5 days. The canonical list with order and links is [`subplans/INDEX.md`](subplans/INDEX.md).

| Unit | Parent | Status | Days | Depends | Note |
| --- | --- | --- | --- | --- | --- |
| SP-00 Foundation | — | **Completed** 11-07 | 1.5 | — | lint zones, Vitest 8, e2e 25, grammar recipes |
| SP-01 Application shell | — | **Completed** 11-07 | 2.0 | SP-00 | typed tabs, measured overflow, rail keys, states |
| SP-02 Overview | — | **Completed** 11-07 | 1.0 | SP-01 | computed lede + zero state, honest disabled Start, shared section tick; its "no new-workspace card" is reversed by SP-11 |
| SP-03a Tab model | SP-03 | **Completed** 11-07 | 1.0 | SP-01 | pure `lib/tabs.ts` 12 tests, v2 persistence, tombstones, cross-scope isolation |
| SP-03b Panel and restore | SP-03 | **Completed** 11-07 | 0.5 | SP-03a | per-context widths, named-region scroll restore, room-preserving switch, settings deleted |
| SP-04a Table grammar | SP-04 | **Completed** 11-07 | 0.75 | SP-03b | grammar adoption, measured 3-width budgets, no truncation |
| SP-04b File interactions | SP-04 | **Completed** 11-07 | 0.75 | SP-04a | real disclosure, 5-key table, tombstone, honest disabled actions |
| SP-05a Note model | SP-05 | **Completed** 11-08 | 1.0 | SP-04a | Markdown note + per-note store + link parser + backlinks + seed migration |
| SP-05b Editor and save | SP-05 | **Completed** 11-08 | 1.75 | SP-05a | CodeMirror 6 on demand, idle save, conflict review, dirty guard |
| SP-05c Note library | SP-05 | **Completed** 11-08 | 1.25 | SP-05b | roving tabindex, body search, `[[` picker, links out and backlinks, delete |
| SP-06a Scene model | SP-06 | **Completed** 11-07 | 0.75 | SP-04a | pure `scene.ts`, versioned `store.ts`, 23 tests, byte-identical render |
| SP-06b Viewport | SP-06 | **Completed** 11-07 | 1.25 | SP-06a | ref + rAF zoom/pan, 30/30 steps, 150-card P95 16.7ms |
| SP-06c Cards | SP-06 | **Completed** 11-07 | 1.5 | SP-06b | sections, five fills, folds, eight handles, menus, minimap; second pass against the reference |
| SP-06d Edges | SP-06 | **Completed** 11-07 | 1.5 | SP-06c | anchors, connect, bend, elbow, arrows, labels, 24px target at any zoom |
| SP-07a AI endpoint | SP-07 | **Completed** 11-08 | 1.0 | SP-03b | `POST /api/ai` in dev *and* preview, seven error kinds, key never leaves the server, 35 offline assertions |
| SP-07b AI panel | SP-07 | **Completed** 11-08 | 0.75 | SP-07a, SP-02 | four states, abort, retry by `retryable`, footer meta, 15 e2e assertions |
| SP-07c Process states | SP-07 | **Completed** 11-08 | 0.75 | SP-03b | URL filters, capability-gated controls on a local copy, 700 ms simulator, empty/loading/error |
| SP-11 Workspaces | — | **Completed** 11-09 | 1.0 | SP-02, SP-05a | create + delete, derived counts, tombstones, notes and tabs go with it |
| Compute | — | **Superseded** by Compute v2 (D-050) | — | — | the Resources/Providers/Find IA lives in git history; honesty rules carried forward |
| Compute v2 | — | **Completed** 11-09 | 1.5 | D-048, SP-01 | Backend/Instance/Workload/Listing model, Overview/Backends/Run/Instances/Activity/Marketplace; Run = Compute Selection (manual + recommended, queued-not-started); deterministic tests; 27 unit + 17 e2e. Docs: `docs/development/compute-v2/` |
| User & Connect | — | **Completed** 11-09 | 1.0 | SP-01, Compute | User replaces Account (D-049): identity/preferences/environment/security, real landing + density + default-workspace prefs; Connect: Connected/Discover/Custom, four honest tiers, no fake OAuth; 20 unit + 13 e2e. Docs: `docs/development/user-connect/` |
| SP-08 Account | — | **Superseded** by User & Connect (D-049) | — | — | density persistence shipped inside User |
| Chat | — | **Completed** 11-09→11-11 | 1.5 | SP-07, D-051 | /chat page + resizable dock, one ChatCore; safe markdown renderer; SSE passthrough stream endpoint; context bar + artifacts-save-as-note; 16 unit + 10 e2e. Docs: `docs/development/chat/` |
| Backend docs | — | **Completed** 11-11 | 0.5 | D-052 | audit + overview/domain-models/standards/integration docs; `server/config.ts` extraction; SSE passthrough fix. Docs: `docs/development/backend/` |
| Artifact foundation | — | **Completed** 11-12 | 0.75 | D-053, D-052 | product docs: definition, taxonomy, user-defined objects (USOS), lifecycle, governance, canonical reuse, methodology, external integrations; 23 open questions registered. Docs: `docs/product/artifacts/` |
| Artifact page | — | **Completed** 11-12 | 0.75 | D-053 | library (hybrid, views+filters), type-adaptive detail (sections, relations, versions, edit→new version), 5-path creation; Coworker action opens the real chat dock; 9 store tests + 12 e2e. Docs: `docs/development/artifacts/` | product docs: definition, taxonomy, user-defined objects (USOS), lifecycle, governance, canonical reuse, methodology, external integrations; 23 open questions registered. Docs: `docs/product/artifacts/` |
| Coworker foundation | — | **Completed** 11-12 | 0.75 | D-054, D-052 | product docs: definition, identity & responsibilities, workspace & artifact relationships, configuration, working experience, WAM boundary, lifecycle; MVP scope + 9 open questions. Docs: `docs/product/coworkers/` |
| Coworker page | — | **Completed** 11-12 | 0.75 | D-054 | directory (views+search), working interface (real ChatCore conversation + honest side panels), creation, config (responsibilities/memberships/status); 9 store tests + 11 e2e. Docs: `docs/development/coworkers/` |
| SP-10 Visual quality | — | **In progress** — 10a 11-08; 10b/c 11-09; 10d states + 10e a11y 11-09; 10f.1 partial | 6.75 | SP-07 | radius, Inter ramp, glyphs→paths, Boards grid, four states, inset focus, palette focus trap + restore, one control per action; 10d density/loading, 10f.1 remainder, 10f.2–4 remain |
| SP-09a Gates + e2e | SP-09 | Not Started | 1.0 | SP-02…SP-08 | 10 rules, ≥ 30 assertions |
| SP-09b Visual audit | SP-09 | Not Started | 1.0 | SP-09a | screenshots, a11y, identity test |
| Backend Phase 1 · P1-0…P1-4 | — | **Completed** 11-12 | 1.5 | D-055 | D-055 recorded; one router, two hosts; typed config; Drizzle chat tables + migration; `conversations` CRUD with a shared `src/lib` contract, 3 real-HTTP tests; 33 files / 323 tests green; SPA still served. Real Postgres CLI + CHORD IdP pending. Docs: `docs/development/backend/PHASE-1.md` |
| Backend Phase 1 · next steps 1–2 | — | **Completed** 11-12 | 0.5 | D-055 | `scripts/api-checks.mjs` + `npm run api:check` (7 checks on free ports); `src/services/conversations/client.ts` + 6 tests; 34 files / 329 tests green. Docs: `docs/development/backend/PHASE-1.md` §7 |
| Backend Phase 1 · P1-5 | — | **Completed** 11-13 | 0.5 | D-056 | Replaceable session source (dev cookie / pending-idp fail closed), `GET /api/session` membership flags, 401 + 403 on conversations, list filtered by membership; 36 files / 340 tests + 10 api:check green. Real IdP verifier pending. Docs: `docs/development/backend/PHASE-1.md` |
| Backend Phase 1 · P1-6 | — | **Completed** 11-13 | 1.0 | D-057 | Local `STORAGE_DIR` byte store, `files` table + `0001` migration, 5 `/api/files*` endpoints with 401/403, streamed 100MB cap, soft delete, rewired Files copy; 40 files / 359 tests + 12 api:check green. Presigned upload and real Postgres deferred. Docs: `docs/development/backend/P1-6.md` |
| Backend Phase 1 · P1-7 | — | **Completed** 11-13 | 1.0 | D-058 | One `src/lib/chat.ts` contract, `0002` migration, `GET\|PUT /api/chat/state` on existing tables with 409 version guard, dual-mode store (`local` default byte-identical), one-time envelope import; UI files zero diff, `chat.test.ts` untouched; 44 files / 379 tests + 14 api:check green. Real-DB sync and dev-cookie injection pending. Docs: `docs/development/backend/P1-7.md` |
| Backend Phase 1 · P1-8 | — | **Completed** 11-13 | 0.25 | — | `AUDIT.md` rewritten against running code (23 server files, 7 paths / 16 operations, 3 tables, real 401/403/503 responses, 9 stale claims listed with line numbers (3 corrected in place); `docs/README.md` indexes `backend/`; `ROADMAP.md` status current. `check` / 44 files 379 tests / 14 api:check / 302 e2e all green; 2 pre-existing lint errors remain. Docs: `docs/development/backend/AUDIT.md` |

10b–10f are sequenced by `docs/design/optimization-plan.md` (W0–W6, 6.5 days including 0.25 doc debt, per-wave exit evidence).

Remaining: **6.25 days** for SP-10 (10b–10f). 10f is 3.25 of them; see `QUALITY-BAR.md` §4 for the four surfaces it has to lift. Critical path: SP-09a → SP-09b; SP-08 and the rest of SP-10 are independent. SP-05 is closed.

---

## What actually exists today

| Area | State | Evidence |
| --- | --- | --- |
| Build | Vite 6.4.5, React 19.3.1, react-router-dom 7.18.5, TypeScript 5.7.3 | `package.json`, `npm ls` |
| Routes | 15, all mounted | `src/app/routerChildren.tsx` |
| Surfaces | 9 screens render | screenshots in `.workbuddy/shots/` |
| Tabs | Open/close/persist, rooms pinned | CDP suite 16/16 |
| Typography | Plex/Noto self-hosted, 7 steps, no serif | `cf01df0`, specimen page |
| Data | Files, boards and processes are mock; **notes are real** — Markdown, per-note keys, seeded from `mock.ts` on first run | `src/state/notes.ts` |
| Tests | legacy 16-assertion smoke script, superseded by the committed suite | `.workbuddy/tmp/cdp.mjs` |
| Lint | ESLint 10 + `typescript-eslint`, layering zones; `npm run lint` clean | `eslint.config.js` |
| Unit tests | Vitest 5, 127 assertions: scene maths, store, history, gestures, tabs, routes, selectors, AI contract | `src/**/*.test.ts` |
| E2E | 183 assertions, self-starting dev server, fails the run on a page error | `scripts/ui-checks.mjs` |
| AI endpoint | `POST /api/ai` mounted in `dev` and `preview`; seven failure kinds; the key is read only by the server | `server/ai.ts`, `src/lib/ai.ts` |
| AI client | `ask(prompt)` returns a typed result, never a raw body; `probe()` reports whether the endpoint is configured | `src/services/ai/` |
| AI surface | the Overview field asks; panel draws idle / three bars / answer / error; footer `model · dev endpoint · ms`; `⌘↵` asks, `Stop`/`esc` abort | `src/pages/Overview.tsx`, `SP-07b` |
| Note writing | read mode by default; `Edit` mounts CodeMirror as a separate chunk; 800 ms idle save; conflict review; dirty-tab guard; `Esc` leaves the editor | `src/pages/notes/`, `SP-05b` |
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
| 11-08 | `npm test` (SP-05a) | 211/211; 33 on the Markdown layer, 14 on seeds and store, 5 on relative time |
| 11-08 | Link parsing | `[[A\|B\|C]]` → alias `B\|C`; `[[]]` rejected; fenced code excluded from both parsing and backlinks |
| 11-08 | Backlinks | two sources resolve to two ids; a personal note cannot link into a workspace; self-links excluded |
| 11-08 | Store | stale `version` returns the stored note; a broken payload costs one note, not the library |
| 11-08 | `npm run e2e` (SP-05a) | 209/209 unchanged — the notes rewrite did not touch the shell |
| 11-08 | `npm run build` (SP-05a) | CSS 69.1 KB / JS 492.1 KB (155.0 KB gzip) |
| 11-08 | Screenshots | `.workbuddy/shots/sp05a-{list,reader,links}.png` |
| 11-08 | `npm test` (SP-05b) | 211/211 unchanged — the editor has no pure logic to unit-test; its behaviour is asserted in the browser |
| 11-08 | `npm run e2e` (SP-05b) | 216/216; seven new assertions: editor mounts with a name, typing saves, reload keeps it, Esc exits, a dirty tab asks, the second press closes |
| 11-08 | Editor accessibility | `role=textbox`, `aria-label="Note body, Markdown"`, `aria-multiline=true`, line box measured at 16px/26px |
| 11-08 | Conflict | a write behind a live editor produces `Not saved — this note changed elsewhere` and three actions; Load theirs replaces the document |
| 11-08 | Bundle | shell 157.1 KB gzip, editor 174.3 KB as a lazy chunk (was 321.3 KB in one file) |
| 11-08 | Screenshots | `.workbuddy/shots/sp05b-{edit,conflict,dirty}.png` |
| 11-08 | `npm run e2e` (SP-05c) | 225/225; nine new assertions: body search, empty search naming the term, arrow keys, chip states, both panel directions, dangling create, backlink count, delete confirmation |
| 11-08 | Search reach | "tokenizer" returns 2 of 6 — one match is in a body, the other in a title |
| 11-08 | Dangling link | `[[Ghost note]]` renders dashed, and pressing it creates that note and opens it |
| 11-08 | Backlink | after linking Method → Questions, the target reads `Linked from (1)` naming Method |
| 11-08 | Delete | inline confirmation, `There is no undo`, then the list returns without the note |
| 11-08 | Screenshots | `.workbuddy/shots/sp05c-{links,search,backlinks,delete}.png` |
| 11-09 | `npm test` (SP-11) | 228/228; 17 store cases — derived counts, trim, blank, too long, case-insensitive duplicate, reload, tombstone, object filtering, note deletion, hand-edited payload |
| 11-09 | `npm run e2e` (SP-11) | 234/234; 9 new — create, duplicate refusal, landing inside, empty state, card counts, delete confirm, delete effect, deleted URL |
| 11-09 | Deleted contents | `filesIn`, `boardsIn`, `processesIn`, `getFile`, `getProcess`, `foldersIn`, `recent()`, `needsInput()` all empty for a tombstoned workspace; asserted in `workspaces.test.ts` |
| 11-09 | Counts | `Research` reads `8 files · 2 boards · 9 processes` from the data, not from the sample's declared `counts` (which said 5 notes for a workspace holding 2) |
| 11-09 | `npm run build` (SP-11) | shell 156.2 KB gzip; editor chunk unchanged |
| 11-09 | Screenshots | `.workbuddy/shots/sp11-{grid,form,duplicate,empty,confirm,hover}.png` |
| 11-09 | States measured (10d) | 41 interactive classes, forced through CDP: hover 11 → 4 (3 disabled, 1 nested), active 31 → 2 (1 disabled, 1 scroll container), focus 0 → 0 |
| 11-09 | Focus defect | the global outline is offset 1px and was clipped on all four sides of a row inside a scroll container; rows now draw an inset ring (`grammar.focusInside`) |
| 11-09 | Press | one global `translateY(1px)`, gated by `prefers-reduced-motion`; colour stays local (`--tint-sel`) |
| 11-09 | Recently row | hover was `color: var(--accent)` on the label — accent used for hover; replaced by the shared inset tint |
| 11-09 | `npm run e2e` (10d) | 237/237; 3 new: a process row, a filter chip and a rail row each answer hover, press and focus, forced and compared |
| 11-09 | Screenshots | `.workbuddy/shots/sp10d-{hover,active,focus,disabled}.png` |
| 11-09 | Palette trap (10e) | 8 real Tabs all land inside `[role=dialog]`; measured with `Input.dispatchKeyEvent`, not a synthetic event |
| 11-09 | Focus restore (10e) | `Escape` → `document.activeElement` is `Search or jump to (Ctrl K)`, the control that opened it |
| 11-09 | Palette semantics | `role=combobox`, `aria-label="Search commands"`, `aria-activedescendant` → an existing option with `aria-selected=true` |
| 11-09 | Escape bug, found by the fix | it was bound to the input, so after tabbing to an option the dialog could not be closed from the keyboard |
| 11-09 | Rail names | `"Research, personal workspace, 1 need you"` — a sentence, not `"ResearchPERSONAL1"` |
| 11-09 | Duplicate controls | `Collapse sidebar` ×2 → 1 (the wordmark icon removed); the strip's `⌘K` is a hint while the rail is open |
| 11-09 | `npm run e2e` (10e) | 242/242; 5 new: combobox semantics, 8-Tab trap, Escape + restore, rail sentence, one control per named action |
| 11-09 | Screenshots | `.workbuddy/shots/sp10e-{palette,tabbed,returned}.png` |
| 11-09 | Compute unit tests | 22 cases in `src/data/compute.test.ts`; connection ≠ availability, no metrics when unreachable, ranking order, seed integrity |
| 11-09 | Compute e2e | 11 assertions: rail entry, pool counts, unreachable machine has no numbers, unknown filter = 2 rows, add failure/success, find, accept, queued run, stop 3→2, no-match |
| 11-09 | Compute responsive | 1440 and 1024: zero overflow; 390 is blocked by the fixed rail (shell gap G1), not by Compute |
| 11-09 | Compute bundle | main JS 180.60 KB gzip (was 156.2); the five screens are not lazy-loaded yet |
| 11-09 | Screenshots | `.workbuddy/shots/compute-{overview,resources,detail,providers,workloads,find,add}.png` |

## Next concrete action

1. **SP-10d surface and 10e accessibility**, then **10f.1** (Overview split, Processes panel, Files budget) — `optimization-plan.md` W0–W6 has the sequence and `QUALITY-BAR.md` §4 the four surfaces it has to lift.
2. **SP-09a Gates** (1 day) after the visual phase; every rule then has a finished surface to check.
3. **SP-08 Account** (0.5 day) is independent; density persistence and the last post-click apology.
4. **Q-1 no longer blocks anything** — CodeMirror 6 shipped in SP-05b, so the row is answered by the code. Q-4 (persisted board viewport) is still unapproved, so `BoardScene.viewport` stays unread: every visit starts fitted.

## Resolved

| # | Defect | Resolved in | Evidence |
| --- | --- | --- | --- |
| R1 | Object tabs carried no type | SP-01 | every object tab has an svg glyph; e2e assertion |
| R2 | Strip scrolled horizontally / no overflow | SP-01 | measured limit 3–8; e2e "strip does not scroll" passes |
| R3 | Hard-coded "Two processes need a decision" lede | SP-02 | `pendingLede(needsInput().length)`; zero state verified in the DOM |
| R4 | "New workspace" card opened the palette as an apology | SP-02 | card removed; **reversed in SP-11** — the card returns because it now creates a workspace (D-045) |
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
