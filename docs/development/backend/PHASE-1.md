# Phase 1 — Backend Foundation

**状态：** 2026-11-13 **Phase 1 完成，P1-0 … P1-8 全部打勾**（P1-5 用 dev session、P1-6 用本地目录、P1-7 用双模式、P1-8 用全量验收）。真库 CLI / CHORD IdP verifier / S3 直传仍待外部条件，见 §5。
**上位：** [`ROADMAP.md`](ROADMAP.md) Phase 1。决策登记：`DECISIONS.md` D-055 / D-056 / D-057 / D-058。
**范围：** 数据库、API 层、认证与授权、文件存储、环境配置；核心数据模型 + 基本 CRUD。
**不做：** WAM、A2A、工具集执行、Agent 编排、知识图谱、计费。

---

## 0. 开工时的事实（2026-11-12）

| 项 | 值 | 出处 |
| --- | --- | --- |
| 后端 | 3 文件、3 端点，无数据库 / 鉴权 / 文件存储 | `server/`、`AUDIT.md:7-31` |
| 挂载 | `aiMiddleware(...)` 只在 dev + preview | `vite.config.ts:10` |
| 数据 | 11 个域存在浏览器版本化 envelope | `AUDIT.md:51-62` |
| 契约 | `AiBody` / `AiErr` / 7 种错误 / `statusFor()` | `src/lib/ai.ts` |
| 密钥 | `DEEPSEEK_*`，全进程只一个 reader | `server/config.ts`、`.env.example` |

下表是开工时的快照。P1-6 之后多出 `persistence/`、`routes/`、`session/`、`storage/`、`router.ts`、`http.ts` 与契约 `src/lib/{conversations,session,files}.ts`。

## 1. 开工前拍板（2026-11-12）

| # | 选什么 | 定稿 | 状态 |
| --- | --- | --- | --- |
| Q1 | 数据库 + 迁移工具 | **PostgreSQL + Drizzle**；迁移脚本即表结构准绳 | 已定 |
| Q2 | 挂 3 个端点的服务（Q-2） | **独立 Node 服务**；`server/` 3 个 handler 抽出来复用，dev 仍走 Vite 代理 | 已定 |
| Q3 | 认证 | **CHORD IdP**；Thylas 只持 session cookie，不做密码流程（`tech-stack.md:401-403`） | 已定 |
| Q4 | 文件上传 | N3 签名直传 / 5GB、N4 文件夹归 Thylas | **已按 D-057 偏离**：本地目录、100MB、不建 folders 表 |
| Q5 | 环境配置 | 继续扩 `server/config.ts`，保持一个 reader | 已定 |

## 2. 单元

| 单元 | 落盘 | 做什么 | 验收 | 依赖 |
| --- | --- | --- | --- | --- |
| P1-0 ✓ | `DECISIONS.md` D-055 | 把三项拍板登记为 D-055 | 三行各写一个选择，不留 `[?]` | — |
| P1-1 ✓ | `server/` + 服务入口 | 把 `ai.ts` 的 handler 从 Vite Plugin 抽出，同一份给 Vite 和独立 Node 服务用 | `npm run dev` 与部署实例都答得出 `/api/ai/status` | P1-0 |
| P1-2 ✓ | `server/config.ts`、`.env.example` | 加 Postgres / 存储 / session 变量 | 仍只有一个 reader；密钥不带 `VITE_` | P1-0 |
| P1-3 ✓ | `server/persistence/` | Drizzle 第一张表 + 迁移脚本，表结构对齐 11 个域 | 空库跑迁移成功；重复跑不炸 | P1-1, P1-2 |
| P1-4 ✓ | `src/lib/conversations.ts`、`server/routes/conversations.ts` | 一个域的完整 CRUD；server 和 src import 同一个契约文件 | 改字段在另一侧编译报错；失败仍返回 `kind` / `message` / `retryable` | P1-3 |
| P1-5 ✓ | `src/lib/session.ts`、`server/session/` | 可替换的 session 来源、`GET /api/session`、写操作在服务端校验 | 未登录 401；非成员 403，不是空列表。真 IdP verifier 仍待 | P1-1, D-056 |
| P1-6 ✓ | [`P1-6.md`](P1-6.md)、`src/lib/files.ts`、`server/{storage,routes/files}.ts` | 本地目录存字节、`files` 表与 5 个端点，只做后端 | 上传后刷新列表还在；直传顺延（D-057） | P1-1, P1-3, P1-5 |
| P1-7 ✓ | [`P1-7.md`](P1-7.md)、`src/lib/chat.ts`、`server/routes/chat.ts` | 双模式：默认本地行为不变，api 模式复用两表 + 乐观 commit | UI 零 diff；旧 envelope 导入不丢数据（D-058） | P1-4, P1-5 |
| P1-8 ✓ | `AUDIT.md` 重写、`docs/README.md` 索引 | 真实 HTTP 集成测试 + 全量验收 + 过期文档清点 | `check` / `test` / `api:check` / `e2e` 全绿（302/302） | P1-7 |

