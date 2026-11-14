# API 完善计划 — 多模型提供方（OpenAI / Anthropic / OpenRouter / Kimi …）

**Date:** 2026-11-14 · 状态：**已执行（P0–P4、P6；P5 BYOK 未做，理由见下）**
**目标**：用户可在 Thylas 内选择并使用多家模型提供方，而当前只有服务端钉死的 DeepSeek。

> **执行记录（2026-11-14）。** 三个待拍板的决策已按本计划的建议定案并写入
> `docs/development/backend/AUDIT.md` §8.1：
>
> | # | 决策 | 结论 | 记录 |
> | --- | --- | --- | --- |
> | D1 | 让用户可以使用 = ①env 配多 key ②BYOK ③都要 | **①**。BYOK 需要真认证与按用户隔离的密钥存储（当前只有 dev cookie、无 DB），作为独立阶段，不塞进本阶段 | D-061 |
> | D2 | Anthropic 的非 OpenAI SSE | **服务端归一化**：`content_block_delta` 转成 `choices[0].delta.content`，浏览器零改动。OpenAI 兼容方保留逐字节透传快路径 | D-062 |
> | D3 | 模型选择存在哪里 | **全局 prefs**：`prefs.model = {provider, model} | null`。未选 → 服务端 default；存的选择在服务端不再可用时丢弃并回落 default | D-063 |
>
> 交付物：实现细节见 [`AI-PROVIDERS.md`](AI-PROVIDERS.md)，决策记录见
> [`AUDIT.md`](AUDIT.md) §8.1。P5（BYOK）未实现——它是独立阶段，不是本阶段的一个开关。
> 本计划 §8 的未决项中，1/2/3/4/5/6 已按本计划建议定案；7（Kimi 直连）已核实：
> Moonshot 直连 base 为 `https://api.moonshot.cn/v1`，OpenAI 兼容，模型 `kimi-k2.6` / `kimi-k2.5`。
> 动态模型目录（未决 3 的另一半）与跨 provider 自动回退（未决 6）仍未实现，理由见
> `AI-PROVIDERS.md` §7。

## 1. 审计（逐项核实，未假设）

| 项 | 现状 | 证据 |
| --- | --- | --- |
| 配置 | 单组 `DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL / DEEPSEEK_TIMEOUT_MS`；`ServerConfig` 只有 `apiKey/baseUrl/model/timeoutMs` | `server/config.ts:18-56` |
| 契约 | `src/lib/ai.ts`：`AI_PATH` / `AI_STREAM_PATH` / `AI_STATUS_PATH`；`AiStatusBody={configured,model}`；7 类 `AiErrorKind`；prompt 上限 8000、历史 12 条/4000 字 | `src/lib/ai.ts:12-70` |
| 路由 | `/api/ai` 用 `fetch` 调 `${base}/chat/completions`、`stream:false`；`/api/ai/stream` 用 `node:http` **把上游 OpenAI 格式 SSE 逐字节透传**给浏览器 | `server/ai-handler.ts:84-215, 223-340` |
| 客户端 | `probe()` 读 status；`ask()` 走 `/api/ai`；`streamChat()` 发 `{prompt,history}` 并**按 OpenAI SSE 解析** `choices[0].delta.content` | `src/services/ai/{client,stream}.ts` |
| 模型选择 | `Composer.tsx:23` 硬编码 `['deepseek-chat','deepseek-reasoner']`；非当前模型按钮 disabled，文案「模型由 DEEPSEEK_MODEL 钉死」 | `src/pages/chat/Composer.tsx:140-175` |
| 会话记录 | `meta.model` 只存模型名字符串 | `src/state/chat.ts:379-397` |
| 密钥 | 只在服务端 env；status 只回 `{configured,model}`；上游错误经 `scrub()` 去密钥 | `server/ai-handler.ts:74-82` |
| 认证 | dev cookie stand-in；IdP 未接入；无 `DATABASE_URL` | `server/session/source.ts`、`server/persistence/client.ts` |
| 测试 | `scripts/ai-checks.mjs`（双 Vite + 本地 stub upstream，覆盖 7 类错误）、`scripts/api-checks.mjs`、`scripts/ui-checks.mjs` 的 chat 块（stub 8799）、`server/config.test.ts`、`stream.integration.test.ts` | — |
| 文档 | `docs/development/backend/INTEGRATION.md §1` 明确写「**Multi-provider routing is out of scope**」 | 需在实施时改写 |

