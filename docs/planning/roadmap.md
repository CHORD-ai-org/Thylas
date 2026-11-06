# Thylas — Development Roadmap

**Status:** proposed.
**Date:** 2026-11-07
**Depends on:** `docs/planning/file-plan.md` (what is built), `docs/product/definition.md` §11 (what v1 must close), `docs/architecture/application.md` §9 (unknowns).

Estimates are person-weeks for one experienced frontend engineer, working on this and nothing else. They are ranges because the two largest items (canvas, WAM integration) depend on facts nobody has yet.

---

## 1. Order, and why it is not the obvious one

The instinct is: shell → files → notes → board → processes → account. That order delays the only thing that proves the product is worth building.

The order here is chosen by **what invalidates the product**, not by what is easy:

```
M0 shell ──▶ M1 tabs/session ──┬──▶ M2 files ──┐
                               │               ├──▶ M4 processes (live) ──▶ M5 account ──▶ M6 production
                               └──▶ M3 notes/board ──┘
```

**M4 is deliberately not last.** A workspace with files and no delegated work is a file manager. The hypothesis in the product definition — *that people will hand over multi-hour work* — is only tested when a run can be submitted and watched. If that hypothesis is wrong, M3's six weeks were spent on a product nobody wanted.

**M3 is split in two.** Notes are cheap and are needed by M4 (an artifact can be a note). The canvas is the most expensive single item and validates nothing about delegation. If time is short, ship M3a and defer M3b — see §5.

---

## 2. Milestones

### M0 · Shell and rules

| | |
| --- | --- |
| **Objective** | A navigable application with no data, and the layering rules enforced from day one |
| **Time** | 1–1.5 weeks |
| **Scope** | 9 root files + 25 src: `app/*` minus guards, `shell/AppShell`, `shell/rail/*`, `layouts/PlainLayout`, `components/ui` minus Skeleton, `styles/*` |
| **Included** | Four-zone layout at 1440×900 · rail with five areas, collapsible workspace group · all 15 routes with placeholder pages · route error and 404 · tokens wired · ESLint zone rules |
| **Excluded** | Any data, tabs, panel, auth, canvas, editor |
| **Depends on** | Nothing. This can start today |
| **Deliverable** | `npm run dev` starts; every rail row changes URL and view; no page scrollbar at 1440×900 |
| **Acceptance** | (1) Every sidebar row maps to a URL — verified by clicking all of them (2) layout holds at 1280, 1440, 1920 without a horizontal scrollbar (3) `eslint` fails if `components/ui` imports `features/*` (4) rail collapse persists across reload |
| **Risk** | Low. The layout was already validated in `design/prototypes/hi-fi.html`; this is a port, not a design |

### M1 · Session, tabs, and a mock run

| | |
| --- | --- |
| **Objective** | The navigation model works, and the WAM boundary is stubbed before it is needed |
| **Time** | 1.5–2 weeks |
| **Scope** | 27 files: `shell/strip/*`, `shell/panel/*`, `useTabs`, `FeatureBoundary`, `services/*` (7), `lib/*` (6), `guards`, `layouts/Workspace`, `Notes`, `Settings` |
| **Included** | Room tabs pinned, object tabs closable, overflow after 8 · strip persists per user+workspace for 30 days · panel with resize and collapse · 401 redirect with return path · mock WAM client behind `VITE_WAM_MODE=mock` · mock run snapshot rendering in a placeholder page |
| **Excluded** | Real data, real WAM, file upload, editor, canvas |
| **Depends on** | M0. Q1/Q5/Q12 defaults are acceptable here — they affect list queries, not the shell |
| **Deliverable** | A clickable shell where tabs behave like `hi-fi.html` |
| **Acceptance** | (1) Reload restores strip, active tab, scroll (2) Closing an object tab returns to the room index, never to an empty surface (3) A mocked 500 renders `RouteError` with a request id, not a blank screen (4) 403 renders "no access", never an empty list (5) The panel slot is filled by the route, not by a feature reaching in |
| **Risk** | Medium — tab reconciliation is subtle (object deleted, workspace switched, deep link to a closed tab). It is pure logic in `lib/tabs.ts` and should be tested first, not last |

### M2 · Files and Recently

| | |
| --- | --- |
| **Objective** | Material gets in and comes back out, and the way back is already there |
| **Time** | 2 weeks |
| **Scope** | 21 files: `features/files/*` (7), `features/recently/*` (4), `components/content/*` (7), `services/files/*`, `services/workspace/client` |
| **Included** | Folder tree · five-column table with keyboard navigation · upload with progress and cancel · preview for PDF, image, text · row selection drives the panel · double-click opens a preview tab |
| **Excluded** | Editing files · annotations · versioning · move-by-drag (move lives in a menu at first) |
| **Depends on** | M1; N3 (upload path) and N4 (who owns folders) must be answered or defaulted |
| **Deliverable** | The workspace holds real files |
| **Acceptance** | (1) A 20MB PDF uploads with progress and is still there after reload (2) Deleting a file with an open tab produces a tombstone tab with Undo, not a crash (3) `used by` in the panel lists the notes and boards that reference the file (4) Preview of an unsupported type offers download, not a broken viewer |
| **Risk** | Medium. Upload is where CORS, signed URLs, and large-file behaviour all fail at once. Budget a day for the first real upload against the actual storage service |

