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
 *   boards / processes                → seed data, no table yet
 *   AI calls                          → no persistence
 *
 * Ids stay `text` because the client envelope already owns them; the server
 * does not mint a second identity scheme. Foreign keys to tables that do not
 * exist yet arrive with their domains, never as guesses.
 */
import { bigint, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
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
