# Compute v2 — Product & UI specification

Status: accepted in force (D-050). Companion to `AUDIT.md`.

## 1. Product definition

Compute is Thylas's unified computational environment manager. It answers one question:

> **Where should my computational work run, and how do I use that environment?**

The journey it organizes: understand available compute → configure an execution
environment → select a target for work → run → inspect. Everything else (machine
operations, acquisition) serves that journey. It is not a cloud console.

## 2. Conceptual model — four nouns, three rules

| Noun | Answers | Examples |
| --- | --- | --- |
| **Backend** | Through what execution mechanism can work run? | Local, SSH, Slurm, Kubernetes, Ray, Modal, HF Jobs |
| **Instance** | Which actual machine am I using? | studio-win, lab-01, a managed H100 |
| **Workload** | What work is running or queued? | tokenizer-eval, ablation-7, a dev shell |
| **Listing** (Marketplace) | Where can I obtain more capacity? | an on-demand H100 in us-east, a 4090 box |

Rules the UI must make visible:
1. **A backend is not an instance.** Connecting a backend creates no machine. Backends
   split by `instances`: `exposed` (Local, SSH — machines you can point at) and `none`
   (Slurm, Kubernetes, Ray, Modal, HF Jobs — work targets the environment; the cluster
   or platform provisions). `none`-backends never appear in Instances.
2. **Connection is not availability.** Carried over from D-048 verbatim.
3. **Acquisition is not execution.** A Marketplace listing becomes capacity only after
   it is attached to a backend that can use it; the listing says which backend type
   that would be.

## 3. Information architecture

Six tabs in the Compute shell (`console` width, as before):

| Tab | Route | Purpose |
| --- | --- | --- |
| Overview | `/compute` | What can I use right now; what needs attention |
| Backends | `/compute/backends` (+`/new`, `/:backendId`) | Configure execution environments |
| **Run** | `/compute/run` | Compute Selection — choose where work runs |
| Instances | `/compute/instances` (+`/:instanceId`) | Machine operations |
| Activity | `/compute/activity` (+`/:workloadId`) | Execution history |
| Marketplace | `/compute/marketplace` (+`/:listingId`) | Acquire capacity |

### Overview
Action-first, not a wall of stats. A four-slot strip (backends ready · instances
connected · usable now · running workloads), an attention band only when something
needs it, then two columns: **Execution environments** (each backend: type mark, status,
default star, Configure →) and **Running now / Usable immediately** (workloads and idle
instances), plus a Marketplace line ("need more compute →"). Primary action: **Run
something**.

### Backends
One row per configured backend: type mark, name, status word, capabilities, default
star, actions (Configure · Set default · Disable). Below, an **Add a backend** section =
the type catalog: built-in (Local), ready-to-configure (SSH, Slurm, Kubernetes, Ray),
planned (Modal, HF Jobs, Tinker — "No flow to open"). Backend detail: data-driven config
form (fields per type — SSH: host/port/user/auth; Slurm: login host/partition; K8s:
context/namespace; Ray: head address), **Test connection** (deterministic: a host
containing `unreachable` fails, everything else reaches `ready`), capabilities with one
line each, its instances (if `exposed`), Disable (reversible), Remove (confirm; seed
backends are tombstoned).

### Run — Compute Selection
The central interaction, reached from Overview, from a workspace process, or directly.
Three steps in one screen (no wizard chrome):
1. **What are you running** — name + kind (Training / Evaluation / Data job / Dev
   environment / Build).
2. **Requirements** — GPU required/none/any, min GPU memory, GPU class, min cores, min
   memory, scope (any/personal/org), preferred backend (any, or pick).
3. **Targets** — ranked recommendations, each a card: target name, backend, score bar,
   reasons, caveats, **Choose this**. A "Show all targets" disclosure lists everything
   eligible for manual pick — Hybrid Coordination: manual and recommended are two doors
   to the same list, and confirming always records a **queued** workload with the note
   that nothing starts in this build.