### M3a · Notes

| | |
| --- | --- |
| **Objective** | The user can write something about the material they just uploaded |
| **Time** | 1.5–2 weeks |
| **Scope** | 10 files: `features/notes/*` (8), `extensions/*` (2) |
| **Included** | Note list with scope filter, reading column at 660, TipTap with six block types (paragraph, H2, list, quote, code, reference), reference chips to files/notes/runs, collections, save on idle, 409 review |
| **Excluded** | Tables, callouts, tags beyond a flat list, backlinks, slash menu polish, collaborative editing |
| **Depends on** | M1, M2 (a reference needs something to point at); O1 (one scope) |
| **Deliverable** | Notes as a working surface |
| **Acceptance** | (1) Text survives reload and a second browser tab (2) A reference chip opens its target in a tab (3) An 8,000-word note keeps typing latency under 16ms per keystroke (4) `beforeunload` warns only when there are unsaved changes |
| **Risk** | Low–medium. TipTap is well-trodden; the reference node is the only custom part |

### M3b · Board

| | |
| --- | --- |
| **Objective** | Spatial arrangement, which is where Heptabase's value actually lives |
| **Time** | 3–4 weeks |
| **Scope** | 15 files: `features/whiteboard/*` (5), `canvas/*` (10) |
| **Included** | Board index · canvas with fixed logical scene and scale-to-fit · sections, cards, edges with labels · pan, zoom, marquee, drag · selection HUD · minimap · board panel |
| **Excluded** | Freehand drawing · images on canvas beyond a file chip · nesting (Q2 default: flat) · collaboration · undo beyond 20 steps |
| **Depends on** | M1, M2; the `design/…plan.md` §8.2 thresholds must be turned into tests first |
| **Deliverable** | A board a user can arrange by hand |
| **Acceptance** | (1) 60 cards, panning holds 30fps on the reference machine (2) A card dragged across a section boundary re-parents on drop (3) An edge follows its cards when they move (4) Zoom 25%–200%, and at 25% card titles are still legible (5) `Escape` always returns to idle from any gesture |
| **Risk** | **Highest in the project.** Hand-built hit-testing and edge routing. If the M3b estimate exceeds 5 weeks during the first week of work, fall back to read-only rendering (§5) |

### M4 · Processes, live — and Overview

| | |
| --- | --- |
| **Objective** | The delegation loop closes — the product's actual claim — and the landing screen finally has something true to say |
| **Time** | 2.5–3 weeks, plus whatever WAM is not ready |
| **Scope** | 20 files: `features/processes/*` (10), `features/overview/*` (6), `services/wam/stream`, `shell/palette/*` (3), conditional `server/` if N5 says so |
| **Included** | Submit from Overview and from the room · process list with state filters · run detail: intent, plan, activity, output, controls · live updates · artifact ingestion · palette with navigation and recent objects · **Overview assembled from real data**: intent input, Continue (last touched), Needs you (`needs_input` runs), workspace cards |
| **Excluded** | Creating process types · editing a plan · re-running with modifications beyond a single button · trends and cost analytics |
| **Depends on** | M1b; **N1 (transport), N2 (identity forwarding), B2 (artifact ingestion) must be real, not proposed** |
| **Deliverable** | A submitted intent turns into a visible, updating run with a real artifact |
| **Acceptance** | (1) A real run reaches `succeeded` with no manual refresh (2) `needs_input` reaches the Overview and the rail badge within 5s (3) A capability the run does not expose has no button — verified by removing `pause` from the mock and observing the button vanish (4) The artifact opens from Output and appears in Files with a `produced_by` link (5) WAM unreachable → last snapshot plus "updated 4m ago", never a blank page |
| **Risk** | **Second highest, and the only one outside our control.** If WAM exposes no event stream and no capability list, Processes degrades to poll-and-guess, and the product's core loop becomes a refresh button |

### M5 · Account

| | |
| --- | --- |
| **Objective** | The user can see what they are paying for and what they can call |
| **Time** | 1 week |
| **Scope** | 8 files: `features/account/*`. `MeterRow` is counted in `components/content` at M2 |
| **Included** | Profile · plan card · usage meters with reset date · API keys (create, revoke, copy once) · preferences (density, panel width, language placeholder) · organization block, admin only |
| **Excluded** | Payment method entry (link out) · invoices (link out) · seat management · self-serve upgrade flow |
| **Depends on** | M1; N2 (roles), account API |
| **Deliverable** | Settings that answer "what am I on, what is left, what can I call" |
| **Acceptance** | (1) Numbers match the metering service exactly, verified by comparing two clients (2) A key is shown once and never again (3) A non-admin sees no organization block at all — not a disabled one (4) Usage explains the last run's cost with a link to that run |
| **Risk** | Low, if the account API exists. If Thylas must own keys and plans, add 1–2 weeks and a backend |