### 完成记录（11-12 ~ 11-13）

- P1-0：`DECISIONS.md` D-055，三项拍板、备选与否决理由齐全。
- P1-1：`server/ai-handler.ts` 是 3 个端点的唯一实现；`server/ai.ts` 只剩 Vite 适配；`server/index.ts` 是独立 `node:http` 服务，`npm run api` 默认 8787。
- P1-2：`server/config.ts` 收纳 `PORT` / `DATABASE_URL` / `STORAGE_BUCKET` / `CHORD_ISSUER`；`server/index.ts` 不再直接读 `process.env.PORT`，唯一 reader 成立；新增 `server/config.test.ts` 5 个测试，`vitest.config.ts` 纳入 `server/`。
- P1-3：`server/persistence/schema.ts` 定 `conversations` / `messages` 两表（chat first），注释列出 11 个 envelope → 表的映射；`npm run db:generate` 生成 `0000_tired_exodus.sql`（2 表 / 2 索引 / 1 外键）；`migrate.test.ts` 用嵌入式 Postgres 空库跑两次迁移并写入一条消息；重复 generate 报 `No schema changes`。
- P1-4：`src/lib/conversations.ts` 是唯一契约；`server/routes/conversations.ts` 实现 5 个操作；`server/router.ts` 把 AI 与 conversations 合成一个路由；`server/http.ts` 收 `sendJson` / `readBody`；`server/persistence/client.ts` 是唯一建连处。
- P1-5：`D-056` 定下一个可替换的 `SessionSource`。`src/lib/session.ts` 是契约；`server/session/source.ts` 无 `CHORD_ISSUER` 时读 dev cookie `dev:<userId>:<workspaceIds>`，配了 issuer 则 `pending-idp` 直接 401（fail closed）；`server/session/handler.ts` 提供 `GET /api/session`；conversations 改成 session → membership → write，非成员 403 而非空列表。
- P1-6：`D-057` 定本地目录存储。`src/lib/files.ts` 契约；`server/http.ts` 加 `pipeBodyToFile()`（流式、100MB、超限 413 且删半成品、EEXIST 不删别人的文件）；`server/storage/local.ts` 防路径穿越；`schema.ts` 加 `files` 表 + `0001_classy_bedlam.sql`；`server/routes/files.ts` 5 个端点（上传 / 列表 / 元数据 / 下载 / 软删）复用 401 / 403；`config.ts` 加 `STORAGE_DIR`；`.gitignore` 忽略 `.tmp/`；`Files.tsx:184,208` 文案改为「服务在跑，UI 未接线」；`file-plan.md` 头部加 D-057 过期注记。
- P1-7：`D-058` 定双模式与单一契约。`src/lib/chat.ts` 是唯一契约，`src/state/chat.ts` 改为 import + re-export（UI 文件零 diff、`chat.test.ts` 原样通过）；`0002_windy_exiles.sql` 给 conversations 加 `context` / `sync_version`、messages 加 `at_ms` / `meta` / `error` 并把 `blocks` 换成 4 种 `kind` 联合；`server/http.ts` 加 `readJsonBody()`（8MB）；`server/routes/chat.ts` 的 `GET|PUT /api/chat/state` 复用两表、401 → 403 → 写、409 版本冲突、事务 upsert、旧 `{type}` blocks 读时归一化；`src/services/chat/client.ts` + 4 测试；`src/state/chat.ts` 默认 `VITE_CHAT_SOURCE=local` 逐字节不变，`api` 乐观 commit + 300ms 节流 + finish 立即 flush + 旧 envelope 一次性导入（写 `thylas:chat:migrated:v1`、不清本地）。`activeId` / `dock` 留本地。
- 序号 1、2（附加）：`scripts/api-checks.mjs` + `npm run api:check`；`src/services/conversations/client.ts` + 6 个测试，契约有了前端消费方。
- 依赖：`drizzle-orm` 0.45.4 / `pg` 8.23.1 / `drizzle-kit` 0.31.11 / `@electric-sql/pglite` 0.5.16 / `@types/pg` 8.23.1；`package.json` 加 `db:generate` / `db:migrate` / `api:check`。`npm audit` 报 13 个 moderate，未自动修。
- 配套：`tsconfig.json` 纳入 `server` 与 `drizzle.config.ts`、允许 `.ts` 扩展名；`.env.example`、`server/README.md` 写明启动、持久化、API、session 与 files；新变量均无 `VITE_` 前缀。
- P1-8：`AUDIT.md` 按运行中的代码重写（9 节：文件清单 23 个 `.ts`、7 路径 / 16 操作、3 表 / 3 迁移、401→403→503 的真实响应、11-13 验收数字、9 处旧结论逐条列到行号，其中 3 处已就地更正）；`docs/README.md` 阅读顺序加 `development/backend/` 第 15 项，§5 的「没有后端 / 没有数据库」两行就地更正；`ROADMAP.md` 状态行改到 P1-8；`server/README.md` 头部与文件表更新到 3 表 / 3 域路由。`server/`、`src/` 代码零改动。
- 证据：`npm run check` 通过；`npx eslint server src/lib/{files,session,chat}*` 无输出；`npm run test` 44 文件 / 379 全绿；`npm run api:check` 14 项全绿（3 条 AI 路径、Vite SPA 200、404 / 400 `contract`、401 `unauthorized`、503 `not_configured`、`/api/session` 401 与 flags、files / chat state 的 401 与 503）；`npm run e2e` 302/302 全绿；`db:generate` 第二次 `No schema changes`；`git diff --name-only src/pages/chat` 为空。全量 `npm run lint` 仍有 2 个既有 error（`AppShell.tsx:7`、`CoworkerDetail.tsx:37`），与后端无关。

