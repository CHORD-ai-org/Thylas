# Phase 2 — User Module 实施规划

**状态：** 2026-11-13 初稿。规格见 [`PHASE-2-USER.md`](PHASE-2-USER.md)。
**原则：** 一次只开一个特性；不静默拍板 Q1–Q7；不用 mock 冒充后端完成。
**本轮范围：** 文档 + A0（共享契约），不碰 DB、不碰 UI、不改现有行为。

---

## 1. Category A — 简单、可独立实现

### 1.1 逐条验证任务书给的候选

| 候选 | 判定 | 依据 |
| --- | --- | --- |
| Basic Identity CRUD | **拆分** | username / email / accountId 归 IdP（External）；只有 displayName 是 Thylas Core，且本地已实现 |
| Display Name 管理 | **可** | `src/state/user.ts:setDisplayName` 已跑通；服务端持久化是 A1 |
| Avatar 管理 | **不可** | 无 avatar service；`UserPage.tsx` 的按钮 disabled 写明「Avatars would live with the identity provider」 |
| Basic Preferences 持久化 | **可，A2 未开工** | 三项本地已真实持久化；服务端位置由 D-059 定为同一份 per-user 文件 |
| Theme / Language 偏好 | **不可** | 只有 Paper 一套 palette，v1 English-only；加开关就是假开关 |
| Basic Profile Record CRUD | **可，但改现有端点** | 记录已由 `/api/profile/state` 返回；应扩展 `/api/profile/*`，不新建第二套端点族 |
| Profile category 管理 | **已存在** | `PROFILE_CATEGORIES` 固定 6 类，`src/lib/profile.ts:26-41`，无需新建 |
| Profile metadata 展示 | **部分已存在** | wizard 审阅页已展示来源/证据/时间/置信度；canonical 记录列表页未做 → A3 |
| Basic Profile status 管理 | **部分已存在** | `RecordState` 三值已定义；没有写接口 → Category B |

### 1.2 选定四个 A 类特性（有序）

#### A0 · 共享契约 `src/lib/user.ts`（**已完成 11-13**）

| 项 | 内容 |
| --- | --- |
| Scope | 把 `Landing` / `Density` / `Prefs` / `DEFAULT_PREFS` 与边界校验抽到 `src/lib/user.ts`；`src/state/user.ts` import + re-export |
| 现有依赖 | `ENGINEERING-STANDARDS.md` §2 的 D-006 pattern；P1-7 对 `chat.ts` 用过同一手法 |
| 代码改动 | 新增 `src/lib/user.ts`、`src/lib/user.test.ts`；改 `src/state/user.ts` |
| DB 改动 | 无 |
| API 改动 | 无（A0 阶段不挂路由；`GET|PATCH /api/user` 由 A1 补上） |
| 前端改动 | 无。`UserPage.tsx` / `Rail.tsx` / `routerChildren.tsx` 零 diff |
| 测试 | 坏 payload、枚举、null、trim、默认合并、patch 校验、失败形状 |
| DoD | `check` 通过；`src/state/user.test.ts` 原样通过；行为逐字节不变；`npx eslint src/lib/user*` 无输出 |

#### A1 · displayName 服务端持久化（**已完成 11-14，D-059**）

| 项 | 内容 |
| --- | --- |
| Scope | `GET|PATCH /api/user` 只管 displayName；不改 IdP 字段 |
| 现有依赖 | `SessionUser.id`、`server/http.ts`、`server/router.ts`、A0 契约 |
| 代码改动 | `server/routes/user.ts` + `server/routes/user.test.ts`；`router.ts` 加一条分发；`src/services/user/client.ts` |
| DB 改动 | **无**。`server/user/store.ts` 写 `<STORAGE_DIR>/user/<id>.json`（空则 `.workbuddy/user/`），D-059 已定 |
| API 改动 | `GET /api/user` 200 / 401；`PATCH /api/user` 200 / 400 `contract` / 401 / 413；文件存储无 503 分支 |
| 前端改动 | `src/state/user.ts` 加 `VITE_USER_SOURCE=local|api`，默认 local 逐字节不变；api 模式 hydrate 一次 + 300ms 后台同步，本地 envelope 始终保留 |
| 测试 | 20 个新测试：契约 3、route 真 HTTP 8、client 4、双模式 5；`api:check` +2、`e2e` +1 |
| DoD | **达成**：PATCH→GET 回读、两个 userId 隔离、未登录 401、`check`/50 文件 424 单测/16 项 api:check/315 项 e2e 全绿、UI 零 diff |

