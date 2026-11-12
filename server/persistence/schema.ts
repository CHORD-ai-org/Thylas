/**
 * Server-side durable truth (P1-3, D-055). Migration order is per-domain and
 * chat goes first — it is the Joshō-critical surface (INTEGRATION.md:31).
 *
 * How the 11 client envelopes in AUDIT.md:51-62 map to tables:
 *   thylas:user:v1                     → users               (P1-4 / Phase 2)
 *   thylas:workspaces:v1               → workspaces          (P1-4 / Phase 2)
 *   thylas:chat:v1                     → conversations + messages   ← THIS FILE
 *   thylas:notes:v1 / thylas:note:v1:* → notes + note_versions (P1-4 / Phase 2)
 *   thylas:artifacts:v1                → artifacts + artifact_versions (Phase 4)
 *   thylas:connect:v1                  → integrations        (later)
 *   thylas:compute:v2                  → compute_*           (later)
 *   files / boards / processes        → seed data, no table yet
 *   AI calls                          → no persistence
 *
 * Ids stay `text` because the client envelope already owns them; the server
 * does not mint a second identity scheme. Foreign keys to tables that do not
 * exist yet arrive with their domains, never as guesses.
 */
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Mirrors the block union in `src/state/chat.ts`; stored as one JSON value. */
export type MessageBlock = {
  type: 'text' | 'artifact' | 'evidence' | 'status';
  text?: string;
  savedAs?: string;
};

export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    title: text('title').notNull().default(''),
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
    blocks: jsonb('blocks').$type<MessageBlock[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_idx').on(table.conversationId, table.position)],
);