## 3. 硬约束

- 目录随第一个真文件出现，不预建 `persistence/` `routes/` `wam/`（`OVERVIEW.md:14`）。
- `routes/<domain>.ts` 在该 API 出现第二个端点时才建（`OVERVIEW.md:33`）；`/api/session` 只有一个端点，所以留在 `server/session/handler.ts`。
- 契约只放 `src/lib/`；禁 `utils/` `helpers/` `common/`（`OVERVIEW.md:38-39`）。
- `server/wam/` 不建；WAM 只留在 `INTEGRATION.md` 的文字里。
- 按域迁移，chat 先（`INTEGRATION.md:31`）。
- UI 不重写：`src/state/*` 保留 envelope 形状，只换读写来源（`OVERVIEW.md:64-66`）。
- 一个概念只有浏览器之外需要它时才搬到服务端（`DOMAIN-MODELS.md:78-80`）。
- 授权在写操作处检查（B1）；界面只读服务端返回的成员标记，不自己算。
- 模拟诚实：UI 上做不到的功能要写明原因，不能声称服务不存在。

## 4. 与 Phase 2 的界线

Phase 1 只建表、迁移、一个域的 CRUD 链路。User / Workspace / Coworker / Artifact 四个对象的创建、编辑、查询、归档和成员权限，留给 Phase 2。

## 5. P1-8 结果与真库前置

- **P1-8 已验收**：`check` / `test` / `api:check` / `e2e` 全绿，`AUDIT.md` 已重写。真库、IdP、S3 三条仍未验，均不是代码缺口。
- **真库 CLI 未验**：Docker daemon 未运行，启动命令被沙箱拦下。用户启动 Docker Desktop 后跑 `npm run db:migrate`（`DATABASE_URL` 指向容器）即可补上。迁移 SQL 与 CRUD 已在嵌入式 Postgres 中跑通。
- **P1-7 已定双模式**：`VITE_CHAT_SOURCE=local|api`，默认 `local` 不需要真库；`api` 模式真联调仍需 `DATABASE_URL`（`P1-7.md` §8）。
- **CHORD IdP verifier 未接**：401 / 403 已用 dev cookie 验收；拿到 issuer 与 cookie 格式后只换 `server/session/source.ts` 一处。dev cookie 绝不能进有 issuer 的部署。
- **S3 presigned URL 未实现**：接的时候只换 `server/storage/local.ts`（D-057）。

## 6. 待完善

- `docs/README.md` 已索引 `backend/`（11-13 阅读顺序第 15 项）；§5 第 4/5 行的「无后端 / 无数据库」已就地更正。
- `file-plan.md:390`、`roadmap.md:107` 仍写「条件性单文件 `server/index.ts`」；`file-plan.md` 头部的 signed-URL 描述已加 D-057 注记。
- Q-2 两处状态不一致；Q2 拍板后要统一成「独立 Node 服务」。
- `tech-stack.md:24,42` 仍写 "no server runtime"，与 Q2 冲突。
- `application.md:288`（N2）仍列未答；Q3 采用其默认，真 IdP verifier 待接。
- `AUDIT.md` 已在 P1-8 重写（11-13），逐条核到行号；§8 列出仍写着旧结论的 9 处文档，3 处已更正。

