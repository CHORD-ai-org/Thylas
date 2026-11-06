# Thylas (τ) — UI Prototype Design Plan

**Status:** design planning. No frontend implementation in this document.
**Scope:** application shell, information architecture, workspace interaction model, visual direction, low-fidelity prototypes.
**Date:** 2026-11-07

---

## 0. How to read this document

Every claim in this document carries one of four labels. Nothing without a label is a decision.

| Label | Meaning | Who can change it |
| --- | --- | --- |
| **[C]** Confirmed | Decided. Reopening requires an argument that beats the stated reason. | Product owner |
| **[P]** Proposed | Our recommendation, with reasoning and rejected alternatives. | Review |
| **[?]** Open | Genuinely ambiguous. Alternatives and default shown; needs validation. | Review + user testing |
| **[A]** Assumption | We believe it, we cannot verify it yet. Must be checked before it becomes a dependency. | Evidence |

Sources are named inline: `CHORD site`, `Kuse`, `HeptaBase RE`. Anything not traceable to one of them is marked **[A]**.

---

## 1. Product positioning and responsibility boundaries

### 1.1 What Thylas is

**[C]** Thylas is the **application layer** of CHORD: the surface a person uses to organize work, hold materials, and operate capabilities that live elsewhere.

**[C]** From the CHORD site, Thylas is *"Cloud platform & user-facing integration — packaged WAM · workspaces · knowledge base"*, status label *"Available as a platform"*. Its four responsibilities as given:

| # | Responsibility | Consequence for UI |
| --- | --- | --- |
| 1 | Accessible application interface | Entry cost must be near zero: sign in → a real object in under a minute |
| 2 | Personal and organizational workspaces | Two ownership scopes, one visual language, different capability sets |
| 3 | Files, documents, notes, resources | A content model, not a folder tree with a chat box bolted on |
| 4 | Access to WAM and other CHORD capabilities | Surfaces for execution: status, artifacts, controls — mirrored, never invented |
| 5 | Accounts, subscriptions, quotas, API | A settings hierarchy that separates person / org / workspace |

### 1.2 The boundary that must not blur

**[C]** WAM does semantic understanding, intent interpretation, context management, task planning, agent coordination, execution logic. Thylas does not.

| Question | Answer | Where it appears in the UI |
| --- | --- | --- |
| Who decides what a process should do? | WAM | Thylas shows the intent, the plan, and the revision history as **read-only material** |
| Who decides when a step runs? | WAM | Thylas shows state; controls are those WAM exposes, no more |
| Who searches files? | Thylas (lexical + metadata) | ⌘K searches names, text, tags, dates |
| Who searches meaning? | WAM | Offered as an explicit action ("find related work"), labelled as a WAM call |
| Who remembers context across sessions? | WAM (shared context) | Thylas shows a context summary per process; it does not maintain one |

**Practical rule for future design reviews:** if a screen in Thylas needs to *decide* something about the user's work, the design is wrong. Thylas asks, WAM decides, Thylas reports.

### 1.3 What Thylas is deliberately not

**[C]** Not a chat product with a file manager attached. Not a statistics dashboard. Not a second implementation of WAM. Not a marketplace of agents. Not a note app that happens to have an API.

**[P]** One sentence to design against, used as a test for every screen:

> A person returns after three days, and within ten seconds knows what they were doing, what the system did while they were gone, and what needs them now.

Screens that do not serve that sentence are candidates for removal, not features.

---

## 2. Research: references and findings

### 2.1 CHORD website (`chord-ai-org.github.io`)

Inspected 2026-11-06. Findings that affect UI design:

| Finding | Design consequence |
| --- | --- |
| Four-layer stack: Rym (γ, research) → WAM (ω, core) → Thylas (τ, platform) → Knock (κ, in development) | Thylas may present itself as the platform layer, but must not imply Rym or Knock are usable |
| **"Status labels are honest by design."** Nothing on the site claims a deployment, benchmark, or completed outcome | **[C]** The UI inherits this discipline: never show a capability control that cannot execute; empty states say what is missing instead of faking data |
| WAM's three named capabilities: shared context, dynamic planning, verifiable execution; centralised "Miracle Agent" coordination | Process surfaces should show **plan revisions** and **verifiable outputs**, because those are the named, defensible capabilities |
| Operator paradigm: Discover → Abstract → Compose → Generalize | Future direction: a process that worked becomes a named, re-runnable operator. **Not v1 UI.** Mentioned only so the process detail view does not structurally block it |
| Four work types: autonomous research, collaborative development, competitive problem solving, computational operations | These are the *content* of a workspace. Long horizon, many artifacts, heavy file usage — this is why tab persistence and file lineage matter more than chat history |
| Documentation: "In preparation" | Do not design links to docs that do not exist. Help entry points must degrade honestly |

### 2.2 Kuse (`kuse.ai`, `app.kuse.ai`)

**Inspection limit, stated plainly:** `app.kuse.ai` is behind authentication (verified: it returns a login screen). We could not run a hands-on session. Findings below come from the marketing surface (inspected: *"The AI workspace built around your context"*, *Kuse 2.0: The AI OS*; credit-based plans; infinite canvas; files/web/images/video on one canvas; "Source Only Mode"; "Evolving Memory"; schedules/workflows) plus three independent reviews (netizenschoice, popularaitools, booststash — all describing the same structural facts).

| Observed pattern | Adopt / adapt / avoid | Why |
| --- | --- | --- |
| Canvas is the default landing surface; you drop material and start | **Adopt the principle, not the surface.** Our equivalent: one intent input on Overview that starts a real object | The lesson is friction, not canvas |
| Flat list of canvases as the whole organisation | **Avoid** | Week-scale CHORD work needs typed containers (files, boards, processes) and an ownership model |
| Credits are visible and constrain work | **Adopt** | A platform product must make quota legible before the user hits it |
| Everything is the same object type on one infinite field | **Avoid** | Kuse is a research/writing tool. Thylas must distinguish a file from a run from a board, because their capabilities differ |
| "Cumulative context" narrative | **Adopt as language, not mechanism** | We may say the system holds context; we may not build context management in Thylas |
| No strong information hierarchy — the canvas is the hierarchy | **Avoid** | Our sidebar has to survive 40 workspaces and 3,000 files |

**Honest conclusion:** Kuse validates *entry friction* and *quota legibility*. It does not validate an application shell for typed, owned, long-running work. We take the first two and design the third ourselves.

### 2.3 HeptaBase RE (`D:\github projects\HeptaBase RE`)

Inspected: `Plan/01-范围与基准.md`, `02-逐屏规格.md` (S01–S14), `03-组件契约.md` (C01–C68), `06-画布交互改造.md`, `对照-参考图与实际画面.md`, `app/src` structure (`C01-AppShell`, `C02-AppRail`, `C03-TabStrip`, `C04-TabItem`, `C05-SidePanel`, `C10-CanvasViewport`, `C11-CardNode`, …, `C57-SearchOverlay`).

**Verification caveat [A]:** this repository is *our own* reconstruction of Heptabase, not Heptabase's code. Its measurements are real (they describe our build), but they are not proof of Heptabase's behaviour. Treat its numbers as **design hypotheses already paid for**, not as ground truth about the reference product.

Verified facts about the reconstruction, and what they teach:

