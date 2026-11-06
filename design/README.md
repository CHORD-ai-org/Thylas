# design/

Product and UI design for Thylas (τ). **Planning artifacts only — no application code.**

| File | What it is | State |
| --- | --- | --- |
| [`thylas-ui-design-plan.md`](thylas-ui-design-plan.md) | The design plan: positioning, research, visual system, IA, workspace model, tabs, rooms, notes, settings, journeys, open questions, next steps | Complete draft |
| [`prototypes/low-fi-wireframes.html`](prototypes/low-fi-wireframes.html) | Nine low-fidelity wireframes (P01–P09) with annotations, in the Quiet Computationalism palette | Complete draft |

Open the wireframe sheet in a browser at ≥1360px wide. Frames are drawn at 1440×900 and scaled 0.9.

---

## What is decided vs. proposed

The plan labels every claim **[C]** confirmed, **[P]** proposed, **[?]** open, or **[A]** assumption. Read §0 of the plan before arguing with any of it.

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
