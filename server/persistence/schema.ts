/**
 * Server-side durable truth (P1-3, P1-6, P1-7, D-055). Migration order is
 * per-domain and chat goes first — the Joshō-critical surface
 * (`INTEGRATION.md:31`).
 *
 * How the 11 client envelopes in AUDIT.md:51-62 map to tables:
 *   thylas:user:v1                     → users               (Phase 2)
 *   thylas:workspaces:v1               → workspaces          (Phase 2)
 *   thylas:chat:v1                     → conversations + messages   (P1-3, P1-7) ← THIS FILE
 *   thylas:notes:v1 / thylas:note:v1:* → notes + note_versions (Phase 2)
 *   thylas:artifacts:v1                → artifacts + artifact_versions (Phase 4)
 *   thylas:connect:v1                  → integrations        (later)
 *   thylas:compute:v2                  → compute_*           (later)
 *   files                             → files               (P1-6)
 *   projects / connections / members  → projects, project_connections,
 *                                       project_members     (P0-1 of the
 *                                       Project plan; design doc ch6)
 *   boards / processes                → seed data, no table yet
 *   AI calls                          → no persistence
 *
 * Ids stay `text` because the client envelope already owns them; the server
 * does not mint a second identity scheme. Foreign keys to tables that do not
 * exist yet arrive with their domains, never as guesses.
 */
import { bigint, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { AiErr } from '../../src/lib/ai.ts';
import type { Block, ContextSource } from '../../src/lib/chat.ts';

export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    title: text('title').notNull().default(''),
    /** P1-7: declared context sources, stored with the conversation. */
    context: jsonb('context').$type<ContextSource[]>(),
    /** P1-7: optimistic-concurrency version for `PUT /api/chat/state`. */
    syncVersion: integer('sync_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [index('conversations_workspace_idx').on(table.workspaceId)],
);

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    role: text('role').notNull(),
    /** P1-7: the client's four `kind` Block variants, not P1-3's `{type}` shape. */
    blocks: jsonb('blocks').$type<Block[]>().notNull(),
    /** P1-7: the client's epoch-ms timestamp, kept as a number. */
    atMs: bigint('at_ms', { mode: 'number' }),
    meta: jsonb('meta').$type<{ model: string; ms: number }>(),
    error: jsonb('error').$type<AiErr>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_idx').on(table.conversationId, table.position)],
);

/**
 * P1-6. `folder_id` is a plain string on purpose: N4 says Thylas owns folders
 * and storage is flat. No `folders` table until a domain actually needs one.
 * `deleted_at` is a soft delete, matching the Files tombstone (SP-04b).
 */
export const files = pgTable(
  'files',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    folderId: text('folder_id'),
    /** P0-2: nullable on purpose — null means 未归类 (unfiled). Assignment is
        an application action, never inferred from paths. */
    projectId: text('project_id'),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('files_workspace_folder_idx').on(table.workspaceId, table.folderId)],
);

/**
 * P0-1 (Project plan). A project is a work-scene identity inside a workspace;
 * it owns no resource content — resources arrive as connections (引用不复制).
 * `state` is active | archived | deleted (deleted is the soft-delete mark).
 */
export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    summary: text('summary').notNull().default(''),
    state: text('state').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('projects_workspace_idx').on(table.workspaceId)],
);

/**
 * P0-3. A connection registers a reference to a resource that lives elsewhere
 * (local folder, repo, file, note, artifact, gsc-context). `locator` is the
 * resource's own address; `health` caches the last probe (ok | broken | unknown).
 * A broken locator never touches the project row — the card survives (H1).
 */
export const projectConnections = pgTable(
  'project_connections',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    locator: text('locator').notNull(),
    label: text('label').notNull().default(''),
    health: text('health').notNull().default('unknown'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('project_connections_project_idx').on(table.projectId),
    uniqueIndex('project_connections_unique').on(table.projectId, table.kind, table.locator),
  ],
);

/**
 * P0-1 table, P4-1 surface. Participation (参工) inside one project: role and a
 * resource-grant subset. Roster/employment (入职) stays at the workspace level.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').notNull(),
    actorKind: text('actor_kind').notNull().default('user'),
    role: text('role').notNull().default(''),
    grants: jsonb('grants').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.actorId] })],
);

/**
 * C0-1 (Coworker plan §27). A Coworker is an independent working identity —
 * `owner_id` is the tenant key (cloud-readiness §24), not a workspace: the
 * record survives across workspaces; employment (入职) is a roster relation
 * that arrives with C1. `deleted_at` is the soft-delete tombstone.
 */
export const coworkers = pgTable(
  'coworkers',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('active'),
    responsibilities: jsonb('responsibilities')
      .$type<{ forWork: string; notFor: string; output: string }>()
      .notNull()
      .default({ forWork: '', notFor: '', output: '' }),
    memberships: jsonb('memberships').$type<{ wsId: string; role: string }[]>().notNull().default([]),
    pinnedArtifactIds: jsonb('pinned_artifact_ids').$type<string[]>().notNull().default([]),
    /** C1-1: the Coworker's own tool configuration (layer 1 of the three-way
        grant intersection — 自身 ∩ Workspace ∩ Project). */
    toolsets: jsonb('toolsets').$type<string[]>().notNull().default([]),
    /** Declared configuration record (D-060), validated on write. */
    mind: jsonb('mind').$type<unknown>(),
    /** Client epoch-ms, kept as a number (same as messages.atMs). */
    createdAt: bigint('created_at_ms', { mode: 'number' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('coworkers_owner_idx').on(table.ownerId)],
);

/**
 * C0-3. Append-only collaboration trace ("build the trace before the second
 * Coworker"). No update path by design: the log is the audit.
 */
export const coworkerEvents = pgTable(
  'coworker_events',
  {
    id: text('id').primaryKey(),
    coworkerId: text('coworker_id')
      .notNull()
      .references(() => coworkers.id, { onDelete: 'cascade' }),
    projectId: text('project_id'),
    actorKind: text('actor_kind').notNull().default('user'),
    verb: text('verb').notNull(),
    payload: jsonb('payload').$type<unknown>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('coworker_events_coworker_idx').on(table.coworkerId, table.createdAt)],
);

/**
 * C1-1 (入职层): employment is a roster relation between a Coworker and a
 * Workspace, carrying the workspace-granted tool subset (layer 2). The
 * Coworker record itself stays workspace-independent (V3).
 */
export const coworkerEmployments = pgTable(
  'coworker_employments',
  {
    coworkerId: text('coworker_id')
      .notNull()
      .references(() => coworkers.id, { onDelete: 'cascade' }),
    wsId: text('ws_id').notNull(),
    role: text('role').notNull().default(''),
    grants: jsonb('grants').$type<string[]>().notNull().default([]),
    employedAt: timestamp('employed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.coworkerId, table.wsId] })],
);
