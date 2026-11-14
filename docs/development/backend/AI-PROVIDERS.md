# Model providers

**Status:** implemented 2026-11-14 (D-061 … D-063). One server, several providers,
one picker.

Thylas talks to the model through one path. The provider behind that path is
chosen by the operator (server configuration) and by the reader (the picker).
Nothing else changes: the wire contract, the error taxonomy and the streaming
shape are the same for every provider.

---

## 1. What an operator configures

Every provider is one block of environment variables. A provider with no key is
listed but cannot be selected — the picker says "not configured" and the server
refuses the request with `not_configured`.

| Provider | Key | Base URL (default) | Endpoint | Model ids (default) |
| --- | --- | --- | --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` | `https://api.deepseek.com` | `POST {base}/chat/completions` | `deepseek-chat`, `deepseek-reasoner` |
| OpenAI | `OPENAI_API_KEY` | `https://api.openai.com/v1` | `POST {base}/chat/completions` | `gpt-4o-mini`, `gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `https://api.anthropic.com` | `POST {base}/v1/messages` | `claude-sonnet-4-5`, `claude-haiku-4-5` |
| OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | `POST {base}/chat/completions` | `openai/gpt-4o-mini`, `deepseek/deepseek-chat` |
| Kimi (Moonshot) | `KIMI_API_KEY` | `https://api.moonshot.cn/v1` | `POST {base}/chat/completions` | `kimi-k2.6`, `kimi-k2.5` |

Per-provider extras:

| Variable | Meaning |
| --- | --- |
| `<PROVIDER>_BASE_URL` | Override the base URL. https only, except plain http on loopback (the offline stub). A value that is not https is **ignored** and the default stands. |
| `<PROVIDER>_MODELS` | Comma-separated allowlist. Replaces the shipped list. A model outside the allowlist is refused. |
| `<PROVIDER>_TIMEOUT_MS` | Upstream budget for this provider. Default 30 000. |
| `<PROVIDER>_MAX_TOKENS` | Output cap for providers that require one (Anthropic). Default 4 096 there, "provider decides" elsewhere. |
| `OPENROUTER_REFERER`, `OPENROUTER_TITLE` | Optional attribution headers OpenRouter accepts. |
| `AI_DEFAULT_PROVIDER` | Which provider answers when the request names none. Falls back to the first provider that has a key. |
| `AI_DEFAULT_MODEL` | Which model of that provider. Used only when the default provider serves it. |

`DEEPSEEK_MODEL` still pins the DeepSeek model and is always allowed, even when
`DEEPSEEK_MODELS` replaces the list. `config.apiKey / baseUrl / model /
timeoutMs` still exist and still point at the DeepSeek provider, so nothing
written before D-061 breaks.

## 2. What a reader chooses

- The Composer picker lists every provider the server knows, with its models.
  A provider without a key is greyed out and says so.
- The choice is stored as a preference (`prefs.model = {provider, model}`) and
  survives a reload.
- A stored choice the server no longer serves — provider removed, model taken
  out of the allowlist — is dropped on read. The server's default takes over.
- The label is `provider/model`, because two providers can serve the same
  model name.

The server re-checks every choice against its own catalog. The browser may
name a model; it may never name an address.

## 3. The wire contract

### `GET /api/ai/status`

```json
{
  "configured": true,
  "model": "deepseek-chat",
  "default": { "provider": "deepseek", "model": "deepseek-chat" },
  "providers": [
    { "id": "deepseek", "label": "DeepSeek", "models": ["deepseek-chat"], "configured": true },
    { "id": "anthropic", "label": "Anthropic", "models": ["claude-sonnet-4-5"], "configured": false }
  ]
}
```

`default` and `providers` are optional on the wire: an older server answers
`{configured, model}` and stays a valid answer. The key is never in this body —
not its length, not its prefix.

### `POST /api/ai` and `POST /api/ai/stream`

The body may carry two optional fields:

```json
{ "prompt": "…", "history": [], "provider": "anthropic", "model": "claude-sonnet-4-5" }
```