| Artifact | What it actually contains | Lesson for Thylas |
| --- | --- | --- |
| `C01 AppShell` | Three columns: left rail, tab strip, main, optional right panel; only widths and toggle state as inputs | A shell component that knows nothing about content is the right level of abstraction |
| `C03 TabStrip` / `C04 TabItem` | Tabs with **pin**, **group**, close, reorder, unsaved dot | Pin and group are not decoration: they are how a 40-tab session stays legible |
| `S02` layout numbers | rail 240 / tab strip 40 / right panel 360 / toolbar 48 offset 12 / minimap 160×110 | Reusable density baseline for a 1440-wide desktop target |
| `06` measured canvas work | 30 wheel events collapsed into one zoom (1.016 instead of 1.616); 150-card drag P95 43 ms → 18 ms after moving viewport to `ref` + CSS-variable drag | Canvas手感 is an engineering property with a measurable threshold. Specify thresholds in the design, not after |
| `06` interaction table | Hover anchors to start an edge; drag to blank creates a card **and** the edge in one undoable step; hit areas compensated by `1/zoom`; labels on a layer above cards | These are the four interactions that make a canvas feel authored rather than drawn |
| `对照` §1 | **21 buttons per screen with no handler** — 7 of them app entries, with `onClick` present but the callback `undefined` | A navigation tree that is not complete in the IA becomes dead chrome. Our sidebar must have exactly zero unmapped destinations |
| `对照` §2 | Reference cards are *white body + tinted header*; sections are *full-bleed tinted ground + solid top bar*. The reconstruction inverted this | Concrete correction for the Thylas whiteboard: keep paper light, tint only the identifying edge |

What we take, concretely:

1. **Shell = 4 zones** (rail / context strip / surface / panel), with the panel optional. **[C]**
2. **Tab strip has pin + group + unsaved state.** **[P]**
3. **Canvas primitives:** card, section, text, media, edge, marquee, snap guide, minimap, zoom dock, breadcrumb. **[P]**
4. **Canvas interaction floor:** hover anchors, drag-to-blank-creates, zoom-compensated hit areas, labels above cards, no arrowheads by default. **[P]**
5. **Every nav element routes.** No decorative sidebar entries. **[C]**

What we leave behind: the learning layer (mastery badges, spaced repetition, review sessions) — that was a different product hypothesis. Also the 14-screen breadth; Thylas starts from 9 prototype surfaces, not 14.

---

## 3. Quiet Computationalism — the visual system

**[C]** The direction is decided. This section turns it into values precise enough to build a low-fi prototype and later a token file.

### 3.1 What the direction means in structural terms

| Principle | Concrete rule | Anti-pattern this blocks |
| --- | --- | --- |
| Quiet | No element carries a colour it does not need. One accent, used for state | Rainbow tag chips, gradient headers |
| Warm | Ground is paper, not white. Text is brown-black, not `#000` | Cool grey SaaS chrome |
| Tactile | Separation by **hairline + tone**, not by shadow + radius | Floating rounded cards on a grey field |
| Geometric | 4px grid, 1px rules, corners at 4px max on surfaces, 2px on controls | 12–16px pill cards everywhere |
| Editorial | Serif for authored content and section titles; grotesque for UI; mono for identifiers and numbers | All-Inter interface |
| Structured | Fixed spatial zones. Panels do not float over content except as temporary overlays | Glassmorphic drawers |
| Functional | Motion only for state change or spatial continuity | Entrance animations, hover bounce |

### 3.2 Colour

Base palette **[C]** (given), extended roles **[P]**.

| Token | Value | Role | Notes |
| --- | --- | --- | --- |
| `bg/app` | `#F1EBDD` | Application ground, sidebar | Warm ivory |
| `bg/paper` | `#F7F2E9` | Canvas, whiteboard ground | Derived: one step lighter than app ground so the canvas reads as *material*, not as a panel |
| `bg/surface` | `#FBF9F4` | Reader, cards, panels, tab strip | Given |
| `bg/rail` | `#EBE4D4` | Global rail, recessed | Derived: recessed zones are darker, raised zones lighter. Never lighter-on-lighter |
| `text/primary` | `#493626` | Headings, active labels | Given |
| `text/secondary` | `#927B65` | Metadata, inactive labels | Given |
| `text/tertiary` | `#B3A08C` | Placeholders, disabled | Derived |
| `line/hair` | `#E6DED1` | All dividers, panel edges | Given. 1px, never 2px except focus |
| `accent` | `#B56F50` | Active tab rule, primary action, running state, focus ring | Given. **Reserved.** Not for tags, not for decoration |
| `accent/weak` | `#F0E2D7` | Selected row ground, active chip ground | 12% mix |
| `state/ok` | `#5E6B50` | Succeeded, complete | Desaturated olive; never a bright green |
| `state/warn` | `#A8792C` | Needs input, quota near limit | Ochre |
| `state/error` | `#8C3A2B` | Failed, destructive | Rust, not red |
| `state/idle` | `#927B65` | Queued, paused | Same as secondary text — idle is not a colour event |

**Rules**

1. **[C]** Hue appears only as *state* or *identity of the current selection*. Content never gets a colour that is not derived from a state.
2. **[C]** Max two chromatic elements per screen region (the accent plus at most one state colour).
3. **[P]** Whiteboard card = surface body + 3px tinted header strip, per the HeptaBase `对照` finding. Sections = full-bleed weak tint with a solid 1px top rule, not a floating pill.
4. **[P]** Dark mode: **not in v1.** Reason: it doubles the palette problem, and the given direction is a paper metaphor whose whole appeal is tone. Revisit after the light system survives a real prototype. `[?]` §13 Q7.

### 3.3 Typography

**[P]** Family choices are provisional (licensing undecided) — values below are role definitions.

| Role | Family | Size / line | Weight | Use |
| --- | --- | --- | --- | --- |
| Display | Serif (e.g. Newsreader / Source Serif 4) | 28 / 34 | 400 | Overview greeting, empty-state title, note title in reader |
| Section | Serif | 18 / 26 | 500 | Panel section titles, room titles |
| Body-read | Serif | 16 / 26, max 68ch | 400 | Note and document reading |
| UI-base | Grotesque (e.g. Inter) | 13 / 18 | 400 | Almost everything: tree, tabs, buttons |
| UI-strong | Grotesque | 13 / 18 | 550 | Active tab, selected row, table headers |
| Caption | Grotesque | 11 / 16 | 450, +0.02em tracking | Metadata, counts, timestamps |
| Mono | Mono (e.g. JetBrains Mono) | 12 / 18 | 400 | Process ids, code, credits, durations, file sizes |

**Rules:** three families, no fourth. Numbers in tables and process timelines are mono so columns align. Serif is never used below 14px. No letter-spacing on serif.

### 3.4 Space, line, corner, elevation

| Property | Values |
| --- | --- |
| Space scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 |
| Row heights | 32 (tree, list), 28 (compact tree), 40 (tab strip), 44 (table header + toolbar) |
| Panel widths | rail 240 (collapsed 56) · context panel 340 in a workspace, 300 in Notes (min 280 / max 480) · reading column 660 at 1440 with both panels open, max 680 |
| Corners | 2 (chips, inputs) · 4 (surfaces, cards) · 6 (overlays only) · pill only for status badges |
| Elevation | `0` hairline · `1` hairline + `0 1px 0 rgba(73,54,38,.06)` for popovers · `2` 1px border + `0 8px 24px -12px rgba(73,54,38,.25)` for modal/palette. Nothing else floats |

### 3.5 Motion

| Event | Duration / easing | Why it is allowed |
| --- | --- | --- |
| Panel collapse / expand | 160ms `cubic-bezier(.2,0,0,1)` | Spatial continuity: content must not jump |
| Tab switch | **0ms** | Instant. A tab switch is not a transition |
| Process state change | 1 pulse, 600ms, then static | Communicates live system state; stops when state stops |
| Canvas zoom via button/key | 120ms | Orientation |
| Canvas zoom via wheel | 0ms | Tracking must be 1:1 |
| Everything else | 0ms | — |

