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
