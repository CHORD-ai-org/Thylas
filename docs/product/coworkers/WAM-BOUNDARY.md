# Coworker and WAM — the boundary

## 1. The one-line split **[C]**

> **Thylas owns the Coworker as a product entity — WAM owns the agent that makes it
> work.** Users manage Coworkers; WAM runs them; neither duplicates the other.

## 2. Responsibility table **[C]**

| Responsibility | Thylas | WAM | Why |
| --- | --- | --- | --- |
| Coworker creation, identity, config | ✅ | — | A product entity users manage. |
| Workspace membership + access grants | ✅ | — | Access is application policy, not runtime mechanics. |
| Resource / Artifact / Toolset grants | ✅ (record + enforce at product level) | Executes within them | Thylas declares; WAM honours at runtime. |
| Conversations and working interface | ✅ | — | Interaction is Thylas's surface. |
| Current Work visualization | ✅ (renders what WAM reports) | ✅ (feeds state) | `product/definition.md` items 9–13: subscribe, cache, discard freely. |
| Agent runtime | — | ✅ | Instantiation, execution, tools. |
| Context management (semantic) | — | ✅ | Shared context is WAM's; Thylas's context UI only *declares* sources. |
| Planning and reasoning | — | ✅ | Thylas never decides; it reports (`product/definition.md` rule). |
| Tool execution | — | ✅ (through its toolsets) | Thylas records grants and results, not execution. |
| Scheduling, retry, queueing, model choice | — | ✅ | Item 12 **[C]**: Thylas does nothing here. |
| Pause / stop / resume / approve | Render controls only if WAM exposes them | Owns the operations | Item 13 **[C]**. |
| Coworker-to-Coworker A2A protocol | Stores handles; renders transcripts if delivered | Owns the protocol | See §3. |

## 3. The A2A boundary **[C] with [P] mechanics**

- **[C]** Each Coworker **independently connects to WAM** — there is no Thylas-side
  agent bus.
- **[C]** Coworker-to-Coworker communication runs over a **separate A2A protocol owned
  by WAM**. Thylas stores the connection handles and renders transcripts or events *if
  WAM delivers them* — it does not route, interpret, or broker A2A traffic
  (`../development/backend/INTEGRATION.md` §4).
- **[C]** **Multiple Coworkers in one Workspace are colleagues sharing a room, not a
  multi-agent system.** There is no global Coworker orchestration in the product model:
  no supervisor Coworker, no Thylas-side swarm planner. Coordination, where it emerges,
  is WAM's runtime behaviour that Thylas may visualize — never a Thylas feature.
- **[P]** If a transport relay is ever needed (to survive outages), it is
  transport-only, semantic-free, and requires its own dated decision.

## 4. The mapping question — Coworker entity vs WAM agent **[Q]**

Open and deliberate: at runtime, does one Coworker correspond to **one persistent WAM
agent**, or is a Coworker a **product identity that WAM instantiates per session**
(brief assembled from Thylas's config)? The product model works either way — Thylas
owns the entity and the brief; WAM owns the instantiation. The decision lands when the
WAM contract exists; nothing in the Coworker UI depends on it.

What is already fixed regardless of the answer **[C]**:

- The brief Thylas sends is assembled from user config (responsibilities, access,
  pinned context) — never from hidden prompt state.
- Access grants travel with every working request; WAM honours them as bounds, and
  Thylas's product-level enforcement stays the visible line.
- Provenance flows back: "this result was produced by Coworker X" is a Thylas record
  built from WAM's run attribution.

## 5. What breaks if the line moves **[C]**

- If Thylas started planning/orchestrating (a "Coworker scheduler"), it would duplicate
  WAM and split the user's mental model of *who decided what* — the exact failure
  `product/definition.md` forbids ("if a Thylas screen has to decide something about
  the user's work, the screen is wrong").
- If WAM owned Coworker identity/config, access and membership would become runtime
  state — unauditable by the user and unenforceable at the product level.
- If Coworkers auto-inherited user connections and full workspace access, the declared-
  context honesty rule (Chat context bar, artifact context) would be dead on arrival.

## 6. Sequencing with WAM reality **[P]**

1. **Now:** Coworker records, config, memberships — all Thylas-side, no runtime
   required; the working experience renders conversations (existing chat) honestly.
2. **First WAM contact:** per-Coworker connection handle; Current Work fed by WAM
   state; execution controls rendered only where WAM exposes them.
3. **Later:** A2A transcripts, multi-Coworker runtime visualization — visualization
   only, per §3.
