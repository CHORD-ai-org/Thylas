# SP-07c · Process states, controls, labelled simulator

**Parent:** [SP-07](SP-07-ai-and-processes.md) · **Days:** 0.75 · **Status:** Completed 11-08 · **Depends:** SP-03b

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

## Result

| # | Task | Result |
| --- | --- | --- |
| T1 | Filter in URL + counts | done — `?state=needs_input` is a link; a reload keeps it; an unknown value falls back to `all` rather than to an unexplained empty list |
| T2 | Capability-gated controls | done — buttons are generated from `capabilities`, so `run-lit` (answer, stop) draws no Pause and `run-baseline` (stop, pause) does |
| T3 | Simulator | done — one quiet control in the run header, 700 ms, walks `queued → running → needs you → done`, labelled `simulated` beside it and in the panel chip once the copy differs from the sample |
| T4 | Empty/loading/error | done — the empty state names the filter and offers `Show all`; a retry draws three static rows for 700 ms; `?fail=1` draws a band with `Try again` |
| T5 | Remove apologies | done — the Start button is gone, replaced by a permanent sentence about WAM; `grep -rn "Nothing was sent" src` → 0 |

**Beyond scope, present:** the local override is persisted (`thylas:runs:v1`) and shared between the list and the detail through a small store, so "the list reflects it without a reload" survives leaving the page; a list row whose state was changed says `simulated · local copy` in the Activity column instead of showing the sample's activity; the run's activity list gains one line saying the state was set in this browser and the run did not move.

**Deviations:** (1) A capability control **changes the local copy** when pressed. The spec only asked that the buttons exist, but after T5 there were three options and two of them were dishonest: an apology (banned), nothing at all (a dead button), or a visible local change. The third is labelled everywhere. (2) `pause` lands on `queued`, because the state set has no `paused` and inventing a seventh word for one button would put a state in the UI that WAM may never emit (D-040). (3) The loading state is drawn on `Try again` (700 ms) rather than behind a second query: it is a state of the retry, not a place. (4) The filter reads `Needs you`, not `Needs input`, so the filter and the state word are the same word.

## Acceptance

1. `?state=needs_input` shows only those runs; reload preserves the filter; removing `pause` from a mock run removes the button. — met: one row, `states: ["needs you"]`, the tab selected; reload keeps `?state=needs_input` and one row; the two runs' button sets are `[Stop, Pause]` and `[Answer, Stop]`.
2. Simulator advances state and the list reflects it without reload; label "simulated" visible on the surface. — met: `Simulating…` for 700 ms, then the kicker reads `done`; going back to the list shows `lit-review … done … simulated · local copy`.
3. A filter with zero results names the filter and offers "show all". — met: `No run in this workspace is running.`, `Running 0`, and a `Show all` that clears both the rows and the query.
4. `?fail=1` renders an error banner with retry; retry clears it. — met: `role="alert"` naming `?fail=1`, `Try again` draws three static rows, then the band and the query are both gone.
5. `grep -rn "Nothing was sent" src` → 0. — met, asserted in the e2e by reading the source.

## Validation

`npm run e2e` — thirteen new assertions: URL filter and reload, empty filter with counts, `Show all`, the failure band, three static rows, the retry, two capability sets, a control changing the local copy, the simulator's working state and its arrival, the list reflecting it, and the source grep. `npm test` — 17 pure cases over `data/runs.ts` (parse, partition, walk, outcomes) and 6 over the store (a hand-edited payload cannot reach the UI). Screenshots in `.workbuddy/shots/sp07c-{all,empty,fail,detail,simulated,advanced}.png`.

## Risks

- Simulator can be mistaken for WAM; the label and the code comment are both required, and the control must not look like a primary action.
- URL-held filters must reset when the workspace changes, or a link appears empty for the wrong reason.
