# Thylas
A unified environment to organize resources, operate agents, and build with CHORD.

Thylas (τ) is the application layer of CHORD. WAM owns intent, planning, and execution; Thylas owns the workspace, the material, and the view into delegated work.

## Where things are

| Path | Contains | State |
| --- | --- | --- |
| [`docs/`](docs/README.md) | Product definition, responsibility boundaries, application architecture, source file plan, roadmap | Proposed |
| [`docs/product/definition.md`](docs/product/definition.md) | What Thylas is and is not, the responsibility matrix, what v1 must close | Proposed |
| [`docs/planning/file-plan.md`](docs/planning/file-plan.md) | The file-level implementation blueprint | Proposed |
| [`design/`](design/README.md) | Visual system (`tokens.css`), nine-screen clickable prototype, UI design plan | Complete draft |
| [`AGENT.md`](AGENT.md) | Reasoning protocol for product boundary questions | — |

**No application code yet.** There is no `package.json` and no `src/`. The first implementation step is described in [`docs/planning/roadmap.md`](docs/planning/roadmap.md) §7.

## Open before implementation

Three unknowns block screens, not documents: **N1** WAM transport, **N2** who owns authentication and authorization, **N5** whether the browser can reach WAM directly. See [`docs/architecture/application.md`](docs/architecture/application.md) §9.