**可复用**：wire contract 模式、typed error taxonomy、stub upstream 测试装置、`scrub()`、status 探针、config 单一读取点、chat store 的 `meta`。
**缺口**：provider 抽象、多 key 配置、模型目录、真实选择器、跨格式 SSE、BYOK 存储。

## 2. 提供方兼容性（本次核实的公开接口）

| 提供方 | 接口 | 认证 | SSE | 接入成本 |
| --- | --- | --- | --- | --- |
| DeepSeek（现状） | `POST {base}/chat/completions` | Bearer | OpenAI `choices[].delta` | 0 |
| OpenAI | `POST /v1/chat/completions` | Bearer | 同上 | 低（兼容层） |
| OpenRouter | `POST https://openrouter.ai/api/v1/chat/completions`，模型带厂商前缀；可选 `HTTP-Referer` / `X-OpenRouter-Title` | Bearer | OpenAI 兼容 | 低 |
| Kimi | ① Moonshot 直连（OpenAI 兼容，base 待核）② 经 OpenRouter `moonshotai/kimi-*` | Bearer | OpenAI 兼容 | 低（推荐先走 ②） |
| Anthropic | `POST https://api.anthropic.com/v1/messages`；`max_tokens` 必填、`system` 顶层 | `x-api-key` + `anthropic-version: 2023-06-01` | **自有事件流**：`message_start / content_block_delta(text_delta) / message_stop` | 高（需 adapter） |

> 直连 Moonshot 的 base URL 与模型 ID 本轮未独立核实；计划中以 OpenRouter 路径为 Kimi 的首发实现，直连列为后续待核项，不假装已验证。

## 3. 三个必须先定的决策

| # | 决策 | 建议 |
| --- | --- | --- |
| **D1** | 「让用户可以使用」= ①管理员在 env 配好多个 key，用户只选模型；②用户自带密钥 BYOK；③两者都要 | **先 ①，BYOK 作为独立阶段**；BYOK 需要真认证与安全存储，当前只有 dev cookie，无 DB |
| **D2** | Anthropic 的非 OpenAI SSE 怎么办 | **服务端归一化**：把 `content_block_delta` 转成 OpenAI `choices[0].delta.content` 再发给浏览器，客户端零改动。这是对 D-051「逐字节透传」的有意修订，须写入 INTEGRATION.md 并保留 OpenAI 兼容方的透传快路径 |
| **D3** | 模型选择存在哪里 | **全局 prefs**（`prefs.model = {provider,model}|null`）+ 每会话覆盖留到后续；避免动 `chat:v1` 契约。回落：未选 → 服务端 default |

## 4. 目标架构

```
浏览器  Composer 模型选择器 → prefs.model
   │  POST /api/ai | /api/ai/stream  {prompt, history?, provider?, model?}
   ▼
server/router.ts → ai-handler（认证/校验/错误分类不变）
   ▼
resolveProvider(catalog, request)  ← 白名单，拒绝任意 URL / 未配置 key
   ▼
server/ai/providers/
   openai-compatible.ts  (DeepSeek / OpenAI / OpenRouter / Kimi)
   anthropic.ts          (请求转换 + SSE→OpenAI SSE 归一化)
   ▼
上游（密钥只在服务端；错误统一映射到 AiErrorKind；scrub 全部 key）
```

### 4.1 配置（`server/config.ts`）

