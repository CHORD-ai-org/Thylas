# 04 — View Model Exploration

How can the same information and representation be presented differently? Governing rule
(GSC 04 + this set): **a View is a projection, not a data model.** It needs no storage of
its own except saved parameters. "A Graph View ≠ a graph database; a Spatial Workspace ≠
an infinite canvas."

## 1. View vs Representation (the distinction that must survive)

| | Work Representation (03) | View (this doc) |
|---|---|---|
| What it is | organization of units + relations + arrangement | projection: density, modality, ordering, filters |
| Persists? | ladder: scratch / kept / canonical | no (except parameters) |
| Author | user + agent proposals | system + user configuration |
| Example | a curated board for "the Q3 review" | the same board as list / graph / timeline |

C's projection insight [paper]: "the same underlying process may be projected as a
conversational exchange, a workflow diagram, a timeline, or a spatial workspace."

## 2. Candidate view catalogue (exploration, not a mandate)

| View | User intent | Density | Objects | Operations | Editable? | Operates on | Saveable? |
|---|---|---|---|---|---|---|---|
| Overview | orient | low | all (counts, recents) | open, search | no | persistent info | no |
| Object list | scan, filter, bulk-act | high rows | one type or mixed | sort, filter, batch ops | batch only | persistent info | params (filter/sort) |
| Reader / Source | understand one thing deeply | focused | one + its provenance/evidence | read, cite, propose edit | via editor | persistent info | no |
| Relations / Graph | see structure | medium | objects + relations | navigate, propose relation | proposals only | info + representation | params |
| Timeline | understand evolution | medium | events/versions | navigate history, restore | no | derived from events | no |
| Activity / Engagement | mutual awareness (A) | medium | traces (who/what/when/why) | inspect, steer, annotate | annotate | derived from events | no |
| Spatial Workspace | think with materials (E) | free | units + placement + ink | arrange, connect, delegate by selection | yes | **representation** | as representation |
| Process / Workflow | track ongoing work (C) | medium | goals/tasks/ops | step, intervene, reflect | yes | process structure (05) | as process |
| Comparison | decide between alternatives | high | 2–N objects/candidates | diff, merge, pick | via accept/reject | persistent + candidates | params |

Thylas already ships prototypes of: Overview (`/overview`), Object list (files/notes/
artifacts), Reader (note editor, artifact detail), Spatial (boards), Activity (run views,
"Needs you"), Comparison (Notes conflict "Show both", extract candidate review). GSC ships
Overview/list/grid/reader/Canvas-tree/Recently/Activity. Lemma ships concept map / path /
quiz / progress views.

## 3. Per-view investigations worth a founder discussion

1. **Graph view.** [ours] Cheap and high-value as a *projection over `ArtifactRelation` +
   board edges*; dangerous only if mistaken for storage. Recommendation candidate: graph
   as view; relations remain the data.
2. **Timeline / Activity.** Requires the engagement-event substrate (01 §2 A×D). Without
   it, these views would fake history — violates the interaction contract (no fake
   controls / no invented data).
3. **Spatial Workspace** is the Q-C question (08): view vs environment vs hybrid. E
   evidence ("shaping the space IS the work") argues it is more than a view; the honest
   middle (C3 hybrid: view + transient marks layer) fits Thylas boards as shipped.
4. **Comparison** is where CLEO conflicts surface; it must show attribution classes (who
   changed what, as feedback or independent work) — see 06 §3.

## 4. Customization and saving

- Saveable things: **representation** (03), **view parameters** (filter, density, mode),
  and **comparisons** (a pinned diff). Not the rendering itself.
- Agent-generated views (e.g. "summarize this cluster as a timeline"): treated as
  proposals of a *representation*, not of a new view type (avoids view-type sprawl).

## 5. Cognitive load (the design constraint from the brief)

Adaptive density, progressive disclosure, evidence-on-demand, decision-focused surfaces —
specified in `docs/home-interaction/05-intelligent-ui.md` §5 and preserved here unchanged.
New requirement from the research set: **views must show attribution and provenance on
demand, never by default** (A: localized visualizations; the trace is one drill-down away).
