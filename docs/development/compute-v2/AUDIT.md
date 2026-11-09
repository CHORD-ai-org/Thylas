# Compute v2 — Repository audit

Written 2026-11-09, before implementation. The old Compute was built the same day; this
audit is about its product model, not its code quality.

## 1. What exists today

**IA.** Five screens: Overview · Resources · Providers · Workloads · Find compute
(`size="console"` shell, one shared CSS module, honest simulation sentence in the shell).

**Data.** `data/compute.ts`: `Provider` (connection form registry, `integration`
level), `Resource` (a machine: connection + availability kept separate, utilization only
when reachable), `Workload`, `Recommendation` (`rankResources` — a deterministic sort with
reasons). `state/compute.ts` v1 store: session-only changes (connections, added machines,
workload states, accepted recommendations), tombstone-less, validated on read.

**What works and is worth keeping:**
- connection ≠ availability, and no utilization for unreachable machines (D-048);
- data-driven field forms (`fields[]`) instead of a page per provider;
- deterministic simulation (`unreachable.host` fails, everything else connects);
- Find's ranking with arguable reasons, and "accepting" writes a **queued** run with a
  note that no executor exists;
- the console-width shell, `StatusPair`, `ProviderMark`, util bars, honest empty cells.

**What is wrong with the product model (why the redesign):**
1. **"Provider" conflates two nouns.** AWS-as-provider mixes *how work executes* (an
   execution interface) with *who sells machines* (a marketplace row). A Slurm cluster is
   an execution environment with no vendor; Modal is a vendor whose execution interface
   exposes no machines at all. The old model can say neither.
2. **"Resources" is infrastructure-first.** The screen leads with machines; the question
   the user actually has — *where should this work run?* — lives in a fifth tab
   ("Find compute") behind four infra screens. OpenResearch inverts this: compute is
   chosen per run; configuration is the supporting cast.
3. **No concept of a default or preferred environment.** Every visit re-derives the pool
   from scratch; nothing records "this is where my work normally goes".
4. **Backends without instance semantics cannot be represented.** Slurm schedules into
   partitions; Modal/HF Jobs provision on demand. The old model forces every execution
   surface to look like a machine list, so the honest entry is either fake or missing.
5. **No acquisition path.** "Providers" could only *connect accounts for listing*; there
   is no notion of obtaining capacity (managed GPU) and then using it through a backend.

## 2. OpenResearch, as a product-model reference (checked 2026-11-09)

openresearch.sh documents: execution backends local / SSH / Slurm / Kubernetes / Ray /
Modal / Tinker / Hugging Face Jobs / managed OpenResearch GPUs; "users choose their agent
per session and **their compute per run**"; the same source snapshot runs on any backend;
the web dashboard separates **Compute** (backends + prices) from **Instances** (running
machines); managed compute is a service-acquired capacity, billed separately, *used
through* the same backend abstraction. The transferable idea is exactly one sentence:
**organize compute around execution environments, and make environment selection part of
running work — not a directory of infrastructure.**

## 3. Missing infrastructure (honesty obligations carried over from D-048)

No SSH/K8s/Slurm clients, no provisioning or billing APIs, no executor, no telemetry.
So: backend "Test connection" is deterministic simulation; utilization exists only for
connected seed machines; Run confirms a target and records a queued workload, never
starts one; Marketplace prices are labelled representative; acquisition explains what
*would* happen.

## 4. Disposition

| Old | New |
| --- | --- |
| `Provider` registry | split: **Backend** catalog (execution) + **Listing** catalog (Marketplace) |
| `Resource` | **Instance** (owned by a backend; some backends expose none) |
| Resources screen | Instances screen (operations), deprioritized below Run |
| Providers screen | Backends screen (configuration) + Marketplace (acquisition) |
| Find compute | **Run** — Compute Selection, promoted to the central interaction |
| Workloads | Activity (same data, execution-history framing) |

Store key bumps to `thylas:compute:v2` (new shape; the v1 reader rejected unknown
versions anyway). Routes keep the `/compute` prefix. Old compute docs stay as history.
