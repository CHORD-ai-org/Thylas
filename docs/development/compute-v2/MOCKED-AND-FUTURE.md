# Mocked and future — Compute v2

What is simulated, what is real, and what a backend would have to provide.
The interface states each of these in place; this is the same list in one table.

## Simulated in this build

| # | Fact | Where | What is actually true |
| --- | --- | --- | --- |
| M1 | Backend connection tests | Backends detail, Add flow | Deterministic: a config value containing "unreachable" produces `unreachable`, everything else `ready`. No SSH/K8s/Slurm/Ray client exists. |
| M2 | Instance connect / disconnect | Instances | Local state only; no agent, no SSH session, no sampler. |
| M3 | Utilization numbers | Instance detail, Instances table | Seed data, shown only while connected — the rule from D-048, kept. |
| M4 | Marketplace rates and availability | Marketplace | Representative samples, labelled on the banner and every row. No provider contact, no billing. |
| M5 | Acquire | Listing detail | Explains what would happen; provisions nothing. |
| M6 | Running workloads' progress | Overview, Activity | Seed data; the executor does not exist. |
| M7 | Stop / cancel / re-queue | Workload detail | Local state changes, labelled in place. |

## Real in this build

| # | Fact | Where |
| --- | --- | --- |
| R1 | Backend configuration, enable/disable, default | Backends; persisted in `thylas:compute:v2` |
| R2 | Run selection: deterministic ranking + reasons | Run; pure `rankTargets` |
| R3 | Confirming a target | Run → queued workload in Activity, "recorded, not started" |
| R4 | Marketplace filtering | Marketplace; pure `filterListings` |
| R5 | Terminate an acquired instance | Instance detail; session-local |

## What a backend must provide

1. **Execution clients** (SSH / Slurm REST / kube API / Ray / Modal SDK) — `testBackend`
   becomes a real probe; `confirmTarget` hands the target to an executor.
2. **Provisioning + billing APIs** — Acquire creates a machine and returns a host to
   attach; rates go live; the four-tier honesty (D-050 rule 3) does not change.
3. **Telemetry** — utilization becomes measured; the "no sampler" sentences disappear.
4. **Queue depth / scheduler feedback** — for `instances: 'none'` backends, "waiting for
   the scheduler" becomes a real position instead of a fixed phrase.
