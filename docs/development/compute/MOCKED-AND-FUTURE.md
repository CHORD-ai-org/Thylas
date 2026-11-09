# Compute — what is mocked, and what a real backend would need

## 1. Mocked capabilities

| # | Behaviour | How it is simulated | Labelled in the UI |
| --- | --- | --- | --- |
| M1 | Reading a machine's hardware | seed data; for added machines, a declared profile from the form | detail says `declared in the connect flow`; the done card says it too |
| M2 | Connection attempts | 1.1s timer → `connected` or `error`; failure is deterministic (host named `unreachable.host` / `fail`, or a cloud account without a key) | the band states what happened; the side sentence says the provider is a prototype flow |
| M3 | Utilization | fixed samples per machine, present only while `connected` | absence is explained ("no sampler" / "not measurable while unreachable") |
| M4 | Provider health | derived from the machines behind the provider | `Connected` / `Connection error` / `No machines yet` / `Not implemented` |
| M5 | Workload execution | none. States change only when a person presses stop/cancel | every foot note says nothing is signalled |
| M6 | Recommendation | a sort over the pool with reasons and caveats | "Ranked, not scheduled"; cost absent with the reason |
| M7 | Accepting a recommendation | writes a **queued** workload with a note that it has no executor | the assigned band says "no executor" |
| M8 | Credentials | a `secret` field that is never stored; the value is only checked for emptiness | field hint says it is never stored here |
| M9 | Cloud account connection | the AWS and Thinking Machines entries are prototype flows: the form is real, the account is not contacted | badge `PROTOTYPE FLOW` |

## 2. What a real integration would need

| Layer | Requirement | Notes |
| --- | --- | --- |
| Local agent | a small process that reports hardware, sampler values and liveness | the add flow already names it; nothing is installed today |
| SSH | key handling in the OS keychain, host-key verification, a non-interactive probe (`nvidia-smi`, `/proc/meminfo`, `df`) | the model needs `lastSeen` to become a timestamp, not a phrase |
| Cloud (per provider) | read-only credential, `listInstances` → map to `Resource`, rate/limit metadata | EC2 objects ≠ a GPU cloud's objects; that is why `Provider.fields` is data |
| Metrics | a polling contract with a staleness field | utilization must be able to be *stale*, which the current model cannot express |
| Execution | WAM endpoint to start/stop a run and report state | the UI is ready to display `queued → running`, and will keep refusing to fake it |
| Pricing | a rate per instance type and region | until then the cost column stays absent |

## 3. Open product decisions (need a person)

| # | Question | Default in this build |
| --- | --- | --- |
| F1 | Should a workspace own compute, or is the pool always global? | global (P1) |
| F2 | May a recommendation reserve a machine for a window? | no; it records a target |
| F3 | What happens when a machine goes offline mid-run? | nothing in the UI says; the run keeps its state |
| F4 | Should a WAM run link to its compute workload and back? | no link yet |
| F5 | Is declared hardware acceptable as a record, or must a machine be unmeasured until probed? | declared, labelled |
| F6 | Multi-tenant scoping: is `org` visibility a label or an ACL? | label only (the Account surface says permissions are out of scope) |
| F7 | Should cost be shown when only some providers report it? | no cost anywhere, for consistency |
