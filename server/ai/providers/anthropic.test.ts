/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readConfig, type ProviderConfig } from '../../config.ts';
import {
  buildAnthropicRequest,
  createAnthropicNormalizer,
  toAnthropicMessages,
  toOpenAiCompletion,
} from './anthropic.ts';

function anthropic(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  const base = readConfig({ ANTHROPIC_API_KEY: 'sk-anthropic' }).providers.find(
    (p) => p.id === 'anthropic',
  );
  if (!base) throw new Error('the anthropic provider is missing');
  return { ...base, ...overrides };
}

describe('toAnthropicMessages', () => {
  it('keeps a plain alternation as it is', () => {
    const out = toAnthropicMessages([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
  });

  it('merges two turns of the same role, because Anthropic refuses them', () => {
    const out = toAnthropicMessages([
      { role: 'user', content: 'one' },
      { role: 'user', content: 'two' },
    ]);
    expect(out).toEqual([{ role: 'user', content: 'one\n\ntwo' }]);
  });

  it('drops a leading assistant turn, because the first turn must be the user', () => {
    const out = toAnthropicMessages([
      { role: 'assistant', content: 'stale' },
      { role: 'user', content: 'hello' },
    ]);
    expect(out).toEqual([{ role: 'user', content: 'hello' }]);
  });
});

describe('buildAnthropicRequest', () => {
  it('uses the messages endpoint, the Anthropic headers and a max_tokens', () => {
    const provider = anthropic();
    const request = buildAnthropicRequest(provider, 'claude-sonnet-4-5', [
      { role: 'user', content: 'hello' },
    ], false);
    expect(request.url).toBe('https://api.anthropic.com/v1/messages');
    expect(request.headers['x-api-key']).toBe('sk-anthropic');
    expect(request.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(request.body) as { model: string; max_tokens: number; stream: boolean };
    expect(body.model).toBe('claude-sonnet-4-5');
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.stream).toBe(false);
  });

  it('takes the output cap from the configuration', () => {
    const provider = anthropic({ maxTokens: 256 });
    const request = buildAnthropicRequest(provider, 'claude-sonnet-4-5', [
      { role: 'user', content: 'hello' },
    ], false);
    expect(JSON.parse(request.body).max_tokens).toBe(256);
  });

  it('asks for an event stream when streaming', () => {
    const request = buildAnthropicRequest(anthropic(), 'claude-sonnet-4-5', [
      { role: 'user', content: 'hello' },
    ], true);
    expect(request.headers.accept).toBe('text/event-stream');
    expect(JSON.parse(request.body).stream).toBe(true);
  });
});

describe('toOpenAiCompletion', () => {
  it('reads the text blocks into the shared completion shape', () => {
    const out = toOpenAiCompletion({
      id: 'msg_1',
      model: 'claude-sonnet-4-5',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'thinking', thinking: 'ignored' },
        { type: 'text', text: 'world' },
      ],
    }) as { model: string; choices: { message: { content: string } }[] };
    expect(out.choices[0]?.message.content).toBe('Hello world');
    expect(out.model).toBe('claude-sonnet-4-5');
  });

  it('leaves a body it cannot read alone, so the shared reader refuses it', () => {
    expect(toOpenAiCompletion({ hello: 'world' })).toEqual({ hello: 'world' });
  });
});

describe('createAnthropicNormalizer', () => {
  const frames = (...lines: string[]): string =>
    lines.map((line) => `event: e\ndata: ${line}\n\n`).join('');

  it('turns Anthropic events into the OpenAI SSE the client parses', () => {
    const normalizer = createAnthropicNormalizer('claude-sonnet-4-5');
    const out = normalizer.push(
      frames(
        JSON.stringify({ type: 'message_start', message: { model: 'claude-sonnet-4-5' } }),
        JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello' },
        }),
        JSON.stringify({ type: 'message_stop' }),
      ),
    );
    const payloads = out
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    expect(payloads[0]).toContain('"model":"claude-sonnet-4-5"');
    expect(payloads[1]).toContain('"content":"Hello"');
    expect(payloads[payloads.length - 1]).toBe('[DONE]');
  });

  it('ignores a non-text block instead of guessing at it', () => {
    const normalizer = createAnthropicNormalizer('claude-sonnet-4-5');
    const out = normalizer.push(
      frames(
        JSON.stringify({ type: 'message_start', message: { model: 'm' } }),
        JSON.stringify({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } }),
        JSON.stringify({ type: 'message_stop' }),
      ),
    );
    expect(out).not.toContain('content');
  });

  it('holds a partial line until it is complete, then emits it whole', () => {
    const normalizer = createAnthropicNormalizer('m');
    normalizer.push(frames(JSON.stringify({ type: 'message_start', message: { model: 'm' } })));
    /* The first push has no trailing newline, so the data line is not complete
       yet — a half-parsed JSON line is never guessed at. */
    const first = normalizer.push(
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}',
    );
    const second = normalizer.push(
      '\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
    );
    expect(first).toBe('');
    expect(second).toContain('"content":"Hel"');
    expect(second).toContain('"content":"lo"');
  });

  it('reports an upstream error as an error frame, not as silence', () => {
    const normalizer = createAnthropicNormalizer('m');
    const out = normalizer.push(
      frames(JSON.stringify({ type: 'error', error: { message: 'overloaded' } })),
    );
    expect(out).toContain('overloaded');
    expect(out).toContain('[DONE]');
  });

  it('ends the stream with [DONE] even when the provider never sent message_stop', () => {
    const normalizer = createAnthropicNormalizer('m');
    normalizer.push(frames(JSON.stringify({ type: 'message_start', message: { model: 'm' } })));
    expect(normalizer.flush()).toContain('[DONE]');
  });
});
