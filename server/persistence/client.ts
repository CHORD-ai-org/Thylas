/// <reference types="node" />
/**
 * The one place that opens a database connection (P1-4). Routes receive a
 * typed Drizzle handle; they never build a Pool or read DATABASE_URL themselves.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { ServerConfig } from '../config.ts';
import * as schema from './schema.ts';

function connect(url: string) {
  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

export type ConversationDatabase = ReturnType<typeof connect>;

/**
 * `null` when DATABASE_URL is empty — routes answer 503, they never guess.
 * `pglite://…` opens an in-process PGlite instead of a Postgres server (dev
 * fallback, 2026-11-24 — the same embedded database the tests use). Explicit
 * opt-in only; migrations run at boot.
 */
export function createDb(config: ServerConfig): ConversationDatabase | null {
  const url = config.databaseUrl;
  if (url === '') return null;
  if (url.startsWith('pglite:')) {
    const db = drizzlePglite(new PGlite(), { schema }) as unknown as ConversationDatabase;
    void migrate(db as never, { migrationsFolder: './server/persistence/migrations' }).catch(() => {
      /* A migration failure surfaces as errors on use, never as guessed data. */
    });
    return db;
  }
  return connect(url);
}
