/// <reference types="node" />
/**
 * The one place that opens a database connection (P1-4). Routes receive a
 * typed Drizzle handle; they never build a Pool or read DATABASE_URL themselves.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { ServerConfig } from '../config.ts';
import * as schema from './schema.ts';

function connect(url: string) {
  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

export type ConversationDatabase = ReturnType<typeof connect>;

/** `null` when DATABASE_URL is empty — routes answer 503, they never guess. */
export function createDb(config: ServerConfig): ConversationDatabase | null {
  return config.databaseUrl === '' ? null : connect(config.databaseUrl);
}