#### A2 · Preferences 服务端持久化（A1 已完成，未开工）

| 项 | 内容 |
| --- | --- |
| Scope | 把三项真实偏好（density / landing / defaultWorkspace）接到与 A1 同一份 User 状态 |
| 现有依赖 | `prefsOf()` / `landingPath()` / `setPref()`、A0 的 `isPrefPatch()` |
| 代码改动 | 扩 A1 的 route 与 client；`src/state/user.ts` 的 `setPref` 走后台同步 |
| DB 改动 | 无新增（复用 A1 的 `prefs` jsonb 或同一文件） |
| API 改动 | `PATCH /api/user` 支持 `{prefs:{...}}`，逐键校验枚举 |
| 前端改动 | 无新控件；固定值 Theme / Language 仍保持固定值 |
| 测试 | 坏枚举被拒；三项刷新后仍在；`landingPath` 仍指向正确路由；e2e 断言不回归 |
| DoD | 改 density → 刷新仍生效；改 landing → 下次 `/` 落对路由；不写入 IdP 字段 |

#### A3 · Profile 记录列表与元数据展示（不依赖 Q1）

| 项 | 内容 |
| --- | --- |
| Scope | 在 User 页新增一个只读的记录视图，读现有 `GET /api/profile/state` 的 `records` / `history` |
| 现有依赖 | `src/lib/profile.ts`、`src/services/profile/client.ts`、`server/routes/profile.ts` |
| 代码改动 | `src/pages/user/` 新增一个分区或子页；不改服务端 |
| DB 改动 | 无 |
| API 改动 | 无（复用 `/api/profile/state`） |
| 前端改动 | 列表 + 详情：来源 URL、证据、显式/推断、四个时间、状态、置信度（标「模型自评」）、history |
| 测试 | 空态、无 session 401、多条记录渲染；e2e 加 2–3 条断言 |
| DoD | commit 产生的记录在 User 页看得到且元数据齐全；不出现无来源综述；`e2e` 全绿 |

**顺序**：A0 →（Q1 拍板）→ A1 → A2 → A3。A3 不依赖 Q1，可在等拍板时插入，但按「一次只开一个」排在 A2 后。

---

## 2. Category B — 需要额外设计，Phase 2 内可做

| 特性 | 现状 | 需要准备什么 | 依赖 |
| --- | --- | --- | --- |
| Profile 记录直接 CRUD | 只能由 commit 产生 | 编辑 / 删除 / 归档的形状校验；删除是软删还是 tombstone 要定 | Q4、A3 |
| 搜索与过滤 | `/api/profile/state` 返整包 | 按 category / state / informationType / 时间过滤；是否分页 | A3 |
| 记录状态 PATCH | `state` 字段存在无写口 | `active → outdated → archived` 的合法转移与谁可触发 | Q4 |
| `imported` 信息类型 | 只有 explicit / inferred | 枚举扩展 + 旧值兼容 + 来源标记 | 无外部依赖，最轻 |
| History / revisions 完整展示 | `ProfileHistoryEntry` append-only，wizard 未展示全量 | 时间线 UI 与 `from/to/by` 呈现 | A3 |
| Default Workspace 配置 | 本地 prefs 已生效 | 服务端化后与 `workspaceIds` 校验：删掉的工作区要降级 | A2、Q3 |
| Data export | 无 | 先枚举要导出的域（user + profile + chat + files），再定格式与权限 | IdP、Q1 |
| Session management | `server/session/source.ts` 只有 dev / pending-idp | **External**，不是 Thylas 功能；等 IdP 提供列表接口 | Q5 |

---

## 3. Category C — 复杂 / 需单独规划

### 3.1 Profile Initialization Pipeline

**已实现，且有专门技术计划**：`docs/development/profile/AUDIT-PLAN.md`（审计 + 六阶段 + API + 安全 + 未决）、`docs/development/profile/IMPLEMENTATION.md`（实现 + 测试 + 已知限制）。本轮不重写、不重开。

