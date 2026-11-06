# design/

Product and UI design for Thylas (τ). **No application code** — tokens and a clickable prototype only.

This directory owns what the product looks like. What it *is*, where its responsibilities end, how it is built, and in what order: [`../docs/`](../docs/README.md).

| File | What it is | State |
| --- | --- | --- |
| [`thylas-ui-design-plan.md`](thylas-ui-design-plan.md) | The plan: positioning, research, visual system, IA, workspace model, tabs, rooms, notes, settings, journeys, open questions, next steps | Complete draft |
| [`tokens.css`](tokens.css) | Colour, type, space, radius, elevation, motion. Single source for prototype and (later) app | Complete |
| [`prototypes/low-fi-wireframes.html`](prototypes/low-fi-wireframes.html) | Nine low-fidelity wireframes (P01–P09) with numbered annotations | Complete draft |
| [`prototypes/hi-fi.html`](prototypes/hi-fi.html) | Clickable prototype: 9 screens, tab management, panel, command palette | Working prototype |

Open the HTML files in a browser at 1440×900. The hi-fi prototype links `../tokens.css`; moving it elsewhere breaks the styling.

---

## The hi-fi prototype

Nine screens, reachable from the sidebar and from within the product:

| Route | Screen | What it exercises |
| --- | --- | --- |
| `#overview` | Overview | intent input, Continue, Needs you, workspaces, recently |
| `#recently` | Recently | cross-type history, type filter chips, day grouping |
| `#files` | Workspace → Files | folder tree + file table, row selection drives the context panel, double-click opens a preview tab |
| `#boards` | Workspace → Whiteboard | board index |
| `#board` | Board detail | canvas, sections, cards, edges, selection HUD, minimap, zoom dock |
| `#processes` | Workspace → Processes | state chips, process table |
| `#run` | Run detail | Intent / Plan / Activity / Output bands, mirrored controls |
| `#notes` | Notes | note list, reading column, scope + references panel |
| `#account` | Account | plan, usage meters, API keys, organization boundary |

Interactions that actually work: room and object tabs (close an object tab, the room stays), double-click a file to open it, note tabs switch the reader, `⌘K` palette, `⌘\` toggles the context panel, `⌘1/2/3` jump to rooms, sidebar collapse (persisted), Recently type filters.

Deliberately static: no persistence, no real data, no canvas dragging or zoom, no editing, no collaboration, no dark mode. Every number on screen is placeholder content, not a product claim.

## What is decided vs. proposed

The plan labels every claim **[C]** confirmed, **[P]** proposed, **[?]** open, or **[A]** assumption. Read §0 before arguing with any of it.

The five decisions a reviewer is most likely to want to reopen:

| # | Decision | Where | Why it is the way it is |
| --- | --- | --- | --- |
| 1 | Notes is one object with one scope, shown through two views | §4.3 | Alternatives A/B/C each break either ownership or first-run. Cost: one scope filter |
| 2 | Tabs are context-scoped, typed, with rooms pinned | §7.1–7.2 | A global strip decouples "where am I" from the sidebar; rooms-only strips leave no location |
| 3 | Every room tab is an index, every object tab is a detail | §7.1 | One depth per tab removes the "what is a tab?" argument permanently |
| 4 | Process controls are mirrored from WAM, never invented | §8.3 | Architectural boundary. A missing capability means an absent button |
| 5 | Sidebar keeps five areas, with one scoped workspace group | §5, §12 P09 | Only variant where every area keeps its true scope and 40 workspaces stay survivable |

## What must be answered before implementation

§13 lists twelve open questions. Three block real screens: **Q1** (can a note be shared across scopes), **Q5** (global vs per-workspace Recently), **Q12** (do process types change behaviour or only naming).

## What is deliberately out of scope

Frontend implementation, stack choice, pricing pages, mobile, dark mode, collaboration, and any semantic reasoning inside Thylas. See §1.2 for the boundary and §14 for what comes next.
