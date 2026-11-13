# Profile Initialization Pipeline — audit & plan

**Date:** 2026-11-13 · 入口：User 页 · 状态：**Phase 1–6 已实施**（实现记录见 [IMPLEMENTATION.md](IMPLEMENTATION.md)）

## Phase 1 — audit（逐项核实，未假设）

| 检查项 | 事实 | 证据 |
| --- | --- | --- |
| 开发指令 / 架构 | `AGENT.md`、`docs/development/backend/`、`docs/product/definition.md`（WAM 边界）、D-055 | — |
| 后端架构 | `server/index.ts` 独立 node:http host + `server/router.ts` 一个路由表（Vite plugin 与 host 共用）；`server/http.ts` 有 `readBody`（64 KB 上限）、`sendJson` | D-055 / P1-1 |
| DB | drizzle + Postgres（`server/persistence/schema.ts` 仅 conversations/messages/files）；`createDb()` 在 `DATABASE_URL` 为空时返回 **null**，DB routes 回答 503 | `client.ts` |
| `.env.local` | `DEEPSEEK_API_KEY` ✓ 已配置；**`DATABASE_URL` 未配置** | 环境检查（未读值） |
| 认证 | `server/session/source.ts`：**dev cookie** `thylas_session=dev:<userId>:<wsIds>` 是显式 stand-in；配置 `CHORD_ISSUER` 时 fail-closed 401。IdP 未接入 | P1-5 |
| 授权惯例 | routes 顺序：session(401) → membership(403) → write；后端执行，不靠前端隐藏 | `conversations.ts` 头部 |
| User Profile 模型 | **仅客户端** `src/state/user.ts`（`displayName` + prefs，key `thylas:user:v1`）；`users` 表在 schema 注释中标 Phase 2，**未建** | — |
| User 页 | `src/pages/user/UserPage.tsx`（identity/prefs/sections + 导航）；身份来自 `USER` seed，命名「not connected」 | — |
| AI 集成 | `server/ai-handler.ts` 的 `/api/ai`（DeepSeek `stream:false`，服务端持密钥，7 类 typed error）；无 URL fetch / search / web extraction | — |
| 存储 | `server/storage/local.ts` 按 `<root>/<wsId>/<fileId>` 存字节，`isSafeSegment` 校验 | P1-6 |
| 测试 | 服务端 route 单测（pglite / 临时目录）+ `scripts/ui-checks.mjs`（CDP e2e，302→310 断言） | — |

**可复用**：wire contract in `src/lib/*`、`readBody/sendJson`、session source、`ServerConfig`、ai-handler 的 DeepSeek 调用模式、文件存储惯例、typed failure 形状。
**缺失**：URL 抓取/正文提取、结构化抽取、profile 域的持久化与 API、User Profile 服务端表示。

## Phase 2 — 计划（含未决决策的处置）

### 关键环境冲突与决定

任务要求「真实后端、用户隔离在后端强制、不用 mock 假装完成」，但**当前环境无 `DATABASE_URL`**，现有 DB routes 一律 503；创建第四套 DB 表会让 User 页流程在本机完全不可用。

**决定 [C]**：Profile 域采用 **服务端文件持久化**（per-user JSON，`server/profile/store.ts`），route 层按 `SessionUser.id` 强制隔离与授权；不动 `createDb()` 的 503 语义，不引入第二套 DB 连接。它是真实服务端状态（非浏览器 mock），可审计、可迁移；表结构与迁移作为未来 DB 化工作写入「未决」。
**认证现实 [C]**：dev cookie 是既有显式 stand-in（P1-5），文档明确「IdP 未接入」；不伪造 auth。
**联网现实 [C]**：仅本机 e2e 无法访问外网；完整管线由 route 单测的注入 fetcher/extractor 覆盖，外网抓取的真实可用性由用户手动验证。

### 数据流（6 阶段）