Respect `prefers-reduced-motion`: pulses become a static dot change.

### 3.6 The five-line checklist

A screen is on-brand if all five are true: (1) it has exactly one accent-coloured element; (2) all separation is a 1px line or a tone step; (3) the largest type on screen is serif; (4) nothing has a corner radius above 4px except overlays; (5) no element moves unless its state changed.

---

## 4. Information architecture

### 4.1 The object model (this comes first, the sidebar follows from it)

**[P]** Five object kinds. Anything not in this table does not exist in v1.

| Object | Container of | Can be referenced by | Lives in |
| --- | --- | --- | --- |
| **Workspace** | rooms, files, boards, processes, notes (scoped) | — | owned by a person or an organization |
| **File** | binary or external link | boards, notes, processes | one workspace, one folder |
| **Note** | an authored body (blocks) | boards, processes, other notes | personal library **or** one workspace |
| **Board** (whiteboard) | cards, sections, text, media, edges | — | one workspace |
| **Process** | runs, artifacts, plan revisions | notes, boards | one workspace |

**Reference vs copy [C]:** everything references by id. No object is duplicated to appear in a second place. A board shows a *chip* for a file; the file stays where it is. This single rule removes most of the ownership confusion that Section 4.3 has to resolve.

### 4.2 The five sidebar areas

**[C]** Five areas, as specified. Their jobs, in one line each:

| Area | Job | Not its job |
| --- | --- | --- |
| **Overview** | Orientation: resume, workspaces, what needs you | Reporting, charts, streaks |
| **Recently** | Cross-type navigation history | Storage, an activity feed, a social log |
| **Workspace** | The environment where work happens | A file manager with tabs |
| **Notes** | Authored material: write, collect, retrieve | A second copy of workspace files |
| **Account** | Person-level settings, plan, usage, keys | Organization administration |

```
Thylas
├── Overview
├── Recently                         (derived index: last 50 accessed objects)
├── Workspace                        (collapsible)
│   ├── [switcher] Personal           scope badge: PERSONAL
│   │   ├── Files                     → room, singleton tab
│   │   ├── Whiteboard                → room, singleton tab
│   │   └── Processes                 → room, singleton tab
│   ├── [switcher] <Organization>     scope badge: ORG · role
│   │   └── (same three rooms)
│   └── + New workspace
├── Notes
│   ├── [scope filter] All · Personal · <workspace…>
│   ├── Collections (folders)
│   └── Tags
└── Account
    ├── Profile
    ├── Plan & billing
    ├── Usage & quota
    ├── API keys
    ├── Preferences
    └── Organization (admins only; separate block, see §10)
```

**Depth rule [P]:** the sidebar shows at most three levels (area → workspace or collection → item). Deeper structure is navigated in the main surface, not in the sidebar.

**Route completeness rule [C]:** every visible sidebar row maps to a URL and a mounted view. No row may exist "for later". This is the direct fix for the HeptaBase `对照` §1 finding of 21 dead buttons.

### 4.3 Resolving Workspace vs Notes

The question as given: *global personal knowledge space, workspace-specific material, or both?* It cannot be left unanswered — the same note in two places with two owners is how content models die.

**[P] Recommended: one Note object, one scope, two views.**

- A Note has exactly one home: `scope = personal` or `scope = <workspace>`.
- **Notes** (sidebar) is a **lens**: it lists every note the user can read, across all scopes, with a scope filter. It is not a folder that owns anything.
- **Inside a workspace**, notes whose scope is that workspace appear under the workspace's own Notes group. Same objects, filtered view.
- Moving a note between scopes is an explicit action with a visible consequence ("move to Notes library" / "move to workspace X"), never a silent copy.

| Alternative | What it buys | Why rejected |
| --- | --- | --- |
| **A. Notes = global only; workspaces hold files/boards/processes** | Simplest mental model; zero duplication | A workspace cannot own its own written material; every project folder leaks into personal notes. Breaks org boundaries (an org note cannot be private to the org) |
| **B. Notes = workspace only** | Clean ownership | No place for pre-workspace thought. A user cannot write anything before deciding where it belongs, which kills the first-run experience |
| **C. Notes = separate store, workspace docs = separate store** | Each area stays simple | Two document systems, two search indexes, two editors. The user must remember which one they used |
| **D. One object, one scope, two views (recommended)** | Single store, single editor, single index; org boundaries respected; personal scratch space exists | Costs a scope filter in the Notes list, and users may not immediately understand why a note appears in two places. Needs one explanatory affordance, not a settings page |

**Why Files and Notes do not overlap [C]:** *a file has an original form we did not author; a note has a body we did.* A PDF you upload into a workspace is a File. What you write **about** that PDF is a Note that references it. This is a definition, not a preference — it decides where anything new goes, and it is the only overlap rule the UI has to teach.

`[?]` Cross-scope sharing (one note readable by two workspaces) is out of v1. See §13 Q1.

### 4.4 Recently

**[P]** Recently is a **derived index over access events**, not a container and not a feed.

- Rows: `object + type + workspace + last touched + resume hint`.
- Sources: opened, edited, ran, uploaded. One row per object, most recent first. Cap **50**.
- Grouping: Today / Yesterday / Earlier this week / Older. Type filter chips: All · Notes · Boards · Files · Processes.
- Type is encoded three ways so it survives scanning: 16px line glyph, mono type label, and a workspace chip. No colour coding per type (colour is reserved for state).
- **What it must not become:** no avatars, no "you and 2 others", no event verbs ("commented", "renamed"). A row is a destination, not a story.
- Procession rows carry a live state dot (running / needs input / failed) — the only reason a row can be more than a link.

`[?]` Per-workspace Recently vs global Recently: global in v1, because the sidebar already scopes everything else. §13 Q5.

### 4.5 Navigation model, one diagram

```
                      ┌──────────────── global rail 240 ────────────────┐
                      │ Overview  Recently  Workspace  Notes  Account   │
                      └───────────────────────┬─────────────────────────┘
                                              │
   ┌──────────────────────── context strip 40 ──────────────────────────┐
   │ [Files][Whiteboard][Processes] │ note ⌄ │ board ⌄ │ run ⌄  ⋯  ⧉   │
   └───────────────────────────────────┬────────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────┐
        │                  main surface                       │  ┌─ context panel 340 ─┐
        │        (room index  ·  or  object detail)           │  │  metadata/refs/AI   │
        └─────────────────────────────────────────────────────┘  └─────────────────────┘
```

**[C]** Four zones. Zone 2 is the *only* horizontal strip in the app. **[P]** The context panel is the only resizable zone. The rail collapses to 56px icons.

---

## 5. Sidebar structure

### 5.1 Anatomy

```
┌──────────────────────────── 240 ────────────────────────────┐
│  τ   Thylas                                  ⌘K    +        │  header 48
├──────────────────────────────────────────────────────────────┤
│  ○  Overview                                                 │  nav 32
│  ◷  Recently                                                 │
│  ▤  Workspace                                              ⌄ │  section header 32
│     ┌──────────────────────────────────────────────────┐     │
│     │ ● Personal                        PERSONAL     ⌄ │     │  switcher 36
│     ├──────────────────────────────────────────────────┤     │
│     │    ▢ Files                                       │     │  room 32
│     │    ◇ Whiteboard                                   │     │
│     │    ▷ Processes                                  3 │     │  (+ live count badge)
│     │    ▤ Notes                                       │     │  (scoped notes group)
│     └──────────────────────────────────────────────────┘     │
│     ┌──────────────────────────────────────────────────┐     │
│     │ ● Research                      ORG · MEMBER  ⌄ │     │
│     └──────────────────────────────────────────────────┘     │
│     + New workspace                                          │
│  ▤  Notes                                                    │
│  ◔  Account                                                  │
├──────────────────────────────────────────────────────────────┤
│  (avatar)  Ceaser Zhao            plan: <name>        ⌄      │  profile 44
└──────────────────────────────────────────────────────────────┘
```