---

## 7. 下一步计划（2026-11-12 22:50 制定，11-13 更新）

**语言复核（11-12 快照）**：后端保持 TypeScript / Node，不切换 Python。当时 9 个实现文件 1090 行、292 行共享契约、323 个测试已跑通；换语言要重做 Phase 1 五个单元，而这套后端只做读环境、校验 JSON、SSE 透传、几条 SQL，用不到 Python 生态。

### 三条外部阻塞

| 阻塞 | 谁解 | 具体动作 |
| --- | --- | --- |
| Docker daemon 未运行 | 用户 | 启动 Docker Desktop → 起 postgres 容器 → `DATABASE_URL=… npm run db:migrate`，再跑一次确认不炸 |
| CHORD IdP verifier 未接 | 外部 | 拿到 issuer 与 session cookie 格式；401 / 403 已用 dev cookie 验收，接 IdP 只换一个模块 |
| S3 / R2 未接 | 用户 | 决定后实现 presigned URL；`server/storage/local.ts` 是唯一替换点 |

### 执行顺序

| 序 | 单元 | 落盘 | 验收 | 阻塞 |
| --- | --- | --- | --- | --- |
| 1 ✓ | 固化 API 回归脚本 | `scripts/api-checks.mjs` + `npm run api:check` | 一条命令验 3 条 AI 路径、Vite SPA 200、503 / 404 / 400 | 无 |
| 2 ✓ | 客户端契约调用层 | `src/services/conversations/client.ts` + 测试 | 前端有真实调用方；改契约字段两侧编译报错 | 无 |
| 3 | 真库迁移验证 | 无新文件 | 真库三张表存在，第二次 migrate 不炸 | Docker |
| 4 ✓ | P1-5 会话与权限 | `src/lib/session.ts`、`server/session/` | 未登录 401；非成员 403 而非空列表（D-056） | 已降级完成 |
| 5 ✓ | [P1-6 上传](P1-6.md) | `P1-6.md` §3 | 上传后刷新列表还在；直传顺延（D-057） | 无 |
| 6 ✓ | [P1-7 chat 换读写来源](P1-7.md) | `P1-7.md` §3 | UI 零 diff；旧 envelope 导入不丢数据（D-058） | 无（双模式，默认本地） |
| 7 ✓ | P1-8 收尾 | `AUDIT.md` 重写 + `docs/README.md` 索引 + e2e | `check` / `test` / `api:check` / `e2e` 全绿（302/302） | 1–6 |

### 完成记录

- 11-12 23:30 序号 1、2；11-13 09:20 序号 4（P1-5，`D-056`，36 文件 / 340 测试、10 项 `api:check`）。
- 11-13 10:20 序号 5（P1-6，`D-057`）：`files` 表 + `0001` 迁移、`src/lib/files.ts`、`server/storage/local.ts`、`server/routes/files.ts` 5 端点、`pipeBodyToFile()`、UI 文案与 `file-plan.md` 注记。40 文件 / 359 测试、12 项 `api:check` 全绿。
- 11-13 10:55 序号 6（P1-7，`D-058`）：`src/lib/chat.ts` 契约、`0002` 迁移、`GET|PUT /api/chat/state`、双模式 store 与旧 envelope 导入。44 文件 / 379 测试、14 项 `api:check` 全绿，UI 零 diff。
- 11-13 18:05 序号 7（P1-8）：`AUDIT.md` 全文重写、`docs/README.md` 加索引并更正两行、`ROADMAP.md` 状态行更新。`check` / 44 文件 379 测试 / 14 项 `api:check` / 302 项 `e2e` 全绿；代码零改动。

### IdP 不就绪时的降级（已执行）

P1-5 先做会话接口与服务端成员标记，session 来源单独放一个模块；401 / 403 用本地 dev cookie 验，等 IdP 接上只换来源，不重写路由。配了 `CHORD_ISSUER` 时 fail closed。

### 下一步一句话

序号 1、2、4、5、6、7 已完成，Phase 1 收尾。只剩序号 3 的真库迁移验证（需 Docker Desktop），以及 CHORD IdP verifier、S3 直传两个外部接入；三者都是替换一个模块，不是重写。下一步是 Phase 2 的四个实体（User / Workspace / Coworker / Artifact），见 `ROADMAP.md:16-17`。