```
User 页 → 入口 → /user/profile（5 步）
  A 提交源（类型+URL，显式授权，可删除）
  B POST discover → 服务端逐源 fetch（SSRF 防护）→ 正文提取 → 记录 retrievedAt/失败原因
  C 抽取 → DeepSeek 结构化 JSON（category/content/evidence/type/confidence/status）
  D 候选入临时区（pending）→ 逐条 accept/edit/reject、批量、证据/来源/时间/置信度
  E commit → 仅 accepted 写入 User Profile（保留来源+元数据+confirm 人/时，去重，幂等）
  F 再次发现 → 与既有 records 比对 → updates/conflicts 仅供审阅，不覆盖
```

### API（`src/lib/profile.ts` 共享契约）

| 方法/路径 | 作用 |
| --- | --- |
| `GET /api/profile/state` | session + sources + candidates + records + history + overview |
| `POST /api/profile/sources` | 添加源（校验 URL/类型，去重） |
| `DELETE /api/profile/sources/:id` | 移除未完成源 |
| `POST /api/profile/discover` | 逐源 fetch + 抽取；单源失败不影响其它；可重试 |
| `PATCH /api/profile/candidates/:id` | accept / edit / reject（edit 保留用户确认为准） |
| `POST /api/profile/commit` | accepted → records + overview；幂等 |
| `POST /api/profile/reset` | 取消会话（保留已确认 records） |

### 数据实体（文件内，最少）

`source`（id/type/url/status/retrievedAt/error）；`candidate`（id/sourceId/url/category/content/evidence/type/confidence/status/editedContent/discoveredAt/confirmedAt/confirmedBy）；`record`（id/key(内容规范键)/content/category/sourceUrl/evidence/discoveredAt/confirmedAt/confirmedBy/state）；`history`（recordId/from/to/at/by）；`session`（id/stage/createdAt/updatedAt）。

时间语义分离：`createdAt`（记录产生）/ `discoveredAt`（抓取时刻）/ `updatedAt`（修改）/ `confirmedAt`（用户确认）——互不代替。状态：pending/active/outdated/archived。

### 安全

- URL：仅 http/https；DNS 解析后拒绝私网/回环/链路本地/元数据地址；重定向逐跳校验；超时 8s；响应 ≤512 KB；只取 text/html 与纯文本。
- 内容：去 script/style/nav/footer/重复行，HTML 实体解码，裁剪 ≤12k 字符；作为**不可信数据**送 LLM（prompt 明确忽略页面内指令）。
- 密钥仅服务端；`Authorization` 不转发；LinkedIn 等受限平台不声明支持（返回 typed `unsupported`）。

### 前端（User 页启动）

`/user/profile` 五步：欢迎 → 添加源 → 发现中（**真实逐源状态，无假进度**）→ 审阅候选 → 完成。可跳过/推迟。审阅界面优先：来源、证据、Explicit/Inferred、时间、置信度、单条/批量操作、编辑。复用 `artifacts.module.css` 行/表单语法。

### 测试

- 单测：SSRF 判定（纯函数，不触网）、store（隔离/去重/历史/幂等）、extract（stub LLM + 校验）、route（注入 fetcher/extractor 的完整 6 阶段 + 401 + 部分失败）。
- e2e：入口、源校验、空态、跳过、错误态；完整抽取流程不在 CDP 中打外网。

### 未决（不偷偷假设）

1. DB 化（users/profile_* 表 + migration）——需要 `DATABASE_URL` 与用户表；本期文件存储先跑通。
2. IdP 真认证——CHORD 未接入，dev cookie 显式 stand-in。
3. LinkedIn / 受限平台——直接抓取不做；可否接受用户导出文件，待定。
4. 「敏感个人信息」白名单——MVP 策略：prompt 禁止抽取联系方式/证件/健康等；用户显式要求时的授权 UI 待定。
5. 候选置信度语义——模型自报的启发式值，不是概率校准；UI 标「模型自评」。
