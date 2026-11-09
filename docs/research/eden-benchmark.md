# Eden — an experience benchmark, not a visual reference

**Status:** research. 2026-11-09.
**Question:** what makes Eden's product feel mature, and which of those qualities can Thylas adopt without becoming Eden?
**Authority:** this document informs `QUALITY-BAR.md`. It does not overrule `branding-desk.md`, `typography.md` or the palette.

---

## 0. Method, and what it cannot claim

| Source | Access | What it supports |
| --- | --- | --- |
| `eden.so` marketing site, rendered at 1440 (four viewport captures) | Public | Product renders embedded in the page, navigation labels, feature copy |
| Product surfaces shown in those renders: AI chat, saved-item cards, library views, scheduling, store front | Public, static images | Layout composition, card anatomy, state vocabulary |
| `app.eden.so` | **Not entered** — authentication required | Nothing. No claim below comes from the running app |
| Hover, drag, transition timing, empty states | **Not observable** in static renders | Nothing. Motion and micro-interaction claims are absent on purpose |

Four things I did **not** verify and will not assert: sidebar structure inside the app, hover/selection behaviour, animation durations and easing, mobile behaviour.

**Consequence:** everything below is about *composition and information design*, which is exactly the layer Thylas is weakest at today. Nothing here is evidence about interaction feel.

---

## 1. What Eden is `[DOC]`

A creator operating system: research what performs on seven platforms, save it, read and highlight it, write with AI that has read your library, schedule and publish, sell from a page. Sold as "one subscription instead of eleven".

That framing matters for translation: Eden's surfaces exist to move a user from *found material* to *published artifact*. Thylas's surfaces exist to move a user from *material* to *delegated work and its result*. The composition problem is the same; the object model is not.

---

## 2. Observed surfaces

| # | Observation (what is on screen) | Evidence | Principle it demonstrates |
| --- | --- | --- | --- |
| O1 | AI answer occupies the left two-thirds; a **sources column** sits beside it, slightly overlapping, showing the saved posts used | `[OBS]` chat render | The answer and its evidence are one composition, not a chat log followed by citations |
| O2 | Above the answer: a **context chip** naming the corpus (`Top Productivity Posts · X, Insta…`) with `+` and a filter control | `[OBS]` | Scope is a visible, editable object before the answer exists |
| O3 | Inside the answer: a collapsed activity line — *"swept 5 searches · scanned 65 posts · Everything it found"* | `[OBS]` | Work done is summarised in one line and expandable; the trace is not the interface |
| O4 | Saved-item card anatomy: media block, title, author + handle, engagement row (`2.5K ♡ 299 💬 1.1M ◉ 15x`), bookmark action | `[OBS]` | One card anatomy, reused in library, sources and board insertion |
| O5 | A `Grid view / Freeform canvas` switch on the library | `[OBS]` | The same objects get two spatial readings: list-like and canvas-like |
| O6 | Answer body uses numbered section headings and a bordered quote block with attribution (`Flow` / `Mihaly Csikszentmihalyi`) | `[OBS]` | Quoted material keeps its source visible at the point of use |
| O7 | Composer at the bottom of the answer column: tools at left, model selector (`Eve Pro`) and submit at right | `[OBS]` | Input is attached to the region it writes into |
| O8 | Segmented top tabs `Chat | MCP` inside the app chrome | `[OBS]` | Mode switching is one click, not a settings change |
| O9 | Store page: revenue readout `$3,150` / `21 sales` with a transaction list and timestamps | `[OBS]` | Numbers are literal, unit-bearing, attributed to time |
| O10 | Marketing copy enumerates the jobs ("Create content calendars and trackers", "Schedule and publish to every platform", "Read and highlight anything inside Eden", "Insert to board", "Chat with this post") | `[DOC]` | A surface is named by the job, and every saved object carries a next action |
| O11 | Pricing table compares 11 tools with per-item prices and a summed "cheapest version of that stack — $254/mo" | `[DOC]` | Cost is stated as arithmetic, not as a feeling |
| O12 | Testimonial wall (long, first-person, outcome numbers) | `[DOC]` | — **not transferable**; see §5 |

---

## 3. The six traits that actually produce "mature"

Ordered by how much of Thylas's current deficit each one explains.

**T1 · Every object carries its next action.**
`[OBS]` A saved post is not a thumbnail; it is a card with author, performance, and *"Chat with this post / Insert to board"*. `[INF]` A user never has to wonder what the app expects them to do with the thing they are looking at.
For Thylas: a file row, a note, a card and a run must each expose the one action that moves work forward, at the row, not in a menu.

