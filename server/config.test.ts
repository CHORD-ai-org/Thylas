import { describe, expect, it } from 'vitest';
import { readConfig } from './config.ts';

describe('readConfig', () => {
  it('keeps the model defaults when nothing is set', () => {
    const c = readConfig({});
    expect(c.baseUrl).toBe('https://api.deepseek.com');
    expect(c.model).toBe('deepseek-chat');
    expect(c.timeoutMs).toBe(30_000);
    expect(c.apiKey).toBe('');
  });

  it('leaves the Phase 1 variables empty until they are configured', () => {
    const c = readConfig({});
    expect(c.databaseUrl).toBe('');
    expect(c.storageBucket).toBe('');
    expect(c.storageDir).toBe('');
    expect(c.chordIssuer).toBe('');
    expect(c.port).toBe(8787);
  });

  it('reads the Phase 1 variables', () => {
    const c = readConfig({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/thylas',
      STORAGE_BUCKET: 'thylas-files',
      STORAGE_DIR: '.tmp/uploads',
      CHORD_ISSUER: 'https://idp.example.test',
      PORT: '9001',
    });
    expect(c.databaseUrl).toBe('postgres://user:pass@localhost:5432/thylas');
    expect(c.storageBucket).toBe('thylas-files');
    expect(c.storageDir).toBe('.tmp/uploads');
    expect(c.chordIssuer).toBe('https://idp.example.test');
    expect(c.port).toBe(9001);
  });

  it('ignores a VITE_ variable and a bad PORT', () => {
    const c = readConfig({ VITE_DATABASE_URL: 'leaked', PORT: '0' });
    expect(c.databaseUrl).toBe('');
    expect(c.port).toBe(8787);
  });

  it('trims the base URL and the key', () => {
    const c = readConfig({
      DEEPSEEK_BASE_URL: 'https://api.example.test///',
      DEEPSEEK_API_KEY: '  k  ',
    });
    expect(c.baseUrl).toBe('https://api.example.test');
    expect(c.apiKey).toBe('k');
  });
});

/* ---- D-061: more than one provider --------------------------------------- */

