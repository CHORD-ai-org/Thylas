# Thylas — UI MVP Master Plan

**Status:** program of record. Supersedes `plan/` (12 file-level sub-plans) and `docs/planning/ui-mvp-plan.md` (the 20-day visual sweep). Both described a typography/state pass; this program is broader: Notes and Whiteboard become real working surfaces, and AI enters through a server-side path.
**Date:** 2026-11-07
**Owner:** founder. Execution: agent.
**Companion documents:** `PROGRESS.md` (truth about the repo), `DECISIONS.md` (every deviation, with reasons), `subplans/`.
**Design authority:** `docs/brand/branding-desk.md`, `docs/design/{typography,interaction-contract,motion-guidelines,spatial-language}.md`.
**Experience authority (added 2026-11-09):** `docs/design/optimization-plan.md` (the six-wave visual + interaction program), `QUALITY-BAR.md` (eight scored dimensions, five tests), `docs/design/interaction-lifecycles.md` (per-feature states), `docs/research/eden-benchmark.md` (what the reference demonstrates and what it does not). A unit that passes its own acceptance but fails the quality bar is not done.
**Technical authority:** `docs/architecture/tech-stack.md` — where this plan and that document disagree, the document wins and `DECISIONS.md` records why.

---

## 1. MVP definition

A coherent, visually mature workspace that a person can actually work in for an hour: find yesterday's work, open files, write a Markdown note with links, arrange cards on a board, watch a mock process change state, and ask DeepSeek one question — with no fake controls, no dead buttons, and no state that silently disappears.

That is narrower than the product vision and wider than the current build. The current build has the right shell and seven read-only surfaces; the MVP makes **Notes** and **Whiteboard** real, gives **AI** a secure path, and finishes the state matrix everywhere.

### MVP acceptance (from the brief, restated as testable)

| # | Criterion | How it is checked |
| --- | --- | --- |
| 1 | Coherent, polished shell | Screenshot at 1280/1440 + rail/strip/panel state sheet |
| 2 | Overview is a useful starting point | Resume path ≤ 15 s; zero stat cards |
| 3 | Workspace navigation and tabs coherent | Tab suite: open/close/overflow/persist/cross-scope |
| 4 | Files browsable and openable | Tree + table + preview tab + keyboard |
| 5 | Notes/Documents Markdown-first workflow | Create, edit, `[[link]]`, backlinks, autosave, conflict |
| 6 | Whiteboard is a spatial working environment | 60-card board: drag, zoom-to-pointer, connect, undo |
| 7 | Processes coherent | Five states, filters, run detail, capability-gated controls |
| 8 | DeepSeek through a server-side path | Key never in the bundle; one round trip works; failure is legible |
| 9 | Account and basic settings | Profile, preferences (density), usage display, keys absent |
| 10 | No fake controls | Click audit: nothing apologises after the fact |
| 11 | Major states handled | Empty/loading/error/running/succeeded per surface |
| 12 | Tested as an integrated system | E2E: 3 paths + cross-surface navigation |
| 13 | Quiet Computationalism | Brand checklist (`branding-desk.md` §13) |
| 14 | No critical regressions | Full gate run + screenshot diff |
| 15 | **Product experience holds up** (added 11-09) | Every surface ≥ 20/24 on `QUALITY-BAR.md`; no dimension ≤ 1; zero unexplained `gap` in `interaction-lifecycles.md` for Files / Notes / Board / AI |

---

## 2. Scope

| Capability | Class | Note |
| --- | --- | --- |
| Shell, rail, tabs, panel, palette, workspace switching | **Required** | Exists; needs typed tabs, overflow, states |
| Overview with intent entry | **Required** | Intent is the AI entry point; it must not pretend to submit before SP-07 |
| Files: tree, table, preview, selection | **Required** | Mock-backed; no upload |
| Notes: Markdown, wikilinks, backlinks, folders, search | **Required** | New editor (CodeMirror 6, see D-002) |
| Documents: a second note type with a reading layout | **Optional** | Same engine, different default view; only if SP-05 has slack |
| Whiteboard: cards, sections, edges, drag, zoom, undo, persistence | **Required** | Rebuilt on the HeptaBase bar (SP-06) |
| Processes: mock states, filters, run detail | **Required** | WAM never called |
| AI: DeepSeek single-turn via server endpoint | **Required** | Dev middleware + documented production path |
| Account: profile, preferences, usage display | **Required** | Thin; no billing, no org admin |
| Lexical search across notes | **Optional** | Palette filter first; full index only if cheap |
| Command palette actions beyond navigation | **Optional** | New note, new board |
| Upload to storage, folder creation, board sharing | **Deferred** | Needs services (N3/N4) |
| WAM integration, run submission, artifact ingestion | **Deferred** | Explicitly out of this MVP |
| Real-time collaboration, Yjs | **Deferred** | Version-based save only |
| Org administration, billing, invoicing | **Deferred** | Account shows provider values |
| Mobile layout, dark mode, i18n translation | **Out of scope** | Confirmed v1 boundaries |
| Plugin system, micro-frontends, SSR | **Out of scope** | No requirement exists |

