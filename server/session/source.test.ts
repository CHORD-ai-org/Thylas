/// <reference types="node" />
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../../src/lib/session.ts';
import { readConfig } from '../config.ts';
import { createSessionSource, parseDevSession } from './source.ts';

function request(cookie?: string): IncomingMessage {
  return { headers: cookie ? { cookie } : {} } as unknown as IncomingMessage;
}

const DEV_COOKIE = `${SESSION_COOKIE}=dev:u-1:ws-1,ws-2`;

describe('session source', () => {
  it('parses a dev cookie into an identity and membership flags', () => {
    expect(parseDevSession(request(DEV_COOKIE))).toEqual({
      id: 'u-1',
      workspaceIds: ['ws-1', 'ws-2'],
    });
  });

  it('rejects a missing, opaque or malformed cookie', () => {
    expect(parseDevSession(request())).toBeNull();
    expect(parseDevSession(request('other=1'))).toBeNull();
    expect(parseDevSession(request(`${SESSION_COOKIE}=opaque-token`))).toBeNull();
    expect(parseDevSession(request(`${SESSION_COOKIE}=dev:u-1:`))).toBeNull();
    expect(parseDevSession(request(`${SESSION_COOKIE}=dev::ws-1`))).toBeNull();
  });

  it('uses the dev source when no issuer is configured', async () => {
    const source = createSessionSource(readConfig({}));
    expect(source.mode).toBe('dev');
    expect(await source.read(request(DEV_COOKIE))).toEqual({
      id: 'u-1',
      workspaceIds: ['ws-1', 'ws-2'],
    });
  });

  it('fails closed when an IdP issuer is configured but no verifier exists', async () => {
    const source = createSessionSource(readConfig({ CHORD_ISSUER: 'https://idp.example.test' }));
    expect(source.mode).toBe('pending-idp');
    expect(await source.read(request(DEV_COOKIE))).toBeNull();
  });
});
