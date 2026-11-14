/**
 * Server configuration, read once per process. The only module that knows
 * which environment variables the backend needs — handlers receive typed
 * values and never touch `env` directly (D-052, P1-2, P1-6).
 *
 * Precedence follows the existing rule: a variable the shell already set wins
 * over `.env`-file overrides, so a one-off `DEEPSEEK_MODEL=… npm run dev`
 * behaves as expected and a `.env.local` cannot silently redirect a test that
 * sets its own value.
 *
 * Since D-061 the process can talk to more than one model provider. Every
 * provider is one typed entry in `config.providers`; the old single-provider
 * fields stay as aliases for the DeepSeek entry, so every existing caller,
 * test and script keeps working without a change.
 */

export type Env = Record<string, string | undefined>;

export type ProviderId = 'deepseek' | 'openai' | 'anthropic' | 'openrouter' | 'kimi';

export type ProviderConfig = {
  id: ProviderId;
  /** The name a reader sees in the model picker. */
  label: string;
  /** The env var that holds the key — named so an error can point at it. */
  keyEnv: string;
  /** Empty means "not configured": handlers refuse without it. */
  apiKey: string;
  /** Model API origin, no trailing slash. */
  baseUrl: string;
  /**
   * The allowlist. A request for a model outside it is a contract error, not
   * a forwarded string: the server never calls a model the operator did not
   * name here.
   */
  models: string[];
  /** The model used when a request does not name one. */
  defaultModel: string;
  /** Upstream budget in ms for this provider. */
  timeoutMs: number;
  /** Output cap for providers that require one (Anthropic). 0 = provider decides. */
  maxTokens: number;
  /** OpenRouter attribution headers. Empty for every other provider. */
  referer: string;
  title: string;
};

export type ServerConfig = {
  /**
   * Legacy aliases for the DeepSeek provider, kept so the pre-D-061 callers
   * (and every test and script written against them) keep working.
   */
  apiKey: string;
  baseUrl: string;
  model: string;
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
  /** Every known provider, in the order the interface lists them. */
  providers: ProviderConfig[];
  /** The provider a request uses when it names none. */
  defaultProvider: ProviderId;
  /** The model that provider starts with. */
  defaultModel: string;
};

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PORT = 8787;

/**
 * The model ids each provider ships with. They are a starting point, not a
 * promise: `*_MODELS` replaces the list, and anything outside the list is
 * refused. Checked against the provider's own documentation before shipping.
 */
const DEFAULT_MODELS: Record<ProviderId, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
  openrouter: ['openai/gpt-4o-mini', 'deepseek/deepseek-chat'],
  kimi: ['kimi-k2.6', 'kimi-k2.5'],
};

type ProviderSpec = {
  id: ProviderId;
  label: string;
  keyEnv: string;
  defaultBaseUrl: string;
  modelsEnv: string;
  timeoutEnv: string;
};

const DEEPSEEK_SPEC: ProviderSpec = {
  id: 'deepseek',
  label: 'DeepSeek',
  keyEnv: 'DEEPSEEK_API_KEY',
  defaultBaseUrl: DEFAULT_BASE_URL,
  modelsEnv: 'DEEPSEEK_MODELS',
  timeoutEnv: 'DEEPSEEK_TIMEOUT_MS',
};

const OPENAI_SPEC: ProviderSpec = {
  id: 'openai',
  label: 'OpenAI',
  keyEnv: 'OPENAI_API_KEY',
  defaultBaseUrl: 'https://api.openai.com/v1',
  modelsEnv: 'OPENAI_MODELS',
  timeoutEnv: 'OPENAI_TIMEOUT_MS',
};

const ANTHROPIC_SPEC: ProviderSpec = {
  id: 'anthropic',
  label: 'Anthropic',
  keyEnv: 'ANTHROPIC_API_KEY',
  defaultBaseUrl: 'https://api.anthropic.com',
  modelsEnv: 'ANTHROPIC_MODELS',
  timeoutEnv: 'ANTHROPIC_TIMEOUT_MS',
};

const OPENROUTER_SPEC: ProviderSpec = {
  id: 'openrouter',
  label: 'OpenRouter',
  keyEnv: 'OPENROUTER_API_KEY',
  defaultBaseUrl: 'https://openrouter.ai/api/v1',
  modelsEnv: 'OPENROUTER_MODELS',
  timeoutEnv: 'OPENROUTER_TIMEOUT_MS',
};

const KIMI_SPEC: ProviderSpec = {
  id: 'kimi',
  label: 'Kimi (Moonshot)',
  keyEnv: 'KIMI_API_KEY',
  defaultBaseUrl: 'https://api.moonshot.cn/v1',
  modelsEnv: 'KIMI_MODELS',
  timeoutEnv: 'KIMI_TIMEOUT_MS',
};

const SPECS: ProviderSpec[] = [
  DEEPSEEK_SPEC,
  OPENAI_SPEC,
  ANTHROPIC_SPEC,
  OPENROUTER_SPEC,
  KIMI_SPEC,
];

const PROVIDER_IDS = SPECS.map((s) => s.id);

function readPositiveInt(env: Env, name: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const raw = Number(env[name]);
  return Number.isFinite(raw) && raw > 0 && raw <= max ? Math.round(raw) : fallback;
}

