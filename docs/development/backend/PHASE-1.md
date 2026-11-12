# Phase 1 — Backend Foundation

**状态：** 2026-11-12 规划已定；P1-0 / P1-1 / P1-2 完成，P1-3 起未开工。
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

下表是开工时的快照。P1-2 之后 `server/` 是 6 个文件。

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
| P1-3 | `server/persistence/` | Drizzle 第一张表 + 迁移脚本，表结构对齐 11 个域 | 空库跑迁移成功；重复跑不炸 | P1-1, P1-2 |
| P1-4 | `src/lib/<domain>.ts`、`server/routes/<domain>.ts` | 一个域的完整 CRUD；server 和 src import 同一个契约文件 | 改字段在另一侧编译报错；失败仍返回 `kind` / `message` / `retryable` | P1-3 |
| P1-5 | `server/` 会话模块 | 接 CHORD session cookie；服务端返回成员标记；写操作在服务端校验 | 未登录 401；非成员 403，不是空列表 | P1-1, IdP 就绪 |
| P1-6 | 上传与元数据 | 按 Q4 默认实现，文件夹归 Thylas | 上传后刷新列表还在；大文件走直传 | P1-1, P1-3 |
| P1-7 | `src/state/chat.ts` | 第一个域把 localStorage 换成 API 调用，`read()` 接口不变 | UI 代码零改动；旧 envelope 导入不丢数据 | P1-4, P1-5 |
| P1-8 | 测试与文档 | 真实 HTTP 集成测试；更新 `AUDIT.md` | `check` / `test` / `e2e` 全绿 | P1-7 |

### 完成记录（11-12）

- P1-0：`DECISIONS.md` D-055，三项拍板、备选与否决理由齐全。
- P1-1：`server/ai-handler.ts` 是 3 个端点的唯一实现；`server/ai.ts` 只剩 Vite 适配；`server/index.ts` 是独立 `node:http` 服务，`npm run api` 默认 8787。
- P1-2：`server/config.ts` 收纳 `PORT` / `DATABASE_URL` / `STORAGE_BUCKET` / `CHORD_ISSUER`；`server/index.ts` 不再直接读 `process.env.PORT`，唯一 reader 成立；新增 `server/config.test.ts` 5 个测试，`vitest.config.ts` 纳入 `server/`。
- 配套：`package.json` 加 `api` script；`tsconfig.json` 纳入 `server` 并允许 `.ts` 扩展名；`.env.example`、`server/README.md` 写明启动方式；新变量均无 `VITE_` 前缀。
- 证据：`npm run check` 通过；`npx eslint server` 无输出；`npm run test` 30 文件 / 314 测试全绿；独立服务（8787）、`PORT=8899` 覆盖、Vite dev 三条路径都答 `{"configured":true,"model":"deepseek-chat"}`；未知路径 404、空 prompt 400 `contract`。

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

## 5. P1-3 前置

- Docker 29.1.5 可用；npm registry 可达（`drizzle-orm` 0.45.4）。
- 需要新增 `drizzle-orm` / `drizzle-kit` / `pg`，并起一个本地 Postgres 容器跑迁移。
- 这两步会改 `package-lock.json`、拉镜像，属于有副作用的操作，等一句「继续」再做。

## 6. 待完善

- `docs/README.md` 未索引 `backend/`。
- `file-plan.md:390`、`roadmap.md:107` 仍写「条件性单文件 `server/index.ts`」。
- Q-2 两处状态不一致；Q2 拍板后要统一成「独立 Node 服务」。
- `tech-stack.md:24,42` 仍写 "no server runtime"，与 Q2 冲突。
- `application.md:288`（N2）仍列未答；Q3 采用其默认，P1-5 卡在 CHORD IdP 就绪。
- `AUDIT.md` 已加过期注记，主体仍是 11-11 快照，P1-8 重写。
