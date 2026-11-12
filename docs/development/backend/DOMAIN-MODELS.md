# Domain models — implemented vs proposed

Legend: **[I]** implemented today · **[P]** proposed for WAM Joshō, designed here, not
built · each entry states where it lives now and what a server-side home would own.

## User  **[I]** *(partial)*

- Client: `state/user.ts` — display name override, preferences (density, landing page,
  default workspace), persisted `thylas:user:v1`; identity itself comes from the CHORD
  identity provider (named "not connected" in UI).
- Server-side future: authentication session, account record. **[P]** — only after an
  identity service exists; do not invent auth.

## Workspace  **[I]** *(partial)*

- Client: `state/workspaces.ts` (create/delete, seeds) + `data/mock.ts` seeds; file /
  board / process children are read-only seed data.
- Server-side future: durable workspaces and resources. **[P]** — the WAM Joshō
  workspace maps 1:1 to the existing UI workspace; no new concept is added.

## Conversation & Message  **[I]** *(client-only)*

- Client: `state/chat.ts` — conversations as **block-based messages**
  (`text | artifact | evidence | status`), envelope `thylas:chat:v1`, caps (20
  conversations / 200 messages), validated `read()`.
- Server-side future: **[P]** durable conversations with per-coworker attribution. The
  block model survives the move; the envelope validation pattern becomes the server
  schema's shape discipline.

## Artifact  **[I]** *(minimal) / History  **[P]***

- Today: an artifact is a code block in an answer; **Save as note** (via the real notes
  store) is the only honest persistence. The `artifact` block type exists in the message
  model with `savedAs` tracking.
- **[P]** Proposed model — the object WAM Joshō conversations produce and edit:

  ```
  Artifact     { id, conversationId, coworkerId, type, title, currentVersion }
  ArtifactType { note | roadmap | architecture | experiment | data-pipeline | ui-prototype }
  ArtifactVersion { id, artifactId, version, content, createdAt, author, message }
  ```

  State transitions (draft → reviewed → …) belong to the methodology toolsets that
  produce the artifact, not to the artifact itself. Version history is append-only;
  edits create versions, never mutate old ones.

## Coworker  **[P]** — future-facing, designed now, implemented later

- **[P]** `{ id, workspaceId, name, wamConnection }` — one record per collaborator;
  each independently connected to WAM. Communication between coworkers runs over a
  separate A2A protocol that **WAM owns**; Thylas stores only the connection handle and
  renders the transcript surfaces it is given.
- The user is not a Coworker; the human sits outside the A2A mesh.

## Tool / Toolset  **[P]** — future-facing

- **[P]** A toolset bundles methodology logic (experimental design, reverse
  engineering, meta-reasoning). Registration and execution interfaces belong to the
  future `server/routes/` + `server/wam/` split: Thylas hosts the surface and records
  results; WAM (or the toolset itself) does the reasoning. No tool executes today —
  every "action" in the UI is labelled as local, and that stays true until a real
  runtime exists.

## Integration  **[I]** *(client-only)*

- Client: `state/connect.ts` — catalog, tombstones, custom registrations
  ("Registered · not connected"); no OAuth client exists. Server-side future: real
  OAuth flows per provider **[P]**, out of Joshō's first scope.

## Backend / Instance / Workload  **[I]** *(client-only, Compute v2)*

- Client: `state/compute.ts` (`thylas:compute:v2`). A future executor would move the
  truth server-side **[P]** — the honesty rules (connection ≠ availability, queued-not-
  started) travel with it unchanged.

## Cross-cutting rule

A concept moves from **[I]** to server-side only when something outside one browser
needs it (a second coworker, a second device, WAM). Until then, the client envelopes are
the source of truth and are treated as real data, not as mock.