/**
 * A base URL decides where the key is sent, so it is a security boundary, not
 * a convenience setting. Only https is allowed; plain http survives only on
 * loopback, where the offline checks script runs its stub upstream. Anything
 * else falls back to the provider's own default rather than being honoured.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function safeBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '');
  if (trimmed === '') return fallback;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'https:') return trimmed;
    if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return trimmed;
  } catch {
    /* not a URL at all */
  }
  return fallback;
}

/** A comma-separated list; empty means "use the shipped default". */
function readModelList(env: Env, name: string, fallback: string[]): string[] {
  const raw = (env[name] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (raw.length === 0) return [...fallback];
  return [...new Set(raw)];
}

function buildProvider(env: Env, spec: ProviderSpec): ProviderConfig {
  const models = readModelList(env, spec.modelsEnv, DEFAULT_MODELS[spec.id]);
  /* The pinned model of the DeepSeek deployment is always allowed: it was
     allowed before D-061 and an operator must not lose it by upgrading. */
  if (spec.id === 'deepseek') {
    const pinned = (env.DEEPSEEK_MODEL ?? '').trim();
    if (pinned !== '' && !models.includes(pinned)) models.unshift(pinned);
  }
  const defaultModel =
    spec.id === 'deepseek' && (env.DEEPSEEK_MODEL ?? '').trim() !== ''
      ? (env.DEEPSEEK_MODEL ?? '').trim()
      : (models[0] ?? '');
  return {
    id: spec.id,
    label: spec.label,
    keyEnv: spec.keyEnv,
    apiKey: (env[spec.keyEnv] ?? '').trim(),
    baseUrl: safeBaseUrl(env[`${spec.id.toUpperCase()}_BASE_URL`], spec.defaultBaseUrl),
    models,
    defaultModel,
    timeoutMs: readPositiveInt(env, spec.timeoutEnv, DEFAULT_TIMEOUT_MS),
    maxTokens: readPositiveInt(env, `${spec.id.toUpperCase()}_MAX_TOKENS`, 0, 1_000_000),
    referer: (env[`${spec.id.toUpperCase()}_REFERER`] ?? '').trim(),
    title: (env[`${spec.id.toUpperCase()}_TITLE`] ?? '').trim(),
  };
}

/**
 * The default provider is the first one with a key, so a deployment that only
 * has an OpenAI key still answers. `AI_DEFAULT_PROVIDER` wins when it names a
 * provider that is actually configured; when nothing is configured at all it
 * still wins, so the refusal names the provider the operator asked for.
 */
function pickDefaultProvider(env: Env, providers: ProviderConfig[]): ProviderId {
  const requested = (env.AI_DEFAULT_PROVIDER ?? '').trim().toLowerCase();
  const known = PROVIDER_IDS.includes(requested as ProviderId);
  const configured = providers.filter((p) => p.apiKey !== '');
  if (known && configured.some((p) => p.id === requested)) return requested as ProviderId;
  if (configured[0]) return configured[0].id;
  return known ? (requested as ProviderId) : 'deepseek';
}

export function readConfig(env: Env): ServerConfig {
  const deepseek = buildProvider(env, DEEPSEEK_SPEC);
  const providers = [
    deepseek,
    buildProvider(env, OPENAI_SPEC),
    buildProvider(env, ANTHROPIC_SPEC),
    buildProvider(env, OPENROUTER_SPEC),
    buildProvider(env, KIMI_SPEC),
  ];
  const defaultProvider = pickDefaultProvider(env, providers);

  const defaultProviderConfig = providers.find((p) => p.id === defaultProvider) ?? deepseek;
  const requestedDefaultModel = (env.AI_DEFAULT_MODEL ?? '').trim();
  const defaultModel =
    requestedDefaultModel !== '' && defaultProviderConfig.models.includes(requestedDefaultModel)
      ? requestedDefaultModel
      : defaultProviderConfig.defaultModel;

  return {
    apiKey: deepseek.apiKey,
    baseUrl: deepseek.baseUrl,
    model: deepseek.defaultModel,
    timeoutMs: deepseek.timeoutMs,
    port: readPositiveInt(env, 'PORT', DEFAULT_PORT, 65535),
    databaseUrl: (env.DATABASE_URL ?? '').trim(),
    storageBucket: (env.STORAGE_BUCKET ?? '').trim(),
    storageDir: (env.STORAGE_DIR ?? '').trim(),
    chordIssuer: (env.CHORD_ISSUER ?? '').trim(),
    providers,
    defaultProvider,
    defaultModel,
  };
}

/**
 * A missing key is configuration, not a broken network — and the message
 * names the variable the operator has to set, not a generic sentence.
 */
export function notConfiguredMessage(provider: ProviderConfig): string {
  return `No ${provider.label} key on the server. Put ${provider.keyEnv} in .env.local and restart the dev server.`;
}

/** Kept for the pre-D-061 callers; the DeepSeek text is the default one. */
export const CONFIG_ERROR_NOT_CONFIGURED =
  'No model key on the server. Put DEEPSEEK_API_KEY in .env.local and restart the dev server.';