- a provider alone picks that provider's default model;
- a model alone is accepted only when exactly one configured provider serves it;
- neither falls back to the server default.

A reply carries `provider` beside `model`. The stream carries the same pair in
the `x-thylas-provider` / `x-thylas-model` response headers, so the interface
can label an answer without the stream bytes carrying anything extra.

The seven error kinds are unchanged. Two of them now cover more ground:

| Situation | Kind | HTTP |
| --- | --- | --- |
| Unknown provider, model outside the allowlist | `contract` | 400 |
| Provider known but without a key | `not_configured` | 503 |

## 4. How the providers differ

Four of them speak the OpenAI shape and are one adapter
(`server/ai/providers/openai-compatible.ts`). Anthropic is a second adapter
(`server/ai/providers/anthropic.ts`) because three things differ:

| | OpenAI-compatible | Anthropic |
| --- | --- | --- |
| Path | `{base}/chat/completions` | `{base}/v1/messages` |
| Auth | `authorization: Bearer <key>` | `x-api-key: <key>` + `anthropic-version: 2023-06-01` |
| Required field | — | `max_tokens` |
| Roles | free | must alternate, must start with the user |
| Stream events | `data: {choices:[{delta:{content}}]}` | `message_start` / `content_block_delta` / `message_stop` |

The Anthropic adapter converts in both directions and nowhere else:

- the request: same-role turns are merged, leading assistant turns are dropped,
  `max_tokens` is added;
- the reply: `content[]` becomes the OpenAI completion shape the shared reader
  already parses;
- the stream: Anthropic's events are re-framed as OpenAI SSE, so the browser
  parses one shape whatever answered.

**This revises D-051 on purpose.** For an OpenAI-compatible provider the
upstream bytes still reach the browser byte-for-byte — the pipe stays a pipe.
Anthropic is the one provider that pays for a translation, and it pays for it
in the server, not in the browser.

## 5. Security

1. The key lives in the server environment and nowhere else. The status body,
   the model catalogue and every error message are scrubbed of all configured
   keys.
2. Provider, model and base URL are whitelists. A request cannot name an
   endpoint, so it cannot redirect a key.
3. A base URL must be https. Plain http survives only on loopback, where the
   offline checks run their stub. Anything else falls back to the provider's
   default.
4. The existing caps hold for every provider: 8 000 prompt characters, 12
   history turns of 4 000 characters, a 64 KB body, the provider's timeout.
5. The client disconnect aborts the upstream request, as before.
6. An upstream error is classified into the shared kinds; the raw body is
   reduced to its sentence before it reaches the browser.
7. No SDK dependency was added. The adapters are plain `fetch` and `node:http`.

## 6. Adding a provider

1. Add a `ProviderSpec` in `server/config.ts` (id, label, key env, base URL,
   model list) and put it in `SPECS`.
2. If it speaks the OpenAI shape, it is done — `openai-compatible.ts` covers
   it. If it does not, add an adapter beside it and branch in
   `server/ai-handler.ts` where the request is built.
3. Add the model ids to `DEFAULT_MODELS`, or let the operator set
   `<PROVIDER>_MODELS`.
4. Extend `scripts/ai-checks.mjs` with the provider's path and reply shape.
5. Write down what the provider's own documentation says (auth headers,
   required fields, event names) in the row of the table in §1.

## 7. What is not here

- **BYOK** (a key the reader brings). It needs real authentication and a
  per-user secret store; Thylas has a dev cookie stand-in and no database.
  Deferred as its own stage, not as a field on this one.
- **A live model catalogue.** The allowlist is a static env list. Pulling
  OpenRouter's model list at runtime needs caching, quotas and a budget.
- **Automatic failover between providers.** A failed call stays failed: an
  automatic retry elsewhere would silently change the bill and the answer.
- **Pricing or context-window display.** Not needed to choose a model.
- **Kimi through OpenRouter.** The direct Moonshot endpoint is implemented;
  the OpenRouter route is just another OpenAI-compatible base URL.