### M6 · Production readiness

| | |
| --- | --- |
| **Objective** | It stops being a prototype |
| **Time** | 2 weeks |
| **Included** | Keyboard-only paths for J1 and J4 · focus management in the palette and dialogs · skeleton tuning · error copy pass · empty states · bundle splitting · i18n decision executed if needed · tokens source moved from `design/` to `src/` |
| **Excluded** | Analytics, A/B, feature flags, dark mode (Q7 default: no) |
| **Acceptance** | (1) Lighthouse ≥ 90 on the shell (2) Every interactive element reachable and operable by keyboard (3) No console error on any of the 15 routes (4) First paint after sign-in under 1.5s on a warm CDN (5) A user who has never seen the app completes J1 without help |

---

## 3. Totals

| Path | Time | Notes |
| --- | --- | --- |
| Full, sequential, one engineer | **15–19 weeks** | Sum of milestone ranges is 14.5–17.5 (1 + 1.5 + 2 + 1.5 + 3 + 2.5 + 1 + 2 to 1.5 + 2 + 2 + 2 + 4 + 3 + 1 + 2), plus 10% for integration |
| Full, two engineers (the second owns the canvas from M3a) | **12–14 weeks** | M3b and M4 run in parallel; M2 and M3a partly overlap. The saving is capped by M1, which is shared |
| Narrow slice (§5) | **11–14 weeks** | Removes M3b's 3–4 weeks and its risk; keeps everything that tests the product |
| Critical path | M1 → M2 → M3b → M4 → M6 | The canvas is the only item that can absorb a month without anyone noticing |
| Non-canvas path (narrow slice) | M1 → M2 → M4 → M6 | Two dependencies instead of four; the board becomes a later addition |

**What is not in these numbers:** backend work, auth service, storage integration, design refinement, user testing. If any of N1–N5 turns out to need a service that does not exist, add its build time and a handoff.

---

## 4. What invalidates this plan

Not risks in the abstract — the specific discoveries that would make the above wrong, and what changes.

| If we learn | Then | Cost |
| --- | --- | --- |
| Real usage is 2-minute questions, not multi-hour delegation | The Overview becomes a search box; Processes shrinks to a results list; M3b and M4 both halve | Re-plan after 5 users, before M3b |
| WAM has no event stream | Processes polls; the live dot becomes "updated N ago"; `needs_input` cannot pull attention in real time | M4 +1 week of workarounds, and the product loses its best moment |
| WAM has no capability list | `ControlBar` hard-codes what exists today and lies after the first WAM release | Reopens boundary rule 3; needs a versioned capability document instead |
| No shared authorization service | Thylas must not build one (B1). The org features (J8, M5 org block) cannot ship | Deletes M5's organization block and J8 from v1 |
| The 60-card board cannot hold 30fps with DOM | Canvas moves to a `<canvas>` renderer or a library, after all | M3b +3 weeks, and the visual system gets harder to hold |
| A CHORD design system already exists | `components/ui` becomes a thin wrapper; tokens merge | M0 −2 days, plus a reconciliation task |

---

## 5. The narrow slice

If the release date matters more than completeness, build this and stop:

**M0 → M1 → M2 → M3a → M4 → M5, with M3b read-only.**

- The board renders sections, cards, and edges from stored data, with pan and zoom. No dragging, no creating, no edges drawn by hand.
- Notes support paragraph, heading, list, and reference. No code blocks, no tables.
- Everything else as specified.

This satisfies all five acceptance sentences in the product definition (§11) except "arrange a board by hand", which no v1 user has asked for yet. It removes the single largest and least-validating piece of work, and it can be added later without touching anything else — the board's data model is the same in both versions.

**Do not cut M4 to save time.** It is the only milestone that tests whether the product is the product.

---

## 6. Relationship to `design/thylas-ui-design-plan.md` §14

That section listed seven steps. Current state:

| Step | Status | Where it landed |
| --- | --- | --- |
| 1 · Validate Q1, Q5, Q12 | Not done. Defaults are in place and are safe to build against | Product definition O1–O3 |
| 2 · Hi-fi for three screens | Done (nine screens) | `design/prototypes/hi-fi.html` |
| 3 · Token file | Done | `design/tokens.css` |
| 4 · Reconcile Processes with WAM capabilities | **Blocking M4.** Needs WAM, not design | M4 gate |
| 5 · Component inventory (~40) | Done in outline | `design/…plan.md` Appendix A; refined into `components/ui` + `components/content` in the file plan |
| 6 · Canvas spec with thresholds as tests | **Blocking M3b.** The thresholds exist (§8.2); the tests do not | M3b gate |
| 7 · Implementation plan with vertical slices | This document and `file-plan.md` | — |

Two of the seven are still open, and both have a milestone waiting on them. Neither can be closed by writing more documents.

---

## 7. First concrete step

Create `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js` with the layering zones, `index.html`, and `src/main.tsx` that renders a `div` with the token background.

Then `app/router.tsx` with all 15 routes pointing at stub pages.

That is the whole of day one, and it is enough to verify that the four-zone layout and the route table are correct before any feature exists.