| 项 | 内容 |
| --- | --- |
| 主挑战 | 真实外网抓取的可用性（CDP e2e 不触外网）；DB 化与多实例；冲突「以新代旧」审阅流；敏感信息授权 UI；置信度只是模型自评 |
| 依赖 | `DATABASE_URL`、CHORD IdP verifier、受限平台导出格式、用户手动外网验证 |
| 未决 | `AUDIT-PLAN.md` 未决 1–5、`IMPLEMENTATION.md` 已知限制 1–8（原文照列，不在本文替它决定） |
| 建议顺序 | ① 用户手动验一次真实公开源 → ② 定 Q1 后把 `<userId>.json` 迁到 `users` / `profile_*` 表 → ③ 冲突审阅流 → ④ 敏感信息白名单授权 UI → ⑤ 接真 IdP |

### 3.2 其它 C 类

| 特性 | 主挑战 | 依赖 | 未决 | 建议顺序 |
| --- | --- | --- | --- | --- |
| Avatar / username / email 可写 | truth 在 IdP，Thylas 不应留第二份可写副本 | IdP 的 profile API | Q2、Q5 | 等 IdP → 定只读镜像还是代理写 → 再排 |
| 登录方式 / 设备 / 会话 / 账户删除 | 当前无 auth service，控件必须继续 disabled | IdP | Q5 | 等 IdP；不得先做 UI 占位 |
| 第二套主题 / i18n | 需要完整 palette 与 CJK 排版工程 | 设计决策 | Q6 | 先立项，再谈偏好持久化 |
| Default Coworker / default model | 产品模型里没有默认 Coworker；模型选择归 WAM | Coworker 实体（Phase 2 后续）、WAM 边界 | 产品决策 | 排在四个核心实体之后 |
| 组织级资源管理 | 任务书明确排除 | — | — | 不做 |

---

## 4. 执行路线图

| Step | 做什么 | 状态 |
| --- | --- | --- |
| 1 | 文档完成：五域规格 + MVP 分类 + 能力审计 + Q1–Q7 | **完成 11-13** |
| 2 | A0 共享契约 + 测试，零行为变更 | **完成 11-13** |
| 3 | 全量验证：`check` / `test` / `api:check` / `e2e` / 定向 eslint | **完成 11-13，11-14 重跑** |
| 4 | Q1 拍板（DB 表 vs 服务端文件） | **完成 11-14**：D-059 选服务端 per-user 文件 |
| 5 | A1 displayName → A2 prefs → A3 记录展示，一次一个 | **A1 完成 11-14**；A2 / A3 未开工 |
| 6 | Category B 细化计划（先 `imported` 与记录 CRUD，最轻） | 未开工；或先做不依赖 Q1 的 A3 |
| 7 | Profile Initialization 单独计划：沿用现有两份文档，按 §3.1 顺序推进 | 未开工 |

**Step 3 的验证清单**（任务书 Part V Step 3）：

- 持久化：A1 的 PATCH→GET 回读已在 `api:check` 与浏览器 e2e 各验一次；A2 的 prefs 刷新待做。
- 用户级授权：无 cookie 401、两个 userId 互不覆盖，已在 `server/routes/user.test.ts` 真 HTTP 验过。
- 不覆盖无关数据：`src/state/user.test.ts` 原样通过；`chat` / `profile` / `files` 状态与 UI 文件零改动。
- API / DB 约定：契约在 `src/lib/user.ts`、失败形状 typed、本轮无迁移。
- 错误处理：坏 payload 400 `contract`、超限 413、缺 session 401；客户端失败返回 typed 值，不抛异常跨边界。

---

## 5. 约束核对与本轮执行状态

| 任务书约束 | 本轮做法 |
| --- | --- |
| 不引入 WAM / 多智能体编排 | 未引入；Profile 抽取复用现有 DeepSeek 调用，不是 agent 编排 |
| 不建复杂记忆架构 / 向量库 | 未引入 |
| 不重复 Phase 1 功能 | 复用 `SessionUser`、`sendJson`、`readBody`、`ProfileRecord`；不新建 profile 端点族 |
| 不过度设计数据模型 | `users` 表只列为提案；本轮零 DB 改动 |
| 不实现不支持的认证 / 安全功能 | Security 域全部判 External / Deferred |
| 不用 mock 冒充后端完成 | 未新增任何端点或假状态 |
| 不静默做重大产品决策 | Q1–Q7 单列；`users` 字段标 `[P]` |
| 不重构无关部分 | A0 只动 `src/state/user.ts` 与新增 `src/lib/user*` |