describe('readConfig — providers', () => {
  it('lists every known provider, DeepSeek first', () => {
    const c = readConfig({});
    expect(c.providers.map((p) => p.id)).toEqual([
      'deepseek',
      'openai',
      'anthropic',
      'openrouter',
      'kimi',
    ]);
    expect(c.providers[0]?.label).toBe('DeepSeek');
  });

  it('keeps the DeepSeek aliases pointing at the DeepSeek provider', () => {
    const c = readConfig({
      DEEPSEEK_API_KEY: 'sk-deepseek',
      DEEPSEEK_MODEL: 'deepseek-reasoner',
      DEEPSEEK_TIMEOUT_MS: '12000',
    });
    expect(c.apiKey).toBe('sk-deepseek');
    expect(c.model).toBe('deepseek-reasoner');
    expect(c.timeoutMs).toBe(12_000);
    expect(c.providers[0]?.apiKey).toBe('sk-deepseek');
    expect(c.providers[0]?.defaultModel).toBe('deepseek-reasoner');
  });

  it('reads a key per provider and leaves the others empty', () => {
    const c = readConfig({ OPENAI_API_KEY: 'sk-openai', ANTHROPIC_API_KEY: 'sk-anthropic' });
    const byId = new Map(c.providers.map((p) => [p.id, p]));
    expect(byId.get('openai')?.apiKey).toBe('sk-openai');
    expect(byId.get('anthropic')?.apiKey).toBe('sk-anthropic');
    expect(byId.get('openrouter')?.apiKey).toBe('');
    expect(byId.get('kimi')?.apiKey).toBe('');
  });

  it('defaults to the first provider that has a key', () => {
    const c = readConfig({ OPENAI_API_KEY: 'sk-openai' });
    expect(c.defaultProvider).toBe('openai');
    expect(c.defaultModel).toBe('gpt-4o-mini');
  });

  it('honours AI_DEFAULT_PROVIDER when that provider has a key', () => {
    const c = readConfig({
      DEEPSEEK_API_KEY: 'sk-deepseek',
      OPENAI_API_KEY: 'sk-openai',
      AI_DEFAULT_PROVIDER: 'openai',
    });
    expect(c.defaultProvider).toBe('openai');
  });

  it('falls back to a configured provider when AI_DEFAULT_PROVIDER names one without a key', () => {
    const c = readConfig({
      DEEPSEEK_API_KEY: 'sk-deepseek',
      AI_DEFAULT_PROVIDER: 'anthropic',
    });
    expect(c.defaultProvider).toBe('deepseek');
  });

  it('keeps AI_DEFAULT_PROVIDER when nothing is configured, so the refusal names it', () => {
    const c = readConfig({ AI_DEFAULT_PROVIDER: 'anthropic' });
    expect(c.defaultProvider).toBe('anthropic');
  });

  it('ignores an unknown AI_DEFAULT_PROVIDER', () => {
    const c = readConfig({ AI_DEFAULT_PROVIDER: 'nope', DEEPSEEK_API_KEY: 'sk-deepseek' });
    expect(c.defaultProvider).toBe('deepseek');
  });

  it('uses AI_DEFAULT_MODEL only when the default provider serves it', () => {
    const ok = readConfig({ DEEPSEEK_API_KEY: 'sk', AI_DEFAULT_MODEL: 'deepseek-reasoner' });
    expect(ok.defaultModel).toBe('deepseek-reasoner');
    const ignored = readConfig({ DEEPSEEK_API_KEY: 'sk', AI_DEFAULT_MODEL: 'gpt-4o' });
    expect(ignored.defaultModel).toBe('deepseek-chat');
  });

  it('keeps a pinned DeepSeek model allowed even when the list is replaced', () => {
    const c = readConfig({
      DEEPSEEK_API_KEY: 'sk',
      DEEPSEEK_MODEL: 'deepseek-custom',
      DEEPSEEK_MODELS: 'a,b',
    });
    const deepseek = c.providers[0];
    expect(deepseek?.models).toEqual(['deepseek-custom', 'a', 'b']);
    expect(deepseek?.defaultModel).toBe('deepseek-custom');
  });

  it('reads the allowlist from *_MODELS', () => {
    const c = readConfig({ OPENAI_API_KEY: 'sk', OPENAI_MODELS: 'gpt-4.1, gpt-4o ,gpt-4.1' });
    const openai = c.providers.find((p) => p.id === 'openai');
    expect(openai?.models).toEqual(['gpt-4.1', 'gpt-4o']);
  });

  it('refuses a base URL that is not https, and keeps the provider default', () => {
    const c = readConfig({ OPENAI_API_KEY: 'sk', OPENAI_BASE_URL: 'http://evil.example.test/v1' });
    const openai = c.providers.find((p) => p.id === 'openai');
    expect(openai?.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('allows plain http on loopback, where the offline checks run their stub', () => {
    const c = readConfig({ OPENAI_API_KEY: 'sk', OPENAI_BASE_URL: 'http://127.0.0.1:8799/v1' });
    const openai = c.providers.find((p) => p.id === 'openai');
    expect(openai?.baseUrl).toBe('http://127.0.0.1:8799/v1');
  });

  it('refuses a base URL that is not a URL at all', () => {
    const c = readConfig({ KIMI_API_KEY: 'sk', KIMI_BASE_URL: 'not a url' });
    const kimi = c.providers.find((p) => p.id === 'kimi');
    expect(kimi?.baseUrl).toBe('https://api.moonshot.cn/v1');
  });

  it('gives each provider its own timeout', () => {
    const c = readConfig({
      DEEPSEEK_API_KEY: 'sk',
      DEEPSEEK_TIMEOUT_MS: '1000',
      ANTHROPIC_API_KEY: 'sk2',
      ANTHROPIC_TIMEOUT_MS: '60000',
    });
    expect(c.providers.find((p) => p.id === 'deepseek')?.timeoutMs).toBe(1000);
    expect(c.providers.find((p) => p.id === 'anthropic')?.timeoutMs).toBe(60_000);
  });

  it('names the env var each provider needs', () => {
    const c = readConfig({});
    expect(c.providers.find((p) => p.id === 'anthropic')?.keyEnv).toBe('ANTHROPIC_API_KEY');
    expect(c.providers.find((p) => p.id === 'openrouter')?.keyEnv).toBe('OPENROUTER_API_KEY');
  });
});
