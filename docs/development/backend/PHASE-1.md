# Phase 1 — Backend Foundation

**状态：** 2026-11-12 规划已定；P1-0 … P1-4 完成，P1-5 起未开工。
**上位：** [`ROADMAP.md`](ROADMAP.md) Phase 1。决策登记：`DECISIONS.md` D-055。
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

下表是开工时的快照。P1-4 之后多出 `persistence/`、`routes/`、`router.ts`、`http.ts` 与契约 `src/lib/conversations.ts`。

## 1. 开工前拍板（2026-11-12）

| # | 选什么 | 定稿 | 状态 |
| --- | --- | --- | --- |
| Q1 | 数据库 + 迁移工具 | **PostgreSQL + Drizzle**；迁移脚本即表结构准绳 | 已定 |
| Q2 | 挂 3 个端点的服务（Q-2） | **独立 Node 服务**；`server/` 3 个 handler 抽出来复用，dev 仍走 Vite 代理 | 已定 |
| Q3 | 认证 | **CHORD IdP**；Thylas 只持 session cookie，不做密码流程（`tech-stack.md:401-403`） | 已定 |
| Q4 | 文件上传 | N3 默认签名直传、100MB 走 API 兜底；N4 默认文件夹归 Thylas | 有默认 |
| Q5 | 环境配置 | 继续扩 `server/config.ts`，保持一个 reader | 已定 |

## 2. 单元

| 单元 | 落盘 | 做什么 | 验收 | 依赖 |
| --- | --- | --- | --- | --- |
| P1-0 ✓ | `DECISIONS.md` D-055 | 把三项拍板登记为 D-055 | 三行各写一个选择，不留 `[?]` | — |
| P1-1 ✓ | `server/` + 服务入口 | 把 `ai.ts` 的 handler 从 Vite Plugin 抽出，同一份给 Vite 和独立 Node 服务用 | `npm run dev` 与部署实例都答得出 `/api/ai/status` | P1-0 |
| P1-2 ✓ | `server/config.ts`、`.env.example` | 加 Postgres / 存储 / session 变量 | 仍只有一个 reader；密钥不带 `VITE_` | P1-0 |
| P1-3 ✓ | `server/persistence/` | Drizzle 第一张表 + 迁移脚本，表结构对齐 11 个域 | 空库跑迁移成功；重复跑不炸 | P1-1, P1-2 |
| P1-4 ✓ | `src/lib/conversations.ts`、`server/routes/conversations.ts` | 一个域的完整 CRUD；server 和 src import 同一个契约文件 | 改字段在另一侧编译报错；失败仍返回 `kind` / `message` / `retryable` | P1-3 |
| P1-5 | `server/` 会话模块 | 接 CHORD session cookie；服务端返回成员标记；写操作在服务端校验 | 未登录 401；非成员 403，不是空列表 | P1-1, IdP 就绪 |
| P1-6 | 上传与元数据 | 按 Q4 默认实现，文件夹归 Thylas | 上传后刷新列表还在；大文件走直传 | P1-1, P1-3 |
| P1-7 | `src/state/chat.ts` | 第一个域把 localStorage 换成 API 调用，`read()` 接口不变 | UI 代码零改动；旧 envelope 导入不丢数据 | P1-4, P1-5 |
| P1-8 | 测试与文档 | 真实 HTTP 集成测试；更新 `AUDIT.md` | `check` / `test` / `e2e` 全绿 | P1-7 |

### 完成记录（11-12）

