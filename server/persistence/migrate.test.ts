import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import * as schema from './schema.ts';

/**
 * P1-3 / P1-6 acceptance, without Docker: PGlite is Postgres compiled to WASM,
 * so the generated SQL and drizzle's migration bookkeeping are exercised for
 * real. A real Postgres host is checked by `npm run db:migrate` once one runs.
 */
const MIGRATIONS = './server/persistence/migrations';

describe('chat + files migrations', () => {
  it(
    'applies both migrations twice on an empty database and accepts rows',
    async () => {
      const client = new PGlite();
      const db = drizzle(client, { schema });

      await migrate(db, { migrationsFolder: MIGRATIONS });
      await migrate(db, { migrationsFolder: MIGRATIONS });

      const tables = await client.query<{ tablename: string }>(
        "select tablename from pg_tables where schemaname = 'public' order by tablename",
      );
      expect(tables.rows.map((r) => r.tablename)).toEqual(
        expect.arrayContaining(['conversations', 'messages', 'files']),
      );

      await db.insert(schema.conversations).values({
        id: 'c-1',
        workspaceId: 'ws-1',
        title: 'First',
      });
      await db.insert(schema.messages).values({
        id: 'm-1',
        conversationId: 'c-1',
        position: 0,
        role: 'user',
        blocks: [{ kind: 'text', text: 'hi' }],
      });
      await db.insert(schema.files).values({
        id: 'f-1',
        workspaceId: 'ws-1',
        name: 'report.txt',
        kind: 'txt',
        sizeBytes: 5,
        storageKey: 'ws-1/f-1',
      });
      const messages = await client.query<{ n: string }>('select count(*)::text as n from messages');
      const files = await client.query<{ n: string }>('select count(*)::text as n from files');
      expect(messages.rows[0]?.n).toBe('1');
      expect(files.rows[0]?.n).toBe('1');

      await client.close();
    },
    60_000,
  );
});
