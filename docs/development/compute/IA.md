# Compute — information architecture

## 1. Routes

| Route | Screen | Purpose |
| --- | --- | --- |
| `/compute` | Overview | the pool at a glance: counts, what needs attention, machines, running work, what Thylas decided |
| `/compute/resources` | Resources | the unified pool; search, provider/type/availability filters, list ⇄ grid |
| `/compute/resources/new` | Add resource | three kinds of machine, one flow, provider-declared fields |
| `/compute/resources/:id` | Resource detail | identity, hardware, utilization, environment, workloads, connection |
| `/compute/providers` | Providers | the registry: category, integration honesty, capabilities, health, entry to the flow |
| `/compute/workloads` | Workloads | every run and the machine it was given, filterable by state |
| `/compute/workloads/:id` | Workload detail | target, consumption, siblings on the machine, local actions |
| `/compute/find` | Find compute | requirements → ranked recommendations with reasons → a recorded target |

Everything hangs off one section: `Compute` is a rail item under Recently, not a workspace room. A machine is where work runs; it does not belong to one workspace.

## 2. Screen anatomy

```
ComputeShell
├─ head .............. eyebrow, title, one-sentence stance, optional action
├─ ComputeTabs ....... Overview · Resources · Providers · Workloads · Find compute
└─ body .............. the screen
```

| Screen | Regions |
| --- | --- |
| Overview | stat strip (4) · attention band · two columns: pool (left) / active workloads + coordination (right) · foot note |
| Resources | toolbar (search · provider · view) · filter row (type · availability) · result line · table or grid |
| Detail | identity head · error/quiet band · left: Hardware, Utilization, Environment, Workloads · right: Connection, Note |
| Providers | registry note · grouped rows (Local, SSH, Cloud, GPU cloud) |
| Workloads | state tabs with counts · table · foot note on what stop means |
| Find | requirement form (sticky, progressive disclosure) · results list with score, reasons, caveats |
| Add | step indicator · kind cards → provider fields + scope + declared hardware → verify → done |

## 3. Relationship to the rest of the app

- **Rail** — one new item; no sub-items. Compute's five screens are tabs, not rail entries.
- **Workspaces** — untouched. A future link from a workspace to "where this run went" is a decision, not a default (see `MOCKED-AND-FUTURE.md` F4).
- **Notes / WAM** — no coupling. Workloads are a record, not an execution path.

## 4. Naming

| Concept | Word used | Not used |
| --- | --- | --- |
| A reachable machine | **resource** (UI) / machine (prose) | node, host, agent (except "local agent") |
| What Thylas can talk to | **provider** | integration, connector, cloud |
| Work assigned to a machine | **workload** / run | job, task, process (Processes already means WAM runs) |
| Two independent facts | **connection** vs **availability** | "status" alone |
