/**
 * Server configuration, read once per process. The only module that knows
 * which environment variables the backend needs — handlers receive typed
 * values and never touch `env` directly (D-052).
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
};

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT_MS = 30_000;

function readTimeout(env: Env): number {
  const raw = Number(env.DEEPSEEK_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : DEFAULT_TIMEOUT_MS;
}

export function readConfig(env: Env): ServerConfig {
  return {
    apiKey: (env.DEEPSEEK_API_KEY ?? '').trim(),
    baseUrl: (env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
    timeoutMs: readTimeout(env),
  };
}

/** A missing key is configuration, not a broken network — handlers say so. */
export const CONFIG_ERROR_NOT_CONFIGURED =
  'No model key on the server. Put DEEPSEEK_API_KEY in .env.local and restart the dev server.';
