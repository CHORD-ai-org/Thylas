/**
 * The provider catalog: the whitelist every model request is resolved against.
 *
 * The rule this module exists to enforce (D-061): a browser may ask for a
 * model, never for an endpoint. `provider` and `model` are resolved against
 * what the operator configured on the server; anything outside that list is a
 * contract error, and a provider without a key is a configuration error. No
 * request can therefore redirect a key to an address the operator did not
 * name.
 */
import type { AiErrorKind } from '../../../src/lib/ai.ts';
import type { ProviderConfig, ServerConfig } from '../../config.ts';

export type ProviderChoice = {
  provider: ProviderConfig;
  /** The model that will actually be called. */
  model: string;
};

export type ResolveResult =
  | { ok: true; choice: ProviderChoice }
  | { ok: false; kind: AiErrorKind; message: string };

export function providerById(config: ServerConfig, id: string): ProviderConfig | null {
  const wanted = id.trim().toLowerCase();
  return config.providers.find((p) => p.id === wanted) ?? null;
}

function configuredProviders(config: ServerConfig): ProviderConfig[] {
  return config.providers.filter((p) => p.apiKey !== '');
}

function notConfigured(provider: ProviderConfig): ResolveResult {
  return {
    ok: false,
    kind: 'not_configured',
    message: `No ${provider.label} key on the server. Put ${provider.keyEnv} in .env.local and restart the dev server.`,
  };
}

/**
 * Pick the model inside a provider. A model outside the provider's allowlist
 * is refused rather than forwarded: the allowlist is the operator's statement
 * of what this deployment may call.
 */
function modelIn(provider: ProviderConfig, requested: string | undefined): ResolveResult {
  if (requested === undefined || requested.trim() === '') {
    return { ok: true, choice: { provider, model: provider.defaultModel } };
  }
  const wanted = requested.trim();
  if (!provider.models.includes(wanted)) {
    const allowed = provider.models.length > 0 ? provider.models.join(', ') : '(none configured)';
    return {
      ok: false,
      kind: 'contract',
      message: `${provider.label} does not serve the model "${wanted}". Allowed: ${allowed}.`,
    };
  }
  return { ok: true, choice: { provider, model: wanted } };
}

/**
 * Resolve a request's `{provider?, model?}` against the catalog.
 *
 * - a provider alone picks that provider's default model;
 * - a model alone is accepted only when exactly one provider serves it;
 * - neither falls back to the server default;
 * - anything unknown is a `contract` error, and a provider without a key is
 *   `not_configured` — the two ask the reader to do different things.
 */
export function resolveProvider(
  config: ServerConfig,
  requested: { provider?: string; model?: string },
): ResolveResult {
  const providerId = requested.provider?.trim() ?? '';
  const modelId = requested.model?.trim() ?? '';

  if (providerId !== '') {
    const provider = providerById(config, providerId);
    if (!provider) {
      const known = config.providers.map((p) => p.id).join(', ');
      return {
        ok: false,
        kind: 'contract',
        message: `Unknown provider "${providerId}". This server serves: ${known}.`,
      };
    }
    if (provider.apiKey === '') return notConfigured(provider);
    return modelIn(provider, modelId);
  }

  if (modelId !== '') {
    const owners = configuredProviders(config).filter((p) => p.models.includes(modelId));
    if (owners.length === 0) {
      const known = config.providers.map((p) => p.id).join(', ');
      return {
        ok: false,
        kind: 'contract',
        message: `No configured provider serves the model "${modelId}". This server serves: ${known}.`,
      };
    }
    if (owners.length > 1) {
      const names = owners.map((p) => p.id).join(', ');
      return {
        ok: false,
        kind: 'contract',
        message: `The model "${modelId}" is served by more than one provider (${names}). Name the provider.`,
      };
    }
    const owner = owners[0];
    if (!owner) {
      return {
        ok: false,
        kind: 'contract',
        message: `No configured provider serves the model "${modelId}".`,
      };
    }
    return { ok: true, choice: { provider: owner, model: modelId } };
  }

  const fallback = providerById(config, config.defaultProvider);
  if (!fallback) {
    return { ok: false, kind: 'not_configured', message: 'No model provider is configured on this server.' };
  }
  if (fallback.apiKey === '') return notConfigured(fallback);
  return { ok: true, choice: { provider: fallback, model: config.defaultModel } };
}

/** The status answer: enough for a picker, never enough to leak a key. */
export function providerSummaries(config: ServerConfig): {
  id: string;
  label: string;
  models: string[];
  configured: boolean;
}[] {
  return config.providers.map((p) => ({
    id: p.id,
    label: p.label,
    models: p.models,
    configured: p.apiKey !== '',
  }));
}
