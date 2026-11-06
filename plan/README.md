# plan/ — Thylas UI MVP, decomposed

**What this is.** `docs/planning/ui-mvp-plan.md` is the *decision* document: scope, sprints, gates, stop rules. This folder is the *execution* set: one sub-plan per unit of work, each small enough to finish and verify in a day or two.

**How to use a sub-plan**

1. Read its **Objective** and **Done when** first. If the Done-when list cannot be checked by a command or a screenshot, the sub-plan is wrong — fix the sub-plan, not the scope.
2. Work only the **Files** it lists. A file not listed is a scope question, not a detail.
3. Run its **Verify** block. Paste the output into the commit message.
4. Flip its **Status** here to `done` and fill the date. Never mark done without the command output.

**Rules**

- One sub-plan = one branch = one commit (English message, body contains the Verify output summary).
- No new dependencies. No source change outside the Files list. No backend, no editor, no canvas editing.
- If a sub-plan needs a service that does not exist, convert the affordance to *disabled-with-reason* and note it in the sub-plan; do not stub a service.
- Numbers in sub-plans (line references, class names) are from commit `775f34a`. Verify before editing; the code moves.

---

## Status board

| ID | Sub-plan | Sprint | Est | Gate | Blocked by | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | [Typography foundations](01-typography.md) | S1 | 2.5d | G1 | — | not started |
| 02 | [Shell](02-shell.md) | S1 | 2.5d | G1 | 01 | not started |
| 03 | [Overview](03-overview.md) | S2 | 1.5d | G2 | 02 | not started |
| 04 | [Files](04-files.md) | S2 | 1.5d | G2 | 02 | not started |
| 05 | [Notes](05-notes.md) | S2 | 1.0d | G2 | 02 | not started |
| 06 | [Shared grammar](06-grammar.md) | S2 | 0.5d | G2 | 03–05 (first consumer) | not started |
| 07 | [Processes and runs](07-processes.md) | S3 | 1.5d | G3 | 06 | not started |
| 08 | [Whiteboard](08-whiteboard.md) | S3 | 1.5d | G3 | 02 | not started |
| 09 | [States, honesty, keyboard](09-states-honesty.md) | S3 | 2.0d | G3 | 04, 05, 07 | not started |
| 10 | [Account and Recently](10-account-recently.md) | S4 | 1.0d | G4 | 06 | not started |
| 11 | [Motion and accessibility](11-motion-a11y.md) | S4 | 1.75d | G4 | 09 | not started |
| 12 | [Verification and handover](12-verification.md) | S4 | 0.75d + buffer | G4 | 01–11 | not started |

## Dependencies

```
01 typography ─▶ 02 shell ─┬─▶ 03 overview ─┐
                            ├─▶ 04 files ────┼─▶ 06 grammar ─┬─▶ 07 processes ─┐
                            ├─▶ 05 notes ────┘               ├─▶ 08 whiteboard ┤
                            │                                └─▶ 10 account ───┤
                            └─────────────────────────────────▶ 09 states ─────┼─▶ 11 motion/a11y ─▶ 12 verification
```

`06 grammar` is written **after** the first consumer exists, never before: it extracts what 03–05 actually duplicate.

## Gates

| Gate | When | Command / evidence |
| --- | --- | --- |
| **G1** | after 02 | `npm run check`; `grep -rE "font-size: [0-9.]+px" src` only tokens; `grep -rn "450\|550" src design` → 0; screenshots rail/tab/panel |
| **G2** | after 06 | above + `grep -c "\.notice {" src/pages/*.css` ≤ 3; note column measured 660–680px; Files columns at 1280/1440 |
| **G3** | after 09 | `grep -rn "1032\|560" src` → only `scene.ts`; `grep -rn "onClick" src | grep -E "span|div"` → 0; zero reachable "Nothing was sent" |
| **G4** | after 12 | `npm run gates`; CDP suite 24/24; Lighthouse ≥ 90; JS ≤ 160 KB gzip; logo-covered identity test |

## Decision log

Defaults are in force until a human says otherwise. Record any change here with a date and one line of reason.

| # | Decision | Default | Changed |
| --- | --- | --- | --- |
| M1 | Secondary ink `#75604B`, button fill `#A0553A` (AA fixes) | adopt | — |
| M2 | No serif anywhere (no Plex Serif in the reading column) | remove | — |
| M3 | `design/tokens.css` frozen; app tokens live in `src/styles/` | freeze | — |
| M4 | Remove "New workspace" / "New board" affordances | remove | — |
| M5 | Index tick (6px rule) before section labels | adopt | — |
| M6 | Chinese: render only, no translation | render only | — |

## Task-ID mapping

| MVP task (`docs/planning/ui-mvp-plan.md`) | Sub-plan |
| --- | --- |
| S1-T1, T2, T3 | 01 |
| S1-T4, T5, T6 | 02 |
| S2-T1 | 03 |
| S2-T2 | 04 |
| S2-T3 | 05 |
| S2-T4 | 06 |
| S2-T5 | folded into 12 |
| S3-T1 | 07 |
| S3-T2 | 08 |
| S3-T3, T4, T5 | 09 |
| S4-T1 | 10 |
| S4-T2, T3, T4 | 11 |
| S4-T5, T6 | 12 |
