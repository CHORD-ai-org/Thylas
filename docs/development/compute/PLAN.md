> **Superseded 2026-11-09** by Compute v2 (D-050): the IA described here is replaced. See `docs/development/compute-v2/`. Kept as history.

# Compute — product and UI plan

**Status:** executed 2026-11-09 (this document describes what was built, in the order it was built).

## 1. Position

Thylas already treats a workspace as a place where work sits. Compute answers the other half: **where that work runs**. One pool spans this machine, SSH servers and provider accounts; Thylas reads what each machine can take, and the person chooses.

Two halves, named once and used everywhere:

| Half | What the interface does | What it refuses |
| --- | --- | --- |
| Manual selection | filters, detail, add-resource flow, provider registry | start, launch, provision |
| Assisted selection | Find compute ranks candidates and explains why | decide, reserve automatically, claim a schedule |

## 2. Screen plan

| # | Screen | The one thing it must communicate | Subtasks |
| --- | --- | --- | --- |
| 1 | Overview | *what do I have, and what needs me* | stat strip, attention band, pool preview, active runs, coordination log |
| 2 | Resources | *one pool, filterable* | search, provider select, type/availability chips, list ⇄ grid, empty states |
| 3 | Detail | *what this machine is and whether I can see it* | identity head, hardware, utilization or its absence, environment, workloads, connection actions |
| 4 | Add resource | *three kinds of machine, one flow* | kind cards → provider fields → scope + declared hardware → verify → done |
| 5 | Providers | *what Thylas can talk to, and how honestly* | grouped registry, integration badge, capabilities, derived health, entry to 4 |
| 6 | Workloads | *what is running where* | state tabs, table, local stop/cancel, foot note |
| 7 | Find compute | *what fits, and why* | requirement form with disclosure, ranked results with reasons/caveats, accept |

Priority given to 1 and 4, as asked.

## 3. Component hierarchy

```
ComputeShell (head + tabs + console width)
├─ parts.tsx      StatusPair · AvailabilityChip · ProviderMark · ProviderName
│                 UtilBar · Utilization · UtilizationInline · Section · ComputeTabs
├─ Overview       Stats · Attention · PoolPreview · ActiveWorkloads · Coordination
├─ Resources      Toolbar · FilterChips · ResourceTable | ResourceCard
├─ Detail         IdentityHead · Band · Section(Hardware|Utilization|Environment|Workloads) · Connection
├─ Providers      RegistryNote · ProviderGroup · ProviderRow
├─ Workloads      StateTabs · WorkloadTable
├─ Find           RequirementForm · ResultList · RecCard
└─ Add            Steps · KindCards · ProviderFields · DoneCard
```

## 4. Data model (`src/data/compute.ts`)

| Type | Fields that matter | Why |
| --- | --- | --- |
| `Provider` | `category`, `integration` (`built-in` / `prototype` / `planned`), `capabilities[]`, `fields[]` | a provider declares its own connection form; adding one is data, not a page |
| `Resource` | `providerId`, `kind`, `scope`, `hardware`, `connection`, `availability`, `utilization?`, `declared?` | connection and availability are separate; utilization is optional and absent when unreachable |
| `Workload` | `resourceId`, `state` (5), `progress?`, `cpuPct`/`gpuPct`/`memoryGb`, `note?` | a run is a record; its target is a machine |
| `Recommendation` | `score`, `reasons[]`, `caveats[]` | the ranking must be arguable, not a verdict |
| `Decision` | `kind`, `text`, `at` | the coordination log: what Thylas recorded, written in the past tense |

Derived, never stored twice: `availabilityOf`, `metricsOf`, `statusLine`, `providerHealth`, `activeCount`, `hardwareSummary`/`hardwareBrief`.

## 5. State (`src/state/compute.ts`)

`thylas:compute:v1` holds only what a session changed: `added` machines, `connections`, `workloadStates`, `addedWorkloads`, `decisions`. Seeds stay seeds. Every page calls `useCompute()` once so a change in one screen is visible in another without a reload.

## 6. Interaction flows

| Flow | Steps | Failure/recovery |
| --- | --- | --- |
| Add machine | kind → fields (provider-declared) → scope + declared hardware → verify (1.1s) → done or error | a host named `unreachable.host` fails deterministically; the error names what happened and nothing is added; edit and retry |
| Connect / disconnect | detail header or side action; 1.1s simulated attempt | failure is a band, not a toast; "Simulate a failed read" exists so the state can be seen |
| Filter | URL-backed; unknown values fall back to `all` | no-match empty state names the filters and offers one press to clear |
| Find | requirements → rank → choose | no-match explains the binding constraint and offers to drop it; accepting names the target's own status if it is not available |
| Stop / cancel | one press; local only | the foot note says the machine is not signalled |

## 7. Responsive

| Width | Behaviour |
| --- | --- |
| ≥1180 | full table, two-column detail and find |
| 1024 | provider and utilization columns drop; identity, hardware, status, count stay; detail/find stack |
| 390 | **not supported**: the app shell has no mobile rail. Verified overflow-free but visually clipped; recorded as a shell-level gap (AUDIT G1), not fixed here |

## 8. Decisions taken without asking (flag if wrong)

| # | Decision | Alternative |
| --- | --- | --- |
| P1 | Compute is a global rail item, not a workspace tab | per-workspace compute scope |
| P2 | Hardware for a newly added machine is **declared** and labelled as such | add machines with empty hardware ("not measured") |
| P3 | Cost is absent everywhere, with one sentence per screen saying no provider reports a rate | show a placeholder price |
| P4 | Workload stop/cancel is local and labelled "(local)" | hide the control until WAM exists |
| P5 | `Thinking Machines` is an entry in the registry with no capabilities claimed beyond listing | omit it until its API is known |
| P6 | Acceptance of a recommendation creates a **queued** run, never a running one | create nothing, only log the decision |
