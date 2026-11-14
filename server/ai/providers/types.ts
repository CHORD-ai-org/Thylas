/**
 * The shapes every provider adapter agrees on.
 *
 * `UpstreamRequest` is deliberately the raw wire form: a URL, headers and a
 * JSON body. Nothing above the adapter is allowed to know how a provider
 * wants to be called — that knowledge lives in the adapter and nowhere else.
 */

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type UpstreamRequest = {
  /** Absolute URL, already resolved against the provider's configured base. */
  url: string;
  headers: Record<string, string>;
  /** The JSON body, serialized once so both transports send the same bytes. */
  body: string;
};