Collapsed (56): icons only, tooltips on hover, workspace section reduced to the active workspace's monogram.

| Region | Height | Behaviour |
| --- | --- | --- |
| Header | 48 | Product mark + name; ⌘K search; `+` create menu |
| Nav items | 32 | One line, 16px glyph, 13px label. Active = `bg/surface` row + 2px accent left rule |
| Section header | 32 | Collapsible. Chevron rotates. Label in caption size, tracked |
| Workspace switcher | 36 | Opens a list of workspaces with scope badge and role. Not a `<select>` |
| Rooms | 32 | Files / Whiteboard / Processes / Notes. Only the *current* workspace's rooms are listed; switching replaces the group |
| Profile | 44 | Avatar + name + plan name; menu holds Profile, Plan, Usage, Preferences, Sign out |

### 5.2 Rules

1. **[C]** Only the Workspace section is collapsible by default. Notes collections are a disclosure list; Account is a plain list.
2. **[C]** One scroll region for the whole sidebar. The header and profile row are fixed.
3. **[P]** A workspace is *never* auto-expanded on load. The last active workspace is expanded; the others show name + scope badge only. Loading 40 workspaces must not produce 40 open trees.
4. **[P]** Room rows show a badge only when it carries state: a count of running processes, a dot for "needs input". No decorative counts.
5. **[P]** Selected row = `accent/weak` ground, no border, text goes `text/primary`. Hover = `bg/rail`-tinted 4%. Nothing underlines.
6. **[C]** Creating: `+` opens a menu — New note · New board · Upload file · Start process · New workspace. The last one appears only in the workspace section context.
7. **[P]** No drag-and-drop of content *into* the sidebar in v1 except files onto a workspace row (upload into that workspace's root folder). Drag-reordering of workspaces is deferred.

### 5.3 What is deliberately not in the sidebar

Search results, tags as a global tree, favourites, a trash view, "AI chat", "templates", "community". Each of these either duplicates a room or adds a category that the five-area model was designed to prevent. Trash and search live in the surface and ⌘K.

---

## 6. Workspace ownership model

### 6.1 Two scopes

| | Personal | Organization |
| --- | --- | --- |
| Owner | The account | The organization |
| Created | Exactly one per account, at signup, undeletable | By an owner/admin, any number |
| Members | 1 | ≥1, role-based |
| Visibility | Private to the account | Visible to members by role |
| Rooms | Files, Whiteboard, Processes, Notes | Same four |
| Capability differences **[P]** | No members panel, no roles, no shared quota view, no audit | Members, roles, org quota pool, shared processes, org-level billing |
| Deletion | Not deletable | Deletable by owner, with a typed confirmation and a 30-day retention notice `[?]` |

**[C]** Same visual language for both. A user must not need to relearn the workspace because the scope changed. Differences appear as *absent controls*, not as a different layout.

### 6.2 Switching

- One switcher in the sidebar section header area. Opens a list: Personal first (marked), then organizations alphabetically, then `+ New workspace`.
- Switching swaps: the room group, the tab strip, the main surface. **[C]** Tabs are workspace-scoped, so switching never mixes two workspaces' surfaces.
- Switching restores that workspace's last session (open tabs + active tab + canvas viewport if the active tab is a board). **[P]**
- Keyboard: `⌘⇧O` opens a workspace switcher palette. **[P]** (Conflicts to check against the eventual global map.)
- A subtle top-of-surface indicator appears for 1.2s after switching: `Workspace · <name>` + scope badge. Then it fades. No persistent banner.

### 6.3 Permissions and navigation

**[P]** Permissions change what is *listed*, not what is *greyed out*.

| Role | Files | Whiteboard | Processes | Notes | Settings |
| --- | --- | --- | --- | --- | --- |
| Viewer | read + download | read | read | read | none |
| Member | read/write | read/write | create, control own runs | read/write own | personal preferences |
| Admin | full | full | full, including others' runs | full | members, quota, danger zone |

**[C]** If a role cannot see a room, the room row is absent. An absent room beats a locked room: no "upgrade to unlock" pattern in a workspace the user was invited to.

### 6.4 Where workspace settings live

**[C]** Workspace settings are **not** in Account. They open from the workspace switcher's `⋯` menu as a *surface* (a tab titled `Settings · <workspace>`), not a modal. Reason: settings changes have consequences the user wants to compare against the workspace itself; a modal hides the thing being changed.

Sections: General (name, icon, description, default folder view) · Members · Files (storage, retention) · Processes (default model profile, run limits, concurrency) · Danger zone (transfer, leave, delete). `[A]` The last two depend on backend capabilities that do not exist yet; ship the shell, gate the controls.

---

## 7. Workspace tab and navigation model

This is the section that decides whether Workspace feels like a work environment or a website with sub-pages.

### 7.1 The model

**[P]** Tabs are **locations**, scoped to a context. Two context types exist: a workspace, and the Notes library. Each has its own strip.

| Tab class | Opens | Can close | Multiplicity | Position |
| --- | --- | --- | --- | --- |
| **Room** — Files / Whiteboard / Processes | The room's index view | Only by leaving the workspace; not by the user | Exactly one per room | Pinned, left, after a divider |
| **Object** — note, board, process run, file preview, settings | A detail view | Yes | Any number | Free |

**The principle behind it [C]:**

> Every room tab is an index. Every object tab is a detail. One level of depth per tab, always.

That single rule answers "what is a tab?" without a taxonomy meeting. A board is not a tab *inside* the Whiteboard room tab; opening a board replaces nothing — it appends a detail tab next to the room. Going back to the index is one click on the room tab, not a back button guess.

### 7.2 Why not the alternatives

| Model | Description | Verdict |
| --- | --- | --- |
| **M1 Global strip** (Chrome-like) | One strip for the whole app; tabs from any workspace, notes included | **Rejected.** The sidebar says "you are in Research"; a tab could be from Personal. Two sources of truth for location. Cross-workspace tabs also leak org content into a personal context visually |
| **M2 No room tabs** — rooms only in the sidebar, tabs only for objects | Fewer tabs, sharper strip | **Rejected as primary, kept as the fallback.** You lose "where am I" after closing the last object tab, and the strip becomes empty state limbo. Also forces the sidebar to carry the room's whole index, which it cannot |
| **M3 Context-scoped strip, typed tabs, rooms pinned** | Recommended | Bounded room tabs (max 3), unbounded object tabs, location always legible, one strip per context |

### 7.3 Strip anatomy

```
┌ 40 ──────────────────────────────────────────────────────────────────────────────┐
│ ▢ Files │ ◇ Whiteboard │ ▷ Processes ‖ ● report-draft ⌄  ◇ lit-review  ▷ run #12  ⋯  ⧉ │
└──────────────────────────────────────────────────────────────────────────────────┘
   pinned rooms (never close)      object tabs (typed glyph · unsaved dot · close on hover)
```

| Property | Value |
| --- | --- |
| Height | 40 |
| Tab height | 32, radius 3, 8px gap between object tabs, 12px gap around the divider |
| Active | `bg/surface` fill, `text/primary`, 1.5px accent underline inset 8px from each side. No shadow |
| Inactive | transparent, `text/secondary`. Hover: `bg/surface` at 60% |
| Type glyph | 14px line icon before the name: note ▤ · board ◇ · process ▷ · file ▢ · settings ⚙ |
| Unsaved | 4px dot after the name; becomes `×` on hover |
| Close | Only on object tabs, only on hover/focus. Rooms have no `×` |
| Overflow | Horizontal scroll + `⋯` listing all open tabs with a filter field, after 8 tabs. No shrinking text below 96px width |
| Pin an object tab | Right-click → Pin. Pinned object tabs move to a second pinned group, icon-first, max 4 |

### 7.4 Lifetime and persistence

**[C]** A tab is **session state**, not content. Closing a tab destroys nothing. This sentence belongs in the empty state of a closed board: *"Closed the tab — the board is still in Whiteboard."*

| Event | Behaviour |
| --- | --- |
| Open workspace | Restore last session: open tabs, active tab, scroll position, canvas viewport |
| Close app / sign out | Session persists per `(user, workspace)` for 30 days `[?]` |
| Reopen a closed tab | `⌘⇧T`, stack of last 10 |
| Runtime changes state | The tab shows a state dot; it does **not** steal focus, ever |
| Process finishes while tab closed | Recently row updates; a discreet marker in the Processes room badge; no toast unless the user started the run and is still in the workspace |
| Delete an object with an open tab | Tab becomes a tombstone row for 10s: `Deleted · Undo` |

### 7.5 Keyboard

| Keys | Action |
| --- | --- |
| `⌘1` `⌘2` `⌘3` | Files / Whiteboard / Processes room |
| `⌘⇧[` `⌘⇧]` | Previous / next tab |
| `⌘W` | Close current object tab (no-op on rooms, shows why) |
| `⌘⇧T` | Reopen closed tab |
| `⌘\` | Toggle context panel |
| `⌘K` | Command palette (navigation + actions + search) |

`[A]` Full keymap must be reconciled with the editor's and canvas's keymaps before implementation. Conflicts to resolve: `⌘W` vs close window, `⌘\` vs split, `N`/`S`/`T` on canvas vs text input.

---

## 8. Files, Whiteboard, Processes

### 8.1 Files

**Job:** the material of the work, addressable and previewable without leaving the workspace.

```
┌ 240 rail ┬ 40 strip ─────────────────────────────────────┬ 340 panel ┐
│          │ [Files]│ note │ board                             │ Details  │
│          ├──────────────────────────────────────────────────┤          │
│          │ Research / datasets / 2026-11         ⌄  ⌘⇧N  ⤒  │ Name     │
│          ├──────────────────────────────────────────────────┤ 1.2 MB   │
│          │ ◇ datasets                           12 items  │          │
│          │ ▢ raw-runs.parquet          1.2 GB  · 2h ago   │ Used by  │
│          │ ▢ eval-log.csv              88 MB   · 2h ago   │ 3 boards │
│          │ ▢ protocol-v3.pdf           2.4 MB  · yesterday│ 2 notes  │
│          │ ▢ notes-on-baseline.md      12 KB   · 3d ago   │ 1 process│
│          └──────────────────────────────────────────────────┴──────────┘
```

| Element | Decision |
| --- | --- |
| Structure | Tree + list in one view. Left: folders (nested, max practical depth 5). Right: rows of the selected folder. Not two panes — one scroll |
| Columns **[P]** | Name · size · updated · source (uploaded / imported / produced by process) · used-by count. Sortable; default updated desc |
| Row height | 32; 13px name, mono size and date |
| Preview | Documents, PDFs, markdown, images open as an **object tab**. The context panel shows metadata + reference list for whatever is selected in the row list |
| Upload | Drag anywhere in the surface; a full-surface drop target appears with the destination path. Files upload immediately; the row appears as a skeleton, never as a fake success |
| Produced files | A file written by a process carries a `produced` chip and a link to the run. This is how a user traces an artifact back to what made it |
| Selection | Single click selects (panel updates), double click opens a tab. `⌘`-click multi-select → bulk bar: move, tag, download, delete |
| Empty | "No files yet. Drop anything here, or start a process that produces them." Two actions, no illustration |
| States | uploading (per-row progress) · failed (retry, with reason) · unindexed (`[A]` depends on indexing pipeline) |

### 8.2 Whiteboard

**Job:** the surface where material becomes structure. The most demanding screen; its手感 is a product property with numbers.

**Layout [P]** (adapted from HeptaBase `S02`, re-tuned for a 340 panel):

| Zone | Value |
| --- | --- |
| Canvas ground | `bg/paper`, 1px dot grid at 24px, dot `#DFD5C4` |
| Floating toolbar | left edge, 12px inset, vertical, 48 wide |
| Zoom dock | bottom right, 16px inset, `100%` in mono |
| Minimap | bottom left, 160×110, collapsible, hidden under 900px width |
| Breadcrumb | top left inside canvas, only when boards nest `[?]` |
| Right panel | context: selection metadata, references, comments `[?]`, WAM actions |

**Primitives:** card · section · text · media (image / PDF page / video thumb) · edge · marquee · snap guide · minimap · zoom dock.

**Interaction floor [C]** — below this the canvas is not shippable:

| # | Behaviour | Threshold |
| --- | --- | --- |
| 1 | Wheel zoom / pinch, pointer-anchored | 30 events → ratio within ±2% of theoretical |
| 2 | Drag a card | P95 frame ≤ 20ms at 150 cards |
| 3 | Hover card edge → 4 anchors → drag creates an edge | Anchor hit area 24px, visible 12px |
| 4 | Drop an edge on blank → create card **and** edge | One undo restores both |
| 5 | Hit areas for edges and anchors | Screen-constant 16px regardless of zoom |
| 6 | Double-click blank → new card, cursor in title | At the click point, no modal |
| 7 | Drag card to neighbour's axis | Snap at 6px, single settle, no magnetic pull |
| 8 | Marquee select | Live count in the selection HUD |
| 9 | Edge labels | On a layer above cards, `pointer-events: none` except the text |
| 10 | Zoom range | 5%–800%, `⌘0` fit, `Shift+2` zoom to selection |

**Adopt / adapt / avoid from Heptabase (via RE):**

| Item | Verdict |
| --- | --- |
| Tab strip with pin/group | Adopt (as §7) |
| Three-column shell with floating toolbars | Adopt |
| Card = white body + tinted header, section = tinted ground + solid top rule | Adopt (the RE build inverted this and it read wrong) |
| Hover anchors, drag-to-blank-creates, zoom-compensated hit areas | Adopt |
| Nested boards + breadcrumb | Adapt: flat in v1; nesting is `[?]` §13 Q2 |
| Arrows on edges by default | Avoid |
| 40-tab sessions | Adapt: rooms pinned + overflow list instead of 40 free tabs |
| Learning layer (mastery, review) | Avoid: different product |

**Thylas-specific additions [P]:**

1. **Reference chips:** a card can hold a chip to a File or Note. Clicking opens it in a tab; the chip remains. Cards never embed a copy.
2. **Live result card:** a card can be bound to a process artifact. It shows the current value and a state dot; it refreshes when the run produces. This is the one place where the canvas is *computational* rather than illustrative — and it is read-only. Thylas does not compute here.
3. **Start from here:** select 2–6 objects → "Start a process with this selection" passes the ids as context to WAM. This is the shortest path from material to execution, and it is the sentence that separates Thylas from a whiteboard app.

### 8.3 Processes

**Job:** show what the system is doing, what it produced, and what needs a human. **Thylas mirrors; WAM executes.**

```
┌ 240 ┬ 40 ────────────────────────────────────────────────┬ 340 ┐
│     │ [Files] [Whiteboard] [Processes]‖ run #12            │     │
│     ├──────────────────────────────────────────────────────┤     │
│     │ All · Running 3 · Needs input 1 · Done        + Start │     │
│     ├──────────────────────────────────────────────────────┤     │
│     │ ▷ baseline-sweep      experiment  ● running  12m  42cr│     │
│     │ ▷ lit-review          task        ◐ needs-you  4m     │     │
│     │ ▷ data-audit          operation   ○ queued    —       │     │
│     │ ▷ draft-methods       task        ✓ done      1h  118cr│     │
│     │ ▷ ablation-7          experiment  ✕ failed    3h   67cr│     │
│     └──────────────────────────────────────────────────────┴─────┘
```

**List columns [P]:** name · type (task / experiment / brainstorm / operation) · state · last activity (mono) · credits (mono) · artifacts count. Filters are the four state groups above, as segmented chips — not a dropdown.

**Detail view layout [P]** — a run tab, four stacked bands, no tabs inside a tab:

| Band | Contains | Editable |
| --- | --- | --- |
| Intent | The user's original instruction, verbatim; the workspace and objects it was given | No (it is a record) |
| Plan | Current plan, plus revision history; each revision shows what changed and why the system says it changed | No |
| Activity | Chronological steps: tool calls, decisions, checkpoints. Mono timestamps. Collapsible groups; artifacts inline as rows | No |
| Output | Artifacts (files, notes, board objects) with `open` actions; a summary; credits consumed | No |
| Controls | Pause · Stop · Resume · Answer · Approve · Re-run with changes | Mirrored |

**[C] Boundary statement to keep in the code comments and the design review:** the five controls above are the *only* controls Thylas may render, and each exists only if WAM exposes the corresponding capability. Thylas has no scheduler, no retry policy, no queue, no model selection logic. If WAM cannot pause, the Pause button does not exist — not "disabled with a tooltip".

**State is the product here.** A run is one of: `queued · running · needs input · succeeded · failed · stopped`. Every surface that shows a process uses the same six words and the same glyph set. `needs input` is the only state that may pull attention (badge, Overview row) because it is the only state where a human is blocking the system.

---

## 9. Notes information architecture

### 9.1 Model

- One Note object, one scope (§4.3). Scope is visible as a chip in the note header, and changeable.
- Two organisational devices only: **Collections** (folders, per scope) and **Tags** (flat, cross-scope, coloured by nothing — a tag is a word, not a colour).
- No nested tags, no backlinks graph in v1 `[?]`, no daily notes in v1.

### 9.2 Layout

```
┌ 240 rail ┬ 40 strip ─────────────────────────────────────┬ 340 panel ┐
│          │ Notes ‖ report-draft                         │ Outline  │
│          ├──────────────────────────────────────────────┤          │
│  All·Personal·Research          ⌘⇧N  ▤  ≡                │ 1 Intro  │
│  ────────────────────────────────────────────────────────│ 2 Method │
│  Collections            │  report-draft                    │ 3 Result │
│   ▸ Method notes        │  Personal · edited 2h ago        │ References│
│   ▸ Reading             │  ────────────────────────────    │  protocol-v3.pdf│
│  Tags                   │  # Method                        │  baseline-sweep │
│   sweeps · baselines    │  We ran three sweeps …           │          │
│  ───────────────────────│                                  │          │
│  ▤ lit-review     2h    │                                  │          │
│  ▤ protocol-v3    1d    │                                  │          │
└─────────────────────────┴──────────────────────────────────┴──────────┘
```

| Element | Decision |
| --- | --- |
| List pane | 240, inside the surface (not the sidebar). Rows: title, scope chip, edited time. Filter chips: scope |
| Reader | Column max 680, serif 16/26. Title in Display serif. Body identical in read and edit mode — one layout, two editabilities |
| Editor | Block editor. Blocks: paragraph, H2/H3, list, quote, code, divider, callout, file reference, note reference, process reference, table (basic) |
| Slash menu | `/` at an empty block. 12 items, keyboard first, no categories until there are 20 |
| Panel | Outline + backlinks + properties. Outline is the default; it is the only navigation aid for a long note |
| Autosave | Save on idle 800ms; a 2px accent line under the header while dirty, gone when saved. No "Saved" toast |

### 9.3 How Notes relates to Workspace

| Situation | Where it appears |
| --- | --- |
| Note in Personal scope | Notes library (scope filter **Personal**). Not in any workspace |
| Note in workspace scope | Notes library (scope filter = that workspace) **and** the workspace's Notes group in the sidebar |
| Note referenced by a board | A chip on the card. The note stays in Notes |
| Note produced by a process | Appears in the run's Output band, and in Notes with a `produced by` property |

**One sentence the UI must make true:** *a note lives in one place and can be pointed at from many.* If a prototype ever shows the same note in two lists without a scope chip explaining why, the prototype is wrong.

---

## 10. Account and settings hierarchy

### 10.1 Three levels, three entry points

**[C]** The most common settings failure is mixing personal, organizational, and spatial settings into one list. Thylas keeps three separate frames:

| Level | Answers | Entry point | Never contains |
| --- | --- | --- | --- |
| **Account** | Who am I, what plan am I on, what can I consume, what keys do I hold | Sidebar → Account, or profile row | Workspace names, member lists, board settings |
| **Organization** | Who is in my team, what do they cost, what is shared | Account → Organization (admins), or the org switcher's menu | Personal API keys, personal preferences |
| **Workspace** | What is this space, who can enter, what does it retain | Workspace `⋯` → Settings (a tab) | Billing, personal profile |

### 10.2 Account subsections

```
Account
├── Profile            name · email · avatar · sign-in methods · delete account
├── Plan & billing     current plan · change plan · payment method · invoices
├── Usage & quota      credits consumed / included · reset date · breakdown · storage
├── API keys           create · reveal once · revoke · last used · scopes
└── Preferences        appearance · editor · shortcuts · notifications · language
```

### 10.3 Usage and quota display

**[C]** No invented numbers. Every value comes from the backend; the design fixes *how* it is shown, not what it says.

| Element | Rule |
| --- | --- |
| Plan name | Always shown next to the profile row. A user should never have to open settings to know what they bought |
| Credits | One number, mono, with the period: `1,240 / 2,000 · resets 12 Dec`. Not a percentage alone |
| Storage | Same shape. Bytes in mono, binary units |
| Near limit | ≥ 85%: `state/warn` text on the number. ≥ 100%: the number turns `state/error` and the next action that would spend is blocked **with the reason inline**, not a modal |
| Breakdown | Per dimension (model, runs, storage), per workspace for org members. Table, not a chart |
| Empty/unknown | If a dimension is not metered, it is absent. Do not show `0 / ∞` |

**Where quota appears outside Account [P]:** in the Processes detail (credits per run) and in the run-start confirmation (estimated range `[A]` — only if WAM can estimate). Never as a persistent header meter; that turns the workspace into a billing page.

### 10.4 API keys

**[P]** Account → API keys is a developer surface inside a consumer product. Keep it one screen: list (name, prefix, created, last used, scopes), create (name + scope checkboxes + one-time reveal), revoke (typed confirmation). Link out to documentation, and note honestly that documentation is not published yet (`CHORD site`: "In preparation").

### 10.5 Preferences

Five groups, flat, no sub-pages: Appearance (density, zoom, theme `[?]`), Editor (font, width, spellcheck), Shortcuts (read-only list in v1), Notifications (process states, product), Language. Each item is a row with the control on the right; no cards.

---

## 11. Major user journeys

Each journey lists the surfaces, the clicks, and the one thing that would make it fail. "WAM" marks a call that leaves the application layer.

### J1 · First-time user enters Thylas

| # | Surface | What happens |
| --- | --- | --- |
| 1 | Auth | Sign in. Account created → **Personal workspace created automatically** `[A]` |
| 2 | Overview | Not an empty dashboard. Three rows: one intent input, one "start from material" drop zone, one line of what the system can do |
| 3 | Overview | Typing into the intent input and pressing Enter creates a **process** (a WAM run) with that text as intent. The run tab opens |
| 4 | Process tab | The user sees intent → plan → activity within seconds. This is the product explaining itself by working |
| 5 | Alternative 3' | Dropping a file instead creates a File in the Personal workspace root and offers two actions: *open it* / *start a process with it* |
| 6 | Overview, later | The same input remains, now showing "continue" entries instead of guidance |

**Fails if:** step 2 shows zero-value metric tiles, or step 3 requires choosing a workspace, a model, or a template first. Target: **sign-in → first artifact ≤ 60s, ≤ 2 decisions.**

### J2 · Returning user accesses recent work

| # | Surface | What happens |
| --- | --- | --- |
| 1 | Overview | "Continue" shows the last 3 sessions: workspace · last object · timestamp. One click restores workspace + tab + scroll/viewport |
| 2 | Overview | "Needs you" lists only `needs input` runs and failed runs. Empty → the block is absent, not an empty state |
| 3 | Recently | Full list, grouped by day, filterable by type |
| 4 | ⌘K | Typing a name searches objects directly; results grouped by type with workspace chips |

**Fails if:** resuming requires re-navigating the sidebar, or "Continue" restores a tab but not the position inside it.

### J3 · Switching between personal and organizational workspaces

| # | Surface | What happens |
| --- | --- | --- |
| 1 | Sidebar | Switcher lists Personal (marked) + organizations with role badges |
| 2 | Sidebar | Selecting `Research` replaces the room group, the tab strip, and the surface |
| 3 | Surface | 1.2s indicator: `Research · ORG · Member`. Then gone |
| 4 | Context panel | Any open panel state that does not apply to the new workspace closes (e.g. a file's metadata) |

**Fails if:** tabs from Personal remain visible under `Research`, or the user cannot tell which scope they are in without opening the switcher. **Scope must be readable at rest**, which is why the scope badge sits on the switcher row and not only in a menu.

### J4 · Opening and managing workspace tabs

| # | Action | Result |
| --- | --- | --- |
| 1 | Click `◇ Whiteboard` room | Room tab activates; board index lists boards |
| 2 | Click a board | Board appends as an object tab; the room tab stays |
| 3 | Open 6 boards | Strip scrolls; `⋯` lists all with filter |
| 4 | Right-click a board tab → Pin | It moves to the pinned object group, icon-first |
| 5 | `⌘W` on a board tab | Closes the tab. The board still exists; room tab is now active |
| 6 | `⌘⇧T` | Restores it with its viewport |
| 7 | `⌘W` on the Files room tab | Refuses, with an inline reason: rooms are not closable |
| 8 | Reopen the workspace next day | Same tabs, same active tab, same viewport |

**Fails if:** closing a tab ever deletes content, or a running process moves the user's focus.

### J5 · Creating and editing a note

| # | Surface | What happens |
| --- | --- | --- |
| 1 | Sidebar `+` → New note | Note created in the **current scope** (Personal if none active), opened as a tab, cursor in title |
| 2 | Editor | Title (serif display) → body. `/` inserts blocks. `[[` references a file/note/run |
| 3 | Header | Scope chip shows `Personal`; clicking moves it into a workspace with a confirmation naming the destination |
| 4 | Panel | Outline builds from headings; a reference list builds from `[[` and pasted links |
| 5 | Sidebar → Notes | The note appears under scope=Personal, and disappears from a workspace view it was never in |

**Fails if:** creating a note requires choosing a location first, or the same note shows in two lists without a scope chip.

### J6 · Accessing Files, Whiteboard, Processes

| # | Action | Result |
| --- | --- | --- |
| 1 | Files: drop 3 PDFs onto the surface | Rows appear as skeletons with per-file progress, then real rows. Destination path visible during the drop |
| 2 | Files: double-click a PDF | Preview tab. Panel shows metadata + "used by" |
| 3 | Whiteboard: open a board, drag 2 files from the Files room **onto the canvas** | Two media objects, referencing the same files (no copies) |
| 4 | Whiteboard: drag from a card's edge anchor to blank | New card + edge, one undo |
| 5 | Whiteboard: select 3 cards → `Start a process with this selection` | **WAM** receives the ids as context; a run tab opens; the cards get a `bound` state dot |
| 6 | Processes: the run reaches `needs input` | Room badge + Overview row. The run tab shows the question inline with two options from WAM |
| 7 | Processes: answer | Run resumes; the activity band appends the decision |

**Fails if:** step 3 duplicates files, step 5 invents a planning UI, or step 6 requires a toast to be noticed.

### J7 · Managing subscription and API settings

| # | Surface | What happens |
| --- | --- | --- |
| 1 | Profile row | Shows plan name at rest |
| 2 | Account → Usage & quota | Credits `1,240 / 2,000 · resets 12 Dec`, storage, per-workspace breakdown |
| 3 | Account → Plan & billing | Current plan, change plan, payment method, invoices |
| 4 | Somewhere that would spend credits | If over limit: the action is blocked inline with the reason and a link to Plan. No modal, no silent failure |
| 5 | Account → API keys | Create (name + scopes) → one-time reveal → copy. List shows `last used` |
| 6 | Revoke | Typed confirmation; the row shows `revoked` and stays for 30 days `[?]` |

**Fails if:** quota is only discoverable after a failure, or workspace billing appears inside Personal Account.

---

## 12. Low-fidelity prototype plan

Nine frames. Each frame exists to answer one structural question; if a frame does not change a decision, it should not be drawn.

| ID | Frame | The question it answers | Success looks like |
| --- | --- | --- | --- |
| P01 | Overview | Can a returning user resume in one click, and a new user start in one input, on the same screen? | Both paths visible without scrolling at 1440×900 |
| P02 | Sidebar expanded + workspace navigation | Does the rail survive 2 workspaces + 1 org + a room list without becoming a tree? | ≤ 3 depth levels, ≤ 14 rows above the fold |
| P03 | Workspace with tabs (board open) | Is "where am I" legible with 3 rooms + 4 object tabs? | Pinned rooms visibly different from objects; active state readable at a glance |
| P04 | Files view | Is a file row information-dense without a table feeling? | 5 columns readable at 1440; preview path obvious |
| P05 | Whiteboard | Does the canvas read as paper with structure, not as a card UI? | Card = surface + tinted header; one accent element on screen |
| P06 | Processes list + run detail | Can a non-expert tell what the system is doing and what needs them? | State words and glyphs identical across list, tab, Overview |
| P07 | Notes | Does Notes look like a different *material* (reading) while sharing the shell? | Serif body, 680 column, list still 13px UI type |
| P08 | Account + subscription | Are person / org / workspace settings unmistakably separate? | No workspace name appears in Account; plan visible at rest |
| P09 | Variant sheet | Which sidebar organisation wins? | 3 variants compared on the stated criteria, one chosen |

**Variant sheet (P09)** — three sidebar organisations, compared:

| Variant | Structure | Wins | Loses |
| --- | --- | --- | --- |
| V1 Flat five | Five areas, workspace as one expandable group | Fewest concepts; matches the brief | Rooms of non-active workspaces are invisible; poor for 5+ workspaces |
| V2 Workspace-first | Rail lists workspaces as top-level rows; all five areas become rooms of the active workspace | Clear ownership; scales to many workspaces | "Recently" and "Account" do not belong to a workspace, so the frame lies |
| V3 Five areas + scoped workspace group **(chosen)** | As V1, but the workspace group shows one active workspace expanded and others collapsed with scope badges | Keeps the given IA, scales to many workspaces, scope always visible | Needs one more visual pattern (badge + collapsed group) than V1 |

Chosen because it is the only variant where every area keeps its true scope, and because collapsing inactive workspaces is what makes 40 workspaces survivable. V2 solves the wrong problem: it makes ownership the top-level axis when the brief's top-level axis is *what kind of thing am I looking at*.

**[C]** Prototypes are structural. No shadows, no real illustrations, no final micro-interaction. Wireframes exist to be argued with.

`design/prototypes/low-fi-wireframes.html` holds P01–P09 as an annotated sheet, drawn in the Quiet Computationalism tonal palette so hierarchy can be judged in the right material.

---

## 13. Unresolved questions

Defaults are what we will build if no evidence arrives. None of these should block prototyping; all of them block implementation of the affected screen.

| ID | Question | Alternatives | Default | How to resolve |
| --- | --- | --- | --- | --- |
| Q1 | Can one note be readable by two scopes? | (a) no, one scope (b) share into a workspace (c) fork a copy | (a) | Talk to 3 users with multi-workspace accounts; measure "where did my note go" incidents |
| Q2 | Do boards nest? | (a) flat, sections only (b) parent/child with breadcrumb | (a) | Prototype a 60-card board; if sections are insufficient, add nesting |
| Q3 | Is real-time collaboration in v1? | (a) no, last-write-wins + presence-free (b) presence only (c) full co-editing | (a) | Depends on backend; presence changes the tab strip and canvas chrome |
| Q4 | Does the process tab own the run's lifecycle? | (a) no, runs live server-side; closing a tab is free (b) warn on close while running | (a) | Confirm with WAM: is state durable across client disconnect |
| Q5 | Recently: global or per-workspace? | (a) global (b) per-workspace (c) both with a toggle | (a) | Watch 5 users cross workspaces for a week |
| Q6 | One file referenced by two workspaces | (a) belongs to one; the other references by grant (b) copy (c) shared pool | (a) | Legal/pricing input: who pays storage, who can revoke |
| Q7 | Dark mode in v1? | (a) no (b) yes, warm charcoal inversion | (a) | Test a 3-hour session in light; if eye strain is reported, promote |
| Q8 | Search: what does Thylas index? | (a) names + extracted text + tags, lexical (b) + semantic via WAM | (a), semantic offered as an explicit WAM action | Needs the indexing pipeline; do not promise semantic search in the ⌘K placeholder |
| Q9 | Does the sidebar show file counts? | (a) no counts, only state badges (b) counts everywhere | (a) | Counts are noise unless they change a decision |
| Q10 | Mobile / tablet | (a) out of scope (b) read-only viewer | (a) | Explicitly out; the density targets are 1440 desktop |
| Q11 | When does a workspace get created for a new org member? | (a) org admin creates, members join (b) auto-create a personal-in-org space | (a) | Product decision with pricing implications |
| Q12 | Process types in v1 | (a) all four labels (task/experiment/brainstorm/operation) (b) one generic type | (b) unless WAM distinguishes behaviour | Ask WAM: do the four types change execution, or only naming? |

---

## 14. Recommended next steps

| # | Step | Output | Depends on |
| --- | --- | --- | --- |
| 1 | Validate Q1, Q5, Q12 with 3 users and one WAM conversation | Short note appended to this document | — |
| 2 | Take P01, P03, P05 to **hi-fi** (one screen each), in the real palette and type | 3 clickable screens | Step 1 defaults are acceptable |
| 3 | Write the token file (`tokens.css`: colour, type, space, motion) as the single source for prototype and app | 1 CSS file + a visual sheet | This document §3 |
| 4 | Reconcile the Processes UI with WAM's actual capability list | A table: capability → control → absent/present | WAM interface |
| 5 | Component inventory from the 9 frames (target ~40 parts, not 68) | Component contract table | Frames settled |
| 6 | Canvas interaction spec with thresholds (§8.2 floor) as acceptance tests | Spec + probe scripts later | Step 2 |
| 7 | Only then: implementation plan with vertical slices per room | Engineering plan | All above |

**Explicitly not next:** building the app, choosing a frontend stack, writing production components, designing pricing pages, or adding a sixth sidebar area.

---

## Appendix A · Component inventory (target ~40)

| Group | Components |
| --- | --- |
| Shell | AppShell · Rail · RailSection · WorkspaceSwitcher · ProfileRow · ContextStrip · Tab · TabStrip · ContextPanel |
| Navigation | RecentlyRow · TypeGlyph · ScopeBadge · StateDot · CommandPalette |
| Content | FileRow · FileTree · BoardCard · BoardCanvas · CardNode · SectionBox · TextNode · MediaNode · Edge · Minimap · ZoomDock · CanvasToolbar · SelectionHUD |
| Process | ProcessRow · StateChip · RunTimeline · PlanRevision · ArtifactRow · ControlBar |
| Notes | NoteListRow · NoteEditor · BlockEditor · SlashMenu · Outline · ReferenceList |
| Account | SettingsRow · MeterRow · KeyRow · PlanCard |
| Primitives | Button · IconButton · Input · Popover · Tooltip · EmptyState · Divider · Progress |

Every component follows three rules: renders from its inputs only; emits events instead of mutating anything; takes all colour, size, and radius from tokens.

## Appendix B · Canonical words

One word per concept, used in UI, code, and documents. Synonyms are bugs.

| Use | Not |
| --- | --- |
| **Workspace** | space, project, team, vault |
| **Room** (Files / Whiteboard / Processes) | section, tab group, module |
| **Board** | canvas, whiteboard file, page |
| **Note** | doc, document, page, file |
| **File** | asset, attachment, upload |
| **Process** (the object) · **Run** (one execution) | job, task (as a noun for the object), agent |
| **Tab** | view, window |
| **Scope** (personal / organization) | ownership, tenancy |
| **Recently** | history, activity, recents |
| **Organization** | org (in UI), team, company |

`Process` vs `task`: "task" is a *type* of process, not a synonym for it. A board card is a card, never a note.

## Appendix C · Where this deviates from the brief, and why

| Brief | This document | Reason |
| --- | --- | --- |
| Five sidebar areas | Kept, unchanged | Adding a sixth ("Search", "Trash", "Templates") is the failure mode the brief warns about |
| Workspace contains Files / Whiteboard / Processes | Kept, plus a scoped Notes group | Without it, workspace notes have no navigation home (§4.3 D) |
| Notes: unresolved global vs workspace | Resolved as one object, one scope, two views | The brief asks not to decide silently; §4.3 states the alternatives and the cost |
| Tab model open | Resolved as context-scoped, typed, rooms pinned | §7.2 shows the two rejected models and what they lose |
| "Do not add many navigation categories" | Honoured: 5 areas, 3 rooms, 0 extras | — |
| Low-fi prototypes: 8 frames | 9 frames (added a variant sheet) | Phase 4 requires comparing alternatives; a comparison needs to be drawn, not described |