```ts
type ProviderConfig = {
  id: 'deepseek'|'openai'|'anthropic'|'openrouter'|'kimi';
  apiKey: string; baseUrl: string; models: string[]; timeoutMs: number;
};
type ServerConfig = { ...existing, providers: ProviderConfig[]; defaultProvider: string; defaultModel: string };
```

- **向后兼容硬要求**：`DEEPSEEK_*` 仍生成 `providers[0]`（id `deepseek`），`config.apiKey/baseUrl/model/timeoutMs` 保留别名——现有 `ai-checks.mjs`、e2e chat stub、`server/config.test.ts` 全部不改仍绿。
- 新变量：`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`OPENROUTER_API_KEY`、`KIMI_API_KEY`（+ 可选 `_BASE_URL` / `_MODELS`）。`*_MODELS` 是**允许列表**，不是任意模型。
- `*_BASE_URL` 只允许 https（本地 stub 例外由测试 env 注入，不进生产默认），防 SSRF/密钥外送。

### 4.2 Wire contract（`src/lib/ai.ts`）

| 变更 | 内容 |
| --- | --- |
| `AiStatusBody` | 保留 `configured/model`，新增 `default:{provider,model}`、`providers:[{id,label,models,configured}]`；`isAiStatusBody` 兼容旧形状（旧 payload 仍有效） |
| 请求体 | `POST /api/ai`、`/api/ai/stream` 增可选 `provider?:string`、`model?:string`；服务端按 catalog 白名单校验，非法 → `contract`；未配置 → `not_configured` |
| 应答 | `AiOk` 增可选 `provider`；`model` 保持字符串（UI 用 `provider/model` 展示由前端拼） |
| 错误 | 7 类不变；新增"所选 provider 未配置"归入 `not_configured`，401/403 仍 `unauthorized`、429 `rate_limited` |
| 新端点（可选） | `GET /api/ai/models` 动态拉 OpenRouter 模型列表——**首发不做**（见未决 3） |

### 4.3 前端

- `Composer.tsx`：删除硬编码 `MODELS`；从 `probe()` 的 `providers` 渲染分组（provider → models），可选真实切换；按钮显示 `provider/model`；未配置的 provider 置灰并说明「未配置」。
- `prefs.model` 写入 `src/lib/user.ts`（validated read 白名单：只接受 catalog 中存在的 `{provider,model}`；catalog 变化时回落 default）。
- `ask()` / `streamChat()` 携带 `{provider,model}`；`ask` 的 Overview 单问句面板沿用用户选择（或显式 default，见未决 4）。
- `meta.model` 改存 `provider/model`，旧记录兼容显示。

### 4.4 BYOK（阶段 5，需 D1 拍板）

- 用户填 key → **只发一次到服务端**（HTTPS），服务端按 session user 加密落盘（`server/profile/` 同款文件存储 + `AI_KEYS_SECRET` AES-GCM），**永不回传、不写日志、不进 localStorage**。
- 端点：`GET/PUT /api/ai/keys`（只回 `{provider, configured, last4?}`——建议连 last4 都不回）、`DELETE`。
- 前置条件：真认证（CHORD IdP）或至少明确「dev cookie 下 BYOK 只对本机有效」的诚实声明；多用户隔离由 `SessionUser.id` 在后端强制。
- 无 DB 时文件存储；DB 化时迁 `user_provider_keys` 表。

## 5. 安全（硬关卡）

1. 密钥只在服务端；status/模型目录/错误消息绝不回传 key、长度、前缀；`scrub()` 扩展到**所有** provider key。
2. provider / model / base URL 全部白名单；用户请求不得指定任意 endpoint（防 SSRF 与密钥转发）。
3. 每个请求沿用现有 `AI_TIMEOUT_MS`、prompt/history 上限、body 64 KB 上限；Anthropic 补 `max_tokens` 上限。
4. 客户端断开 → abort 上游（现有 `res.on('close')` 保留）。
5. provider 错误统一映射，不把上游原始 body 透给浏览器（现已 `readableDetail` + scrub）。
6. BYOK：加密落盘、按用户隔离、删除即抹除、不缓存到日志；未提供 `AI_KEYS_SECRET` 时 BYOK 端点返回 `not_configured`。
7. 不引入 SDK 依赖（保持 node:http/fetch），除非 Anthropic 流式归一化确有需要——优先自写最小转换。

## 6. 阶段与验收

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **P0** | 本计划 + 拍板 D1/D2/D3 + 核实 Kimi 直连文档 | 决策登记进 `docs/development/backend/OVERVIEW.md` |
| **P1** | config 多 provider + catalog + contract 扩展（`AiStatusBody`/请求体） | 旧 env 全部行为不变：`ai-checks.mjs`、`api-checks.mjs`、`ui-checks.mjs` chat 块全绿；`config.test.ts` 增多 env 用例 |
| **P2** | openai-compatible adapter：OpenAI / OpenRouter / Kimi(经 OpenRouter) / DeepSeek | stub upstream 验证各 base/headers/model；SSE 透传快路径不变；4 个 provider 的 200/401/429/500/garbage/hang 覆盖 |
| **P3** | anthropic adapter：请求转换 + SSE→OpenAI 归一化 | 单测覆盖 `message_start/content_block_delta/message_stop`、非文本块忽略、错误状态；客户端零改动仍能流式出字 |
| **P4** | 前端真实模型选择器 + `prefs.model` + meta 显示 | e2e：切 provider/model → stub 收到对应 header/path/model；刷新保持；未配置 provider 置灰 |
| **P5（可选）** | BYOK：keys 端点 + 加密文件存储 + UI 输入 | 401 隔离、key 永不回显、删除生效、`AI_KEYS_SECRET` 缺失时诚实失败 |
| **P6** | 文档：`INTEGRATION.md §1` 改写、`AI-PROVIDERS.md`（env/契约/限制/新增 provider 步骤）、AUDIT 决策、PROGRESS | 全量 tsc/vitest/build/e2e/ai-checks/api-checks 绿 |

**每阶段独立可回滚**：P1 保留旧字段别名，P2/P3 由 catalog 决定是否启用，P4 选择为空即回落 default。

## 7. 测试策略

- 单测：config（多 env / 旧 env / 坏 baseUrl）、provider 白名单校验、Anthropic 请求与 SSE 转换、错误分类表、`scrub` 多 key。
- 集成：`stream.integration.test.ts` 参数化 provider；`scripts/ai-checks.mjs` stub 按 env 切换上游路径与响应格式，新增 Anthropic 模式。
- e2e：`ui-checks.mjs` chat 块增模型切换断言；现有 stub（8799）继续模拟 DeepSeek，新增一个 Anthropic 形态 stub。
- 手动：有真 key 时各 provider 各发一条真实消息（不进 CI，不外发密钥）；记录延迟/错误形态。

## 8. 未决（不要偷偷假设）

1. **D1**：是否要 BYOK；若要，是否接受「IdP 未接入、dev cookie 下仅本机有效」的现实。
2. **D2**：确认「服务端归一化 Anthropic SSE」——会修订 D-051 的逐字节透传原则。
3. **模型目录**：静态 env 允许列表（建议首发） vs 动态 `/v1/models` 拉取（OpenRouter 500+ 模型、缓存与额度展示另议）。
4. **选择作用域**：全局 prefs vs 每会话；Overview 的 Ask 面板是否也跟随选择。
5. **优先级与默认**：首批提供方顺序（建议 DeepSeek → OpenAI → OpenRouter/Kimi → Anthropic）；无 key 时 UI 显示哪些。
6. **失败策略**：是否跨 provider 自动回退（建议首发**不**自动，避免账单与语义漂移）；是否展示价格/上下文窗口（建议不做）。
7. **Kimi 直连**：Moonshot 官方 base / 模型 ID 与鉴权细节待核；首发走 OpenRouter 路径。