**Actually implemented（本轮）**：见 §1.2 A0 与文末「执行结果」节；测试数字在跑完后回填。

---

## 6. 执行结果（11-13 23:00）

**Actually implemented**：A0 一个特性。

| 文件 | 变化 |
| --- | --- |
| `src/lib/user.ts` | 新增。`Landing` / `Density` / `Prefs` / `DEFAULT_PREFS` + `readPrefs()` / `readDisplayName()`；无 API 路径、无端点、无产品决策 |
| `src/lib/user.test.ts` | 新增 9 个测试：坏 payload、枚举、null、trim、默认值、部分字段损坏 |
| `src/state/user.ts` | 16 行插入 / 33 行删除。改为 import + re-export，`read()` 调共享校验；导出名与签名全部不变 |

**当时未实现（11-13 23:00 状态；A1 已完成，见 §7）**：A1 / A2 / A3、`users` 表、`0003` 迁移、`/api/user*`、Profile 记录 CRUD、双模式开关。当时的原因是 Q1 未拍板；Q1 于 11-14 由 D-059 关闭。

**验证**

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test` | 47 文件 / 404 全绿（+9） |
| `npm run api:check` | 14 / 14 |
| `npm run e2e` | 314 / 314 |
| `npx eslint src/lib/user.ts src/lib/user.test.ts src/state/user.ts` | 无输出 |
| `git diff --name-only src/pages src/shell src/app` | 空（UI 零 diff） |
| `git diff --stat src/state/user.test.ts` | 空（原样通过） |

全量 `npm run lint` 仍是 2 个既有 error（`AppShell.tsx:7`、`CoworkerDetail.tsx:37`）与 2 个既有 warning，本轮未碰。未 commit。

---

## 7. A1 执行结果（11-14 08:20）

**决策**：Q1 关闭，登记 `DECISIONS.md` D-059。User 状态走服务端 per-user 文件，不建 `users` 表、不加 `0003`、不复制 IdP 字段；真库接入时只换 `server/user/store.ts`。

| 文件 | 变化 |
| --- | --- |
| `src/lib/user.ts` | 加 `USER_PATH`、`USER_DISPLAY_NAME_MAX`、`UserDto` / `UserPatch` / `UserErr`、`userFailure()` / `statusForUser()` / `isUserPatch()` / `normalizeDisplayName()` |
| `server/user/store.ts` | 新增。原子写 `<root>/<userId>.json`，`safeUserId` 白名单，坏文件回落空值 |
| `server/routes/user.ts` | 新增。`GET|PATCH /api/user`，session → 校验 → 写；userId 只从 session 取 |
| `server/router.ts` | 加 `USER_PATH` 一条分发 |
| `src/services/user/client.ts` | 新增。`get()` / `patch()`，`credentials:'include'`，失败不抛 |
| `src/state/user.ts` | `VITE_USER_SOURCE=local|api`；`local` 逐字节不变；`api` 启动时 hydrate 一次、300ms 后台同步、本地 envelope 始终保留 |
| `.env.example` | 加 `VITE_USER_SOURCE=local` |
| 测试 | `src/lib/user.test.ts` +3、`server/routes/user.test.ts` 8、`src/services/user/client.test.ts` 4、`src/state/user.dual.test.ts` 5 |
| 回归脚本 | `scripts/api-checks.mjs` +2 项、`scripts/ui-checks.mjs` +1 项 |

**验证**

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test` | 50 文件 / 424 全绿（+20） |
| `npm run api:check` | 16 / 16（+ `user 401`、`user write then read`） |
| `npm run e2e` | 315 / 315（+ 浏览器内 PATCH→GET 回读） |
| 定向 eslint（新增文件） | 无输出 |
| `git diff --name-only src/pages src/shell src/app` | 空（UI 零 diff） |
| 全量 `npm run lint` | 仍 2 个既有 error + 2 warning，未碰 |

**遗留**：A2 prefs 服务端化、A3 记录展示未开工；`VITE_USER_SOURCE=api` 在真实浏览器仍需要 dev cookie（Q7）；Docker daemon 未运行，真库 `db:migrate` 未验。未 commit。