**T2 · Three regions are composed at once, not navigated between.**
`[OBS]` Answer + sources + composer share one screen with independent duties. `[INF]` The product feels like a workbench because two kinds of information stay visible while the third is used.
For Thylas: the read surface, the context panel and the rail are already three regions — but the panel is closed by default, so 1440 screens read as one narrow column in a wide field (§4 of `QUALITY-BAR.md`, finding A1/A2/A6).

**T3 · Scope is an object, not a hidden setting.**
`[OBS]` O2. `[INF]` Because the corpus chip is visible and editable, the user can predict the answer before reading it.
For Thylas: the AI panel should carry the same chip — workspace, selection, or attached objects — and the run view should carry its inputs.

**T4 · Work trace is compressed to one line.**
`[OBS]` O3. `[INF]` Long-running work becomes legible without becoming a log viewer.
For Thylas: this is the missing middle of the Processes surface. The run list shows state; the run detail should open with *"read 12 files · 3 searches · produced 2 artifacts"* and expand on demand.

**T5 · One card anatomy, everywhere.**
`[OBS]` O4, O5. `[INF]` Consistency is not a style rule; it is reuse of a single component across three contexts.
For Thylas: the board card and the file row currently speak different languages (media/thumbnail vs. table). Acceptable — but the *provenance* line must be identical in both: `produced by run #12`.

**T6 · Numbers and states are literal.**
`[OBS]` O9, O11. `[INF]` Precision is what makes a product feel engineered rather than marketed.
For Thylas: already the brand law (P6, five state words). The gap is enforcement in tables (finding A5).

---

## 4. Translation table

| Trait | Where it lands in Thylas | Concrete change | Fit |
| --- | --- | --- | --- |
| T1 next action per object | Files rows, note rows, board cards, run rows | one primary action visible on hover/focus, keyboard-reachable, never a `…` menu that hides everything | **Adopt** |
| T2 composed regions | Shell at ≥1280 | panel opens by default on Files/Notes/Boards with a meaningful object selected; a "no selection" state that explains the panel | **Adopt** |
| T3 scope as object | AI panel, run detail | context chip listing what the answer will read; editable before send | **Adopt** |
| T4 compressed trace | Run detail | header line with counts + expandable events; replaces raw event list as the default | **Adopt** |
| T5 single card anatomy | Board card ↔ file row ↔ note row | shared `provenance` component: `produced by run #12 · 2h ago` | **Adopt** |
| T6 literal numbers | All tables | tabular figures, right-aligned numeric columns, units always stated | **Adopt** |
| O5 grid/canvas duality | Boards | already present as list ↔ canvas; keep list view as the default for >20 boards | **Partial** |
| O1 answer + sources overlap | AI panel | panel is 340px; do not overlap — show sources as a collapsed "read 3 notes" strip | **Adapt** |
| O8 segmented mode tabs | App chrome | rejected: Thylas has one mode per area; adding Chat/MCP tabs would fork the IA | **Reject** |

---

## 5. What not to take

| Not this | Why it fails in Thylas |
| --- | --- |
| Dark cinematic surface, glow, serif-italic display | Direct violation of the palette and of "paper, not background" |
| Creator commerce, revenue dashboards | Thylas is not a business tool; a revenue readout would be a fake claim |
| Testimonial wall, outcome numbers | CHORD publishes no customer results; the site's own rule forbids it |
| Comparison pricing tables | Pre-launch; there is no price to compare |
| Gamified research metrics (`15x`, `Top 7%`) | Metrics Thylas cannot compute honestly today |
| Overlapping floating panels with heavy shadow | Shadow is not a separator here; hairlines are |
| AI as a destination ("Chat" page) | Thylas's AI is a panel inside the workspace, by decision |

---

## 6. What Eden cannot answer

1. **Delegated work.** Eden has no queued/running/needs-you object. Its state vocabulary is publish-status, not execution-status. Thylas's hardest interface problem is untouched by the reference.
2. **Authoring in place.** Eden's editor is a writing box; Obsidian and Heptabase are the references for Thylas's editing and spatial work.
3. **Density under obligation.** Eden's rows are browsable; Thylas's tables are operational. Density targets come from the product's own audits, not from Eden.
4. **Long-session endurance.** Not observable from static renders. Must be tested in Thylas itself (`QUALITY-BAR.md` §6, five-minute test).

---

## 7. Consequences

1. The deficit is **composition and completeness**, not style. No new colours, no new type.
2. Three surfaces fail the composition test today: Overview, Boards list, Processes list (all end in void at 1440). See `QUALITY-BAR.md` §4.
3. Two mechanics are missing outright: **context chip** (T3) and **compressed trace** (T4). Both belong to SP-07's surface, which is marked complete — so they are amendments, not new scope.
4. Every claim above is about layout. Interaction feel is specified separately in `docs/design/interaction-lifecycles.md` and verified by the five tests in `QUALITY-BAR.md` §6.