---

## 3. Architecture overview

```
           ┌────────────── app/ ──────────────┐
           │ router · providers · error       │
           └───────┬──────────────┬───────────┘
                   │              │
        ┌──────────▼───┐   ┌──────▼──────────┐
        │  shell/      │   │   pages/        │  one per surface
        │ rail strip   │   │ overview files  │
        │ panel palette│   │ notes board ... │
        └──────┬───────┘   └──────┬──────────┘
               │                  │
        ┌──────▼──────────────────▼─────────┐
        │ components/{ui,content}           │
        └──────┬────────────────────────────┘
               │
   ┌───────────▼──────────┐   ┌────────────────────┐
   │ services/            │   │ lib/ (pure + types) │
   │ http · ai · files    │   │ routes tabs format  │
   └───────────┬──────────┘   └────────────────────┘
               │
        ┌──────▼───────────────┐
        │ server/ (dev + prod) │  /api/ai · /api/files (later)
        └──────────────────────┘
```

Rules that the build must enforce (`eslint.config.js`, SP-00):

1. `components/*` imports no `pages/`, `shell/`, `services/`.
2. `shell/` imports no `pages/`.
3. `pages/*` never import each other.
4. Only `services/*` knows a wire shape; only `lib/types.ts` knows a domain shape.
5. `lib/` imports nothing from `src/`.
6. No component decides anything WAM owns (retry, priority, remaining time).

**Stack in force** (see `tech-stack.md`; deviations from the brief in `DECISIONS.md` D-001…D-005):

| Layer | In force | Brief said |
| --- | --- | --- |
| Framework | **Vite SPA + React 19** | Next.js App Router |
| Router | react-router 8 (from 7.18.5) | — |
| Styling | CSS Modules + tokens | same |
| Primitives | hand-built; React Aria when overlays land | Radix UI |
| Server state | none yet; TanStack Query at first endpoint | Query |
| Client state | context + `useState` | Zustand |
| Notes editor | **CodeMirror 6** (Markdown-first) | CodeMirror 6 ✓ (supersedes Tiptap) |
| Canvas | custom DOM+SVG | tldraw, conditional |
| Drag | pointer events; dnd-kit only for lists | dnd-kit |
| Icons | hand-drawn 16px set | Lucide |
| Validation | Zod at the boundary | Zod ✓ |
| Tests | Vitest + Playwright | same |
| Backend | dev Node middleware; no Supabase yet | Supabase where required |
| AI | DeepSeek via same-origin `/api/ai` | same |

---

## 4. Visual and interaction principles

Not restated here — they are already executable:

| Concern | Authority |
| --- | --- |
| Colour, type, geometry, voice | `docs/brand/branding-desk.md` §3–§9 |
| Type scale and loading | `docs/design/typography.md` |
| States, navigation, tabs, honesty | `docs/design/interaction-contract.md` |
| Zones, scrolling, responsive | `docs/design/spatial-language.md` |
| Motion limits | `docs/design/motion-guidelines.md` |
| Known failures to avoid | `docs/design/visual-audit.md` |

Three rules the program adds because they are easy to lose while building fast:

1. **One accent per region.** Terracotta = state or action. Never hover text.
2. **Density is per surface, grammar is shared.** Files 32px rows, Overview 44px; same labels, same table head, same banner.
3. **Honesty before invention.** If a service is missing, the control is disabled with a reason or absent — never a click that apologises.

---

## 5. Technical assumptions

| # | Assumption | If false |
| --- | --- | --- |
| T1 | CodeMirror 6 can carry Markdown + `[[wikilinks]]` + backlink index without a framework | Fall back to a textarea + preview; notes still ship |
| T2 | Canvas at 60–150 cards holds 60fps in DOM when hit-testing is one pointer state machine | `<canvas>` renderer; or cap board size |
| T3 | A dev-time Node middleware is an acceptable "server-side" path for DeepSeek in the MVP | Needs a real host before any demo outside localhost |
| T4 | `sessionStorage` is enough for tab/board restoration in the MVP | IndexedDB for boards if payload > 2 MB |
| T5 | Mock data + local persistence is honest if labelled | Must label per surface, not in a footnote |