- P1-0：`DECISIONS.md` D-055，三项拍板、备选与否决理由齐全。
- P1-1：`server/ai-handler.ts` 是 3 个端点的唯一实现；`server/ai.ts` 只剩 Vite 适配；`server/index.ts` 是独立 `node:http` 服务，`npm run api` 默认 8787。
- P1-2：`server/config.ts` 收纳 `PORT` / `DATABASE_URL` / `STORAGE_BUCKET` / `CHORD_ISSUER`；`server/index.ts` 不再直接读 `process.env.PORT`，唯一 reader 成立；新增 `server/config.test.ts` 5 个测试，`vitest.config.ts` 纳入 `server/`。
- P1-3：`server/persistence/schema.ts` 定 `conversations` / `messages` 两表（chat first），注释列出 11 个 envelope → 表的映射；`npm run db:generate` 生成 `0000_tired_exodus.sql`（2 表 / 2 索引 / 1 外键）；`migrate.test.ts` 用嵌入式 Postgres 空库跑两次迁移并写入一条消息；重复 generate 报 `No schema changes`。
- P1-4：`src/lib/conversations.ts` 是唯一契约（DTO、请求校验、4 种错误、`statusForConversation()`）；`server/routes/conversations.ts` 实现 `GET|POST /api/conversations` 与 `GET|PATCH|DELETE /api/conversations/:id`；`server/router.ts` 把 AI 与 conversations 合成一个路由，Vite 插件和独立服务共用；`server/http.ts` 收 `sendJson` / `readBody`；`server/persistence/client.ts` 是唯一建连处。无 `DATABASE_URL` 时 CRUD 答 503 `not_configured`，AI 端点照常。
- 依赖：`drizzle-orm` 0.45.4 / `pg` 8.23.1 / `drizzle-kit` 0.31.11 / `@electric-sql/pglite` 0.5.16 / `@types/pg` 8.23.1；`package.json` 加 `db:generate` / `db:migrate`。`npm audit` 报 13 个 moderate，未自动修。
- 配套：`tsconfig.json` 纳入 `server` 与 `drizzle.config.ts`、允许 `.ts` 扩展名；`.env.example`、`server/README.md` 写明启动、持久化与 API；新变量均无 `VITE_` 前缀。
- 证据：`npm run check` 通过；`npx eslint server src/lib/conversations* drizzle.config.ts` 无输出；`npm run test` 33 文件 / 323 测试全绿（`conversations.test.ts` 3 个真实 HTTP 用例走完整 CRUD）；独立服务（8787）、`PORT=8899`、Vite dev 三条路径都答 `{"configured":true,"model":"deepseek-chat"}`；Vite dev 的 `/` 仍返回 200 HTML；未知路径 404、空 prompt 400 `contract`、无库时 conversations 503 `not_configured`。

## 3. 硬约束

- 目录随第一个真文件出现，不预建 `persistence/` `routes/` `wam/`（`OVERVIEW.md:14`）。
- `routes/<domain>.ts` 在该 API 出现第二个端点时才建（`OVERVIEW.md:33`）。
- 契约只放 `src/lib/`；禁 `utils/` `helpers/` `common/`（`OVERVIEW.md:38-39`）。
- `server/wam/` 不建；WAM 只留在 `INTEGRATION.md` 的文字里。
- 按域迁移，chat 先（`INTEGRATION.md:31`）。
- UI 不重写：`src/state/*` 保留 envelope 形状，只换读写来源（`OVERVIEW.md:64-66`）。
- 一个概念只有浏览器之外需要它时才搬到服务端（`DOMAIN-MODELS.md:78-80`）。

## 4. 与 Phase 2 的界线

Phase 1 只建表、迁移、一个域的 CRUD 链路。User / Workspace / Coworker / Artifact 四个对象的创建、编辑、查询、归档和成员权限，留给 Phase 2。

## 5. P1-5 前置

- **真库 CLI 未验**：Docker daemon 未运行，启动命令被沙箱拦下。用户启动 Docker Desktop 后跑 `npm run db:migrate`（`DATABASE_URL` 指向容器）即可补上。迁移 SQL 与 CRUD 已在嵌入式 Postgres 中跑通。
- **CHORD IdP 未就绪**：P1-5 的 401 / 403 验收卡在 IdP，可先做会话接口与服务端成员标记，最后再接真实登录。
- 契约的客户端消费方目前是 `src/lib/conversations.test.ts`；真正的 UI 调用在 P1-7 换 `src/state/chat.ts` 读写来源时落地。

## 6. 待完善

- `docs/README.md` 未索引 `backend/`。
- `file-plan.md:390`、`roadmap.md:107` 仍写「条件性单文件 `server/index.ts`」。
- Q-2 两处状态不一致；Q2 拍板后要统一成「独立 Node 服务」。
- `tech-stack.md:24,42` 仍写 "no server runtime"，与 Q2 冲突。
- `application.md:288`（N2）仍列未答；Q3 采用其默认，P1-5 卡在 CHORD IdP 就绪。
- `AUDIT.md` 已加过期注记，主体仍是 11-11 快照，P1-8 重写。