Ranking is a pure, deterministic function (`rankTargets`): hard filters → fit (idle,
headroom) → locality (personal before shared) → cost-of-waste → backend honesty
(a `none`-instance backend can always take work but start time is unknown; an
unverified backend is excluded with a reason, not silently dropped).

### Instances
Console table: name, backend, hardware brief, connection · availability, workloads,
last seen. Filters: backend, availability, scope, search. Detail: hardware and runtime,
utilization (only while connected — otherwise the honest sentence), its workloads,
actions: Connect / Disconnect (simulated, deterministic), Terminate (only for
marketplace-acquired machines; confirm; tombstone).

### Activity
Same workload states as before (running / queued / completed / failed / cancelled) with
URL filters. Detail: intent/kind, **execution target** (backend, and instance when one
exists — a `none`-backend run says "targets the cluster, no single machine"), events
timeline, resource allocation, honest controls (stop/cancel are local; rerun re-queues).

### Marketplace
A banner: pricing and availability are **representative samples**, not live data. Filter
row: provider, GPU class, min GPU memory, region, max rate, usable-via backend type.
Rows: provider mark, configuration name, hardware brief, region, rate, "usable via" chips.
Detail: full spec, what the rate does and does not include, **how you would use it**
(attaches to an SSH or Kubernetes backend; acquired machines appear in Instances with
their representative rate), **Acquire** → honest notice that no billing or provisioning
exists in this build.

## 4. Data model

```ts
Backend   { id, name, type: 'local'|'ssh'|'slurm'|'kubernetes'|'ray'|'modal'|'hf-jobs'|'tinker',
            blurb, status: 'ready'|'unverified'|'unreachable'|'error', enabled,
            isDefault?, instances: 'exposed'|'none', capabilities: ExecCapability[],
            fields: Field[], config: Record<string,string>, configured?: boolean }
Instance  { id, name, backendId, scope, owner, hardware, os, runtime[],
            connection, availability, utilization?, workloads, lastSeen,
            declared?, ratePerHour?, acquiredVia? }
Workload  { id, name, kind, backendId, instanceId?, state, startedAt, duration,
            progress?, cpuPct, memoryGb, gpuPct?, intent?, events?, note? }
Listing   { id, provider, name, gpu, gpuCount, gpuMemoryGb, gpuClass, cpu, cores,
            memoryGb, storageGb, region, ratePerHour, availability: 'representative'|'waitlist',
            useVia: BackendType[], blurb }
Target    { kind: 'instance'|'backend', id, name, backendId, backendName, scope, owner }
Requirements { name, kind, gpu: 'required'|'none'|'any', minGpuMemoryGb?, gpuClass?,
            minCores?, minMemoryGb?, scope, backendId? }
Recommendation { target, score, reasons[], caveats[] }
```

Store `state/compute.ts`, key **`thylas:compute:v2`**, same conventions as v1: session
changes only, validated on read, seeds untouched, deterministic simulations, decision
log. Session facts: backend config/status/enabled/default, removed seed backends,
added instances (marketplace), instance connections, workload states, confirmed
selections, log.

## 5. Why this is better than the old design

1. The first tab answers "what can I use" and the second answers "how do I set it up" —
   instead of five infra screens before the one interaction that matters.
2. Slurm/Modal-class environments become first-class instead of fake machines.
3. Selection gains memory (default backend, preferences) instead of re-deriving a pool
   every visit.
4. Acquisition exists as a concept, and is kept honestly separate from execution.
5. Every old honesty rule survives the rename — two facts per machine, no fake
   connections, queued-not-started, deterministic failure, empty cells explained.

## 6. Mock strategy & known limitations

Seeds: 4 configured backends (Local ready+default, SSH ready with 4 machines, Slurm
ready `instances:none`, Kubernetes unverified) + 3 catalog-only (Ray ready-to-configure,
Modal/HF Jobs planned). 7 instances (as before, plus one marketplace-acquired with a
representative rate). 7 workloads. 6 listings across 4 providers with representative
rates. `Test connection` and acquisitions are deterministic simulations; nothing starts,
bills, or provisions. No real-time anything.
