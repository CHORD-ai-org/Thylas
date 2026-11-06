# Thylas
A unified environment to organize resources, operate agents, and build with CHORD.

Thylas (τ) is the application layer of CHORD. WAM owns intent, planning, and execution; Thylas owns the workspace, the material, and the view into delegated work.

## Where things are

| Path | Contains | State |
| --- | --- | --- |
| [`docs/`](docs/README.md) | Product definition, responsibility boundaries, application architecture, source file plan, roadmap | Proposed |
| [`docs/product/definition.md`](docs/product/definition.md) | What Thylas is and is not, the responsibility matrix, what v1 must close | Proposed |
| [`docs/planning/file-plan.md`](docs/planning/file-plan.md) | The file-level implementation blueprint | Proposed |
| [`docs/design/`](docs/design/visual-system.md) | Visual system, spatial language, component guidelines, interaction model — as built | Implemented |
| [`design/`](design/README.md) | Visual system (`tokens.css`), nine-screen clickable prototype, UI design plan | Complete draft |
| [`src/`](src/main.tsx) | The application: shell, Overview, Files, Whiteboard, Processes, Notes, Recently, Account | Implemented, sample data |
| [`AGENT.md`](AGENT.md) | Reasoning protocol for product boundary questions | — |

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit && vite build
```

Stack: Vite 6 · React 19 · React Router 7 · CSS Modules against `design/tokens.css`. No UI kit, no CSS framework, no data layer.

**What works:** navigation, workspace switching, context-scoped tabs with persistence, the context panel and its resize, the `⌘K` palette, file/board/run selection, filters, rail collapse, density preference.

**What is sample data:** every workspace, file, note, board and run in `src/data/mock.ts`. Numbers on screen are layout, not claims.

**What is not wired:** upload, creating anything, submitting an intent, run controls, note editing, board editing, file preview. Each attempt says so in one sentence, inline, and sends nothing.

## Open before implementation

Three unknowns block screens, not documents: **N1** WAM transport, **N2** who owns authentication and authorization, **N5** whether the browser can reach WAM directly. See [`docs/architecture/application.md`](docs/architecture/application.md) §9.
