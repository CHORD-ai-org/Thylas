import { defineConfig } from 'drizzle-kit';

/**
 * CLI-only config for `npm run db:generate` / `db:migrate` (P1-3).
 * The running server reads DATABASE_URL through `server/config.ts` (P1-2);
 * drizzle-kit is a separate process and needs its own credentials.
 */
export default defineConfig({
  schema: './server/persistence/schema.ts',
  out: './server/persistence/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:thylas@127.0.0.1:55432/thylas',
  },
});
