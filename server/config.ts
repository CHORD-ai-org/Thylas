/**
 * Server configuration, read once per process. The only module that knows
 * which environment variables the backend needs — handlers receive typed
 * values and never touch `env` directly (D-052, P1-2, P1-6).
 *
 * Precedence follows the existing rule: a variable the shell already set wins
 * over `.env`-file overrides, so a one-off `DEEPSEEK_MODEL=… npm run dev`
 * behaves as expected and a `.env.local` cannot silently redirect a test that
 * sets its own value.
 */

export type Env = Record<string, string | undefined>;

export type ServerConfig = {
  /** Model API key. Empty means "not configured" — handlers refuse without it. */
  apiKey: string;
  /** Model API origin, no trailing slash. */
  baseUrl: string;
  /** Model id pinned for this deployment. */
  model: string;
  /** Upstream budget in ms. A completion past this reads as broken, not slow. */
  timeoutMs: number;
  /** Port for the standalone host. Vite dev keeps its own 5173. */
  port: number;
  /** Postgres connection string. Empty means persistence is not configured yet. */
  databaseUrl: string;
  /** Target bucket for signed direct uploads (N3), reserved for a future S3 host. */
  storageBucket: string;
  /** Local root for uploaded bytes (P1-6). Empty means files API answers 503. */
  storageDir: string;
  /** CHORD identity provider issuer (N2). Empty means not configured. */
  chordIssuer: string;
};

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PORT = 8787;

function readPositiveInt(env: Env, name: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const raw = Number(env[name]);
  return Number.isFinite(raw) && raw > 0 && raw <= max ? Math.round(raw) : fallback;
}

export function readConfig(env: Env): ServerConfig {
  return {
    apiKey: (env.DEEPSEEK_API_KEY ?? '').trim(),
    baseUrl: (env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
    timeoutMs: readPositiveInt(env, 'DEEPSEEK_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    port: readPositiveInt(env, 'PORT', DEFAULT_PORT, 65535),
    databaseUrl: (env.DATABASE_URL ?? '').trim(),
    storageBucket: (env.STORAGE_BUCKET ?? '').trim(),
    storageDir: (env.STORAGE_DIR ?? '').trim(),
    chordIssuer: (env.CHORD_ISSUER ?? '').trim(),
  };
}

/** A missing key is configuration, not a broken network — handlers say so. */
export const CONFIG_ERROR_NOT_CONFIGURED =
  'No model key on the server. Put DEEPSEEK_API_KEY in .env.local and restart the dev server.';
