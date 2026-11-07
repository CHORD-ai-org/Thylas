# SP-07c · Process states, controls, labelled simulator

**Parent:** [SP-07](SP-07-ai-and-processes.md) · **Days:** 0.75 · **Status:** Not Started · **Depends:** SP-03b

## Objective

Finish the process interface so it can be judged: five states that read distinctly, controls that exist only when the run exposes them, and a simulator that is visibly a simulator.

## Scope

**In:** filters (all/running/needs you/done) with counts; row grammar via `grammar.tableHead`; run detail bands; control bar from `capabilities`; a `simulate` control that advances a mock run's state; empty/loading language.
**Out:** WAM, real run submission, artifact ingestion, retry logic.

## UX

- State is a word plus a 6px dot; `needs you` is the only warn-coloured text on the surface.
- Controls: `pause`/`stop`/`answer`/`approve`/`rerun` appear only if present in the run's capability list; removing one from the mock removes the button.
- Because nothing executes, a run does not move on its own. A small `simulate` control in the run header advances `queued → running → needs you → done` with a 700ms delay and is labelled **simulated** in the UI and in code.
- Filters show counts; a filter with no matches says which filter, not "no data".
- Loading: three static rows; error: banner with retry (retry is local and honest).

## Visual

Parent §E. No coloured rows; no progress bars; the activity log uses a mono time gutter. Simulator control is `quiet`, not the primary button.

## Technical plan

- `Processes.tsx`: derive rows from selectors; filter state in the URL query (`?state=running`) so a filtered view is shareable.
- `RunDetail.tsx`: render bands; `ControlBar` maps capabilities; disabled reason where a capability is absent but the run is not local.
- `data/mock.ts` gains `simulateRun(id)` returning the next state; the UI calls it behind a labelled control and writes to a local override map, not to the mock module.
- Loading/error props are simulated with a `?fail=1` query for the e2e run.

## Tasks

| # | Task | Result |
| --- | --- | --- |
| T1 | Filter in URL + counts | Shareable filtered views |
| T2 | Capability-gated controls | No invented button |
| T3 | Simulator | State advances, labelled |
| T4 | Empty/loading/error | Three states drawn |
| T5 | Remove apologies | No post-click explanation |

## Acceptance

1. `?state=needs_input` shows only those runs; reload preserves the filter; removing `pause` from a mock run removes the button.
2. Simulator advances state and the list reflects it without reload; label "simulated" visible on the surface.
3. A filter with zero results names the filter and offers "show all".
4. `?fail=1` renders an error banner with retry; retry clears it.
5. `grep -rn "Nothing was sent" src` → 0.

## Validation

e2e: filter deep link, capability removal, simulator step, failure banner; screenshots of five states and three emptiness cases.

## Risks

- Simulator can be mistaken for WAM; the label and the code comment are both required, and the control must not look like a primary action.
- URL-held filters must reset when the workspace changes, or a link appears empty for the wrong reason.