---

## 6. Subplan dependency graph

```
SP-00 foundation
   │
SP-01 shell ─┬─ SP-02 overview ─┐
             ├─ SP-03 workspace ─┼─ SP-04 files ─┬─ SP-05 notes ─┐
             │                   │              └─ SP-06 board ─┼─ SP-09 integration
             └───────────────────┴─ SP-07 ai+processes ──────────┤
                                    SP-08 account ───────────────┘
```

`SP-04` precedes `SP-05`/`SP-06` because both reference files; `SP-03` precedes everything workspace-scoped because it owns restoration semantics.

| SP | Name | Depends on | Estimated effort |
| --- | --- | --- | --- |
| SP-00 | Foundation | — | 1.5 d (typography done) |
| SP-01 | Application shell | SP-00 | 2 d |
| SP-02 | Overview | SP-01 | 1 d |
| SP-03 | Workspace core | SP-01 | 1.5 d |
| SP-04 | Files and resources | SP-03 | 1.5 d |
| SP-05 | Notes and documents | SP-04 | 4 d |
| SP-06 | Whiteboard | SP-04 | 5 d |
| SP-07 | AI and processes | SP-03 | 2.5 d |
| SP-08 | Account and settings | SP-01 | 0.5 d |
| SP-09 | Integration and polish | all | 2 d |

**Execution units.** Each parent is split into units of ≤ 1.5 days with their own acceptance; the canonical list, status and order is [`subplans/INDEX.md`](subplans/INDEX.md). Eleven units remain under five parents (SP-02, SP-03a/b, SP-04a/b and SP-06a/b are complete); parent documents keep the UX/visual specification, and each unit names the parent section it implements.

Roughly 21 working days for one engineer; SP-05 and SP-06 are the two that can double.

---

## 7. Integration risks

| # | Risk | Why it bites | Mitigation |
| --- | --- | --- | --- |
| I1 | Two navigation truths (URL + tabs) | Every "wrong page after close" bug | One writer, reconciliation tested in SP-03 |
| I2 | Editor save path | First write path; conflicts + tab close | Version + 409 + dirty-tab guard before shipping the editor |
| I3 | Canvas engine regression | HeptaBase measured: stale-closure wheel collapse, effect rebinding drops frames | Read `HeptaBase RE/Plan/06-画布交互改造.md` §0 before writing SP-06; port the fixed patterns, not the bugs |
| I4 | Secret leakage in the AI path | A key in a bundle cannot be un-leaked | Key only in server middleware; the client posts text to `/api/ai`; add a grep gate for `DEEPSEEK` in `src/` |
| I5 | Scope creep from "documents" + "notes" | Two products in one editor | One engine, two presets; documents optional (SP-05) |
| I6 | Style drift while adding surfaces | Six banner copies already happened once | Shared `grammar.module.css` in SP-00; audit in SP-09 |

---

## 8. Validation strategy

Every subplan ends with the same five checks, then its own acceptance list.

| Check | Command / method | Fails when |
| --- | --- | --- |
| Types | `npm run check` | any error |
| Build | `npm run build` | bundle > 160 KB gzip JS / 60 KB CSS |
| Lint zones | `npm run lint` | a forbidden import |
| Unit | `npm test` | any failure |
| Interaction | `npm run e2e` (CDP/Playwright, starts its own server) | any assertion |
| Visual | screenshots at 1280×800 and 1440×900 | clipping, scrollbars, shift on panel toggle |
| Hand-check | keyboard-only path through the surface | focus lost, control unreachable |

A subplan is `Completed` only when its acceptance list passes **and** the five checks pass; otherwise it is `In Progress` with the defect written down in `PROGRESS.md`.

---

## 9. Completion criteria

The program is complete when:

1. Every `Required` item in §2 works with mock or local data, and every mock is labelled in the UI.
2. All fourteen acceptance criteria in §1 pass with evidence linked from `PROGRESS.md`.
3. `npm run check && npm run build && npm run lint && npm test && npm run e2e` is green from a clean clone.
4. Seven screenshots at 1440 are committed, and the logo-covered identity test passes with three reviewers.
5. No `Deferred` capability is presented as working anywhere in the UI, in copy, or in docs.
6. `DECISIONS.md` lists every deviation from the brief and from `tech-stack.md`, with a reason.

Anything not met is reported as deferred, in writing, and needs approval — not a quiet completion.
