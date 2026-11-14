/**
 * The OpenAI-shaped adapter: DeepSeek, OpenAI, OpenRouter and Kimi all speak
 * `POST {base}/chat/completions` with a bearer key and stream in
 * `choices[].delta.content`.
 *
 * Nothing here re-frames the stream. For these providers the upstream bytes
 * reach the browser unchanged (D-051) — the fast path stays a pipe.
 */
import type { ProviderConfig } from '../../config.ts';
import type { ChatMessage, UpstreamRequest } from './types.ts';

export function buildOpenAiRequest(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  stream: boolean,
): UpstreamRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${provider.apiKey}`,
  };
  if (stream) headers.accept = 'text/event-stream';
  /* OpenRouter asks for attribution on some routes; both are optional. */
  if (provider.referer) headers['HTTP-Referer'] = provider.referer;
  if (provider.title) headers['X-OpenRouter-Title'] = provider.title;

  return {
    url: `${provider.baseUrl}/chat/completions`,
    headers,
    body: JSON.stringify({ model, messages, stream }),
  };
}
