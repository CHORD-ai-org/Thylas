/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readConfig, type ServerConfig } from '../../config.ts';
import { providerSummaries, resolveProvider } from './catalog.ts';

function config(env: Record<string, string>): ServerConfig {
  return readConfig(env);
}

describe('resolveProvider', () => {
  it('falls back to the server default when the request names nothing', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-deepseek' });
    const result = resolveProvider(c, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.provider.id).toBe('deepseek');
    expect(result.choice.model).toBe('deepseek-chat');
  });

  it('takes the provider the request names, with that provider default model', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d', OPENAI_API_KEY: 'sk-o' });
    const result = resolveProvider(c, { provider: 'openai' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.provider.id).toBe('openai');
    expect(result.choice.model).toBe('gpt-4o-mini');
  });

  it('takes the model when the provider serves it', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d' });
    const result = resolveProvider(c, { provider: 'deepseek', model: 'deepseek-reasoner' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.model).toBe('deepseek-reasoner');
  });

  it('refuses a model outside the provider allowlist', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d' });
    const result = resolveProvider(c, { provider: 'deepseek', model: 'gpt-4o' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('contract');
    expect(result.message).toContain('gpt-4o');
  });

  it('refuses an unknown provider', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d' });
    const result = resolveProvider(c, { provider: 'acme' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('contract');
    expect(result.message).toContain('Unknown provider');
  });

  it('reports a provider without a key as a configuration problem', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d' });
    const result = resolveProvider(c, { provider: 'anthropic' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('not_configured');
    expect(result.message).toContain('ANTHROPIC_API_KEY');
  });

  it('resolves a model on its own when exactly one provider serves it', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d', KIMI_API_KEY: 'sk-k' });
    const result = resolveProvider(c, { model: 'kimi-k2.6' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.provider.id).toBe('kimi');
    expect(result.choice.model).toBe('kimi-k2.6');
  });

  it('asks for the provider when two of them serve the same model', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d', OPENAI_API_KEY: 'sk-o' });
    const c2 = readConfig({
      DEEPSEEK_API_KEY: 'sk-d',
      OPENAI_API_KEY: 'sk-o',
      OPENAI_MODELS: 'deepseek-chat',
    });
    expect(c.defaultProvider).toBe('deepseek');
    const result = resolveProvider(c2, { model: 'deepseek-chat' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('contract');
    expect(result.message).toContain('more than one provider');
  });

  it('refuses a model no configured provider serves', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d' });
    const result = resolveProvider(c, { model: 'llama-9' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('contract');
  });

  it('answers not_configured when no provider has a key', () => {
    const c = config({});
    const result = resolveProvider(c, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('not_configured');
    expect(result.message).toContain('DEEPSEEK_API_KEY');
  });

  it('never accepts a URL in place of a provider id', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-d' });
    const result = resolveProvider(c, { provider: 'https://evil.example.test' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('contract');
  });
});

describe('providerSummaries', () => {
  it('says which providers have a key and which do not, never the key itself', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk-secret-value', OPENAI_API_KEY: '' });
    const summaries = providerSummaries(c);
    const deepseek = summaries.find((p) => p.id === 'deepseek');
    const openai = summaries.find((p) => p.id === 'openai');
    expect(deepseek?.configured).toBe(true);
    expect(openai?.configured).toBe(false);
    expect(JSON.stringify(summaries)).not.toContain('sk-secret-value');
  });

  it('lists the models each provider may serve', () => {
    const c = config({ DEEPSEEK_API_KEY: 'sk' });
    const deepseek = providerSummaries(c).find((p) => p.id === 'deepseek');
    expect(deepseek?.models).toContain('deepseek-chat');
    expect(deepseek?.label).toBe('DeepSeek');
  });
});
