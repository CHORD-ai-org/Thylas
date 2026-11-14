# Coworkers — development documents

**Product authority:** [`docs/product/coworkers/`](../../product/coworkers/README.md) (D-054).
Development docs describe what shipped and what is proposed; they do not amend the
product model.

| Read | File | State | Answers |
| --- | --- | --- | --- |
| 1 | [`PLAN.md`](PLAN.md) | 11-12, pre-code snapshot | Original audit and the four-route IA. Its "No Coworker code exists" line is historical. |
| 2 | [`IMPLEMENTATION.md`](IMPLEMENTATION.md) | 11-12, shipped | The four pages, the v1 store, honesty rules, verification numbers (309 unit / 302 e2e at the time). |
| 3 | [`AVATAR-VISUAL-SYSTEM.md`](AVATAR-VISUAL-SYSTEM.md) | 11-14, v1.0 style guide | Fixed vs customizable avatar elements, prompt anchors, negative prompt, `thylas-coworker-avatar` skill workflow, validation checklist. **No avatar code exists.** |
| 4 | [`DESIGN.md`](DESIGN.md) | 11-14, design specification + one isolated implementation | The 8 task-brief deliverables: Vision, Domain Model, Creation UX (incl. avatar), Mind Framework & Methodology, Collaboration Model, Minimal Scenario, Local/Cloud Notes, Roadmap. Every decision labelled. §9.2 implemented under D-060. |

## Current code facts

- Coworker records, config, memberships and activity log are **client-side**
  (`src/state/coworkers.ts`, key `thylas:coworkers:v1`); three seeds are prototype data.
- The real conversation surface is the shipped `ChatCore`; there is no agent runtime,
  no A2A, no tool execution, no Coworker table, no avatar asset.
- Server-side reuse candidates: shared contracts in `src/lib/*`, the session source,
  the per-user file store (D-059), the validated envelope + activity log.
- `src/lib/coworkers.ts` (11-14, D-060) is a **declared** Mind Framework contract:
  six dimensions, version 1, validators, read-only display on the config page. It is
  not executable; `DESIGN.md §10 Q-D` is still open.

## Open conflicts (do not resolve silently)

`DESIGN.md §10` lists five: A2A ownership vs D-054 #7; generated avatars vs `[P]`
mark-only MVP; commissioning journey vs one-screen config; "executable" methodology
vs WAM ownership; Coworker persistence. Each needs a dated human decision.

**Nothing in this directory is an implementation of a multi-agent runtime.**
