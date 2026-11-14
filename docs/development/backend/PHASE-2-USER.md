# Phase 2 — User Module（规格）

**状态：** 2026-11-13 文档初稿。规格与现有能力审计，**User 域后端未开工**。
**上位：** [`ROADMAP.md`](ROADMAP.md) Phase 2。Phase 1 完成记录：[`PHASE-1.md`](PHASE-1.md)。
**配套：** [`PHASE-2-USER-PLAN.md`](PHASE-2-USER-PLAN.md)（A/B/C 分类与实施顺序）。
**标签：** `[C]` 已确认 · `[P]` 提案 · `[?]` 未决，遵循 `AGENT.md` §1.4。本文不把提案写成定稿。
**不做：** WAM、A2A、多智能体编排、向量库、记忆架构、组织级资源管理、假登录。

---

## 0. 开工前的能力审计（逐条核过代码）

### 0.1 Phase 1 已实现，可直接复用

| 能力 | 文件 | 事实 |
| --- | --- | --- |
| 一个 router、两个 host | `server/router.ts:32-64`、`server/index.ts`、`server/ai.ts` | `npm run dev` 与 `npm run api` 挂同一份分发；非 `/api/` 交回 Vite |
| 共享契约 | `src/lib/{ai,chat,conversations,files,session,profile}.ts` | 两侧 import 同一个文件，改字段另一侧编译报错（D-006） |
| session 唯一替换点 | `server/session/source.ts:44-48` | 无 `CHORD_ISSUER` 读 dev cookie；配了 issuer 则 fail closed 401 |
| 授权顺序 | `server/routes/*.ts` | 401 → 403 → 503 → 写；成员标记来自 session，前端不自算（B1） |
| Drizzle + 迁移 | `server/persistence/schema.ts`、3 个 SQL | 3 表：`conversations` / `messages` / `files`；`db:generate` 幂等 |
| DB 未配置时的行为 | `server/persistence/client.ts` | 无 `DATABASE_URL` 返回 `null`，DB 路由答 503 `not_configured` |
| 两种真实持久化 | `server/storage/local.ts`、`server/profile/store.ts` | 字节存本地目录；profile 按 `<userId>.json` 存服务端文件 |
| typed failure | `src/lib/*.ts` 的 `failure()` / `statusFor()` | `{ok:false, kind, message, retryable}`，不抛异常跨边界 |
| 验证工具 | `scripts/api-checks.mjs`、`scripts/ui-checks.mjs`、Vitest | 16 项 HTTP 回归、315 项浏览器断言、50 文件 / 424 单测（A1 后实测） |

### 0.2 User 相关能力**已经存在**，不得重做

| 能力 | 文件 | 真实程度 |
| --- | --- | --- |
| Display name + 3 个偏好 | `src/state/user.ts`（`thylas:user:v1`） | 真实本地持久化；`read()` 做枚举校验，手改坏 payload 丢条目不崩 |
| User 页 4 个分区 | `src/pages/user/UserPage.tsx` | identity / preferences / environment / security；禁用控件都写了原因 |
| 身份字段 | `src/data/mock.ts:18-27` | `USER` seed：name / username / email / accountId / initials / role / plan / memberSince。**样品，不是账户** |
| Profile Initialization 六阶段 | `src/lib/profile.ts`、`server/profile/*`、`server/routes/profile.ts` | **已完整实现**：7 个端点、SSRF 双检、正文抽取、候选审阅、去重、幂等 commit、history、按用户文件隔离 |
| Profile 记录元数据 | `src/lib/profile.ts:79-103` | content / category / sourceUrl / evidence / informationType / state / createdAt / discoveredAt / updatedAt / confirmedAt / confirmedBy |
| 6 类 Profile 分类 | `src/lib/profile.ts:26-41` | basic / interests / goals / expertise / preferences / activities，固定枚举 |
| 候选与记录状态 | `src/lib/profile.ts:44-46` | candidate: pending/accepted/rejected/edited；record: active/outdated/archived |
| UI 层规格 | `docs/development/user-connect/{AUDIT,PLAN,MOCKED-AND-FUTURE}.md` | D-049 已定四个分区、路由与诚实文案 |
| 初始化专门技术计划 | `docs/development/profile/{AUDIT-PLAN,IMPLEMENTATION}.md` | 任务书要求的 dedicated technical plan **已经存在**，不重写 |

### 0.3 确实缺的东西

| 缺口 | 证据 |
| --- | --- |
| `users` 表 / `0003` 迁移 | `schema.ts` 只有 3 表；`_journal.json` 只有 0000–0002 |
| ~~`/api/user*` 端点~~ | 11-13 时 `server/router.ts` 无此分发；**A1 已补上**（`GET|PATCH /api/user`） |
| 服务端 displayName / prefs | 只在 `localStorage`，换浏览器即丢 |
| Profile 记录的直接 CRUD | `ProfileRecord` 只能由 `POST /api/profile/commit` 产生；无编辑、删除、归档接口 |
| Profile 搜索 / 过滤 | `/api/profile/state` 返回整包 `ProfileState`，无 query 参数 |
| 记录状态写接口 | `state` 字段存在，但没有 PATCH 改它 |
| `imported` / `coworker-observed` 信息类型 | `InformationType` 只有 `explicit \| inferred` |
| `pending` 记录生命周期 | pending 只在 candidate 上，record 没有 |
| 头像服务、通知服务、计量服务、i18n、第二套主题 | `MOCKED-AND-FUTURE.md` M1–M5、`UserPage.tsx` 的固定值与 disabled 控件 |
| 会话列表、设备、数据导出、账户删除 | `UserPage.tsx` security 区写「belong to an identity service that is not connected」 |

### 0.4 架构约束（硬，决定哪些功能不能做）

1. **身份归 CHORD。** `docs/product/definition.md:163`：sign-in / session 由 IdP 拥有，Thylas 只 redirect、hold session、render identity。`DOMAIN-MODELS.md:11` 写 "do not invent auth"。→ 不造密码、注册、邮箱校验、登录方式、账户删除。
2. **不建本地 ACL 副本。** `definition.md:164,166`：组织 / 成员 / 角色归共享授权服务，Thylas "Render members; gate rows; never authorise alone"、"no local ACL copy"。§9 B1：授权在资源所有者处执行，UI 隐藏只是礼貌。→ `workspaceIds` 只从 session 读，不建成员表、角色表。
3. **`DATABASE_URL` 为空。** `createDb()` 返回 null，所有 DB 路由 503。→ 新表方案在本机**无法验证**「刷新 / 重登仍在」。Profile 管线因此选了服务端文件（真实持久化，不是浏览器 mock），见 `profile/AUDIT-PLAN.md` §Phase 2。
4. **契约与迁移约定。** `ENGINEERING-STANDARDS.md` §2：wire shape 放 `src/lib/<domain>.ts`、迁移是 schema of record、客户端不学 SQL、禁 codegen。§5：每个功能带测试，`npm run e2e` 全绿才算完成。
5. **模拟诚实。** `ENGINEERING-STANDARDS.md` §7、`MOCKED-AND-FUTURE.md`：做不到的控件要写明原因，不能报未取得的成功。
6. **U2 首次登录。** `definition.md:137,151`：受邀成员首登要直接落进组织工作区。`defaultWorkspace` 现在是本地偏好，不能拿来当授权依据。
7. **不静默决定。** `AGENT.md` §1.4 / §8：保留 `[?]`，产品边界与实现细节分开写。

---

## 1. 模块定义

**User Account 回答**：这个人是谁，怎么进 Thylas。
**User Profile 回答**：Thylas 知道这个人的什么，这些信息有多可靠、多新。

| 关系 | 归属 | 本模块内的边界 |
| --- | --- | --- |
| Account ↔ Profile | Account 的 id 是 Profile 的唯一分区键 | Profile 不是一段持续增长的 prompt，也不是纯文本摘要；它是带来源、时间、状态、置信度的**记录集合** |
| Profile ↔ Coworker | Coworker 是未来的读侧消费者，不是所有者 | `coworkers/DEFINITION.md:18`：人「works with it」；`ARTIFACT-RELATIONSHIP.md:69-70`：humans hold authority。本阶段不建 WAM / A2A 接口（约束 1/2） |
| User ↔ Workspace | 成员关系由 session 的 `workspaceIds` 提供 | User 模块不建成员表；`defaultWorkspace` 是偏好，不是权限 |
| 系统偏好 ↔ Working Preferences | 前者是「Thylas 怎么表现」，后者是 Profile 的 `preferences` 类记录 | 两套状态分开存，不互相覆盖 |

**责任分类**（`AGENT.md` §4）：

| 分类 | 本模块中的项 |
| --- | --- |
| Core | displayName、系统偏好、Profile 记录及其元数据 |
| Integration | session 读取（CHORD IdP）、成员标记（授权服务） |
| Presentation | username / email / accountId / memberSince 的只读展示 |
| External | 登录方式、设备、会话、头像、账户删除、计量 |
| Out of scope | WAM 编排、向量记忆、模型选择、组织级资源管理 |

---

## 2. 五个功能域规格

### 2.1 Identity

| 项 | 内容 |
| --- | --- |
| Purpose | 让界面叫对名字；账户事实由 IdP 提供，Thylas 不复制 |
| 用户可见 | 编辑 display name（≤40 字、trim、留空恢复 provider name）；读 username / email / accountId / memberSince / role；头像按钮 disabled 且写明原因 |
| 已存在 | `UserPage.tsx` identity 区、`src/state/user.ts:setDisplayName`、`displayNameOf()`、`Rail.tsx` |
| Required behavior | 改名后 rail footer 与 header 同步；刷新后仍在；手改 envelope 不崩；空输入恢复 IdP 名 |
| 数据 | `displayName?: string` + `prefs`，key `thylas:user:v1`；服务端位置由 D-059 定为 `<STORAGE_DIR>/user/<userId>.json`（A1 已落地） |
| 依赖 | `SessionUser.id`；IdP 提供 fallback 名 |
| 权限 | 仅本人可写；无 session 401；无跨用户读端点 |
| 交互 | inline 编辑表单，Save / Cancel，旁边写「Empty saves the provider name back.」 |
| 验收 | 改名 → 刷新 → rail 仍显示新名；清空 → 显示 seed 名；`user.test.ts` 全绿 |

**任务书里 avatar / username / email 的可编辑版本判为 `[?]` Deferred**：当前无 avatar service，username/email 的 truth 在 IdP。`definition.md:163` 不允许 Thylas 持有第二份可写副本。

### 2.2 User Profile

| 项 | 内容 |
| --- | --- |
| Purpose | 让 Thylas 与未来 Coworker 读到可追溯、有状态的个人信息 |
| 用户可见 | 按 6 类查看记录；看 content / category / 来源 URL / 证据 / 显式或推断 / 四个时间 / 状态 / 置信度（标「模型自评」）/ 修改历史；确认或拒绝推断项 |
| 已存在 | `src/lib/profile.ts` 的 `ProfileRecord` / `ProfileHistoryEntry` / `recordKey()`；wizard 的候选审阅与 commit；`server/profile/store.ts` 的按用户隔离 |
| Required behavior | 一条记录一个 `key` 去重；`confirmedBy` / `confirmedAt` 由用户批准时写；history append-only；commit 幂等；不静默覆盖已确认记录 |
| 数据 | 复用 `ProfileRecord`，**不新建第二套记录模型** |
| 依赖 | `ProfileState` 文件、`SessionUser.id` |
| 权限 | 401 → userId 决定文件路径 → 写；其它用户读不到（`pipeline.test.ts` 已有隔离断言） |
| 交互 | 列表 / 详情；编辑与删除是 `[P]`，`pending` 生命周期与 `imported` 类型是 `[?]` |
| 验收 | 两个 userId 各写各的互不覆盖；手改文件坏条目不崩；批准一次与批准两次结果相同 |

**缺失**：记录直接 CRUD、搜索 / 过滤、状态 PATCH。判为 Recommended（见 §3）。

### 2.3 Profile Initialization

**已实现，且有专门技术计划。** 不再写第二份：`docs/development/profile/AUDIT-PLAN.md`（审计 + 6 阶段 + API + 安全 + 未决）、`docs/development/profile/IMPLEMENTATION.md`（实现记录 + 测试）。

任务书的逐条要求对照：

| 要求 | 现状 | 位置 |
| --- | --- | --- |
| 用户显式提交源 | 6 类，URL + 类型后端校验，去重，可删未完成源 | `server/routes/profile.ts` |
| 检索公开内容 | http/https only，字面 IP + DNS 双检，逐跳重定向，8s / 512KB 上限 | `server/profile/fetch.ts` |
| LLM 结构化抽取 | 复用服务端 DeepSeek，页面当不可信数据，证据必须能在正文找到 | `server/profile/extract.ts` |
| 候选审阅 | accept / edit / reject / 批量，编辑值永久优先于抽取值 | `src/pages/user/ProfileInit.tsx` |
| 批准后写入 | 仅 accepted/edited → records；`recordKey` 去重；幂等 | `server/profile/store.ts` |
| 部分失败 / 重试 | 单源失败不影响其它源，手动重跑不重复抓取成功源 | `IMPLEMENTATION.md` §已实现 F |
| 保留来源、显式/推断、时间戳、不覆盖 | sourceUrl / evidence / informationType / 四个时间 / `possibleMatch` 只提示 | `src/lib/profile.ts:58-103` |
| 不假设所有平台可抓 | LinkedIn 直接 422 `unsupported` | `IMPLEMENTATION.md` |
| 不做全网发现 / 持续爬取 | 明确列为不实现 | `IMPLEMENTATION.md` §不实现 |

**未决**（原文已列，不在本文重开）：DB 化、真 IdP、受限平台导出文件、敏感信息白名单、置信度语义、冲突「以新代旧」审阅流、真实外网抓取验证。

### 2.4 Preferences

| 项 | 内容 |
| --- | --- |
| Purpose | 决定 Thylas 怎么表现，不混入长期 Working Preferences |
| 已存在（真实） | density（立即生效、持久）、landing（router 的 index redirect 读取）、defaultWorkspace（对 live 列表解析，删掉的降级显示） |
| 已存在（固定值 / 禁用） | Theme = Light（页面写「A second palette would double the tone problem」）、Language = English、Notifications = disabled（无通知服务） |
| 数据 | `Prefs`：`landing` / `density` / `defaultWorkspace`；`DEFAULT_PREFS` 兜底 |
| 权限 | 仅本人；`VITE_USER_SOURCE=local|api`，默认本地（D-059）。prefs 服务端化留 A2 |
| 验收 | 改 density → `--h-row` 变；改 landing → 下次到 `/` 落到对应路由；手改 envelope 丢坏条目不崩；`user.test.ts` / e2e 断言全绿 |

任务书的 Appearance / Language / Editor / Interaction / Notifications 五类判为 Deferred：没有第二套 palette、没有 i18n 工程、没有通知服务、编辑器偏好尚无对应行为。`ENGINEERING-STANDARDS.md` §7 不允许用假开关填满页面。

### 2.5 My Environment & Security

| 项 | 内容 |
| --- | --- |
| Environment 现状 | 只读视图：默认工作区、Compute pool 摘要、个人机器、最近环境；页面原话「A view, not a manager」 |
| 任务书新增项判定 | default Coworker：产品模型没有「默认 Coworker」概念 → Deferred；default model：模型选择归 WAM（`application.md:230`）→ Out of scope；compute preference：compute 是 seed，无真资源 → Deferred |
| Security 现状 | 「This browser · local profile」，认证方式写 IdP not connected，设备「None recorded」，sign out disabled 并写明原因，API keys 按钮给诚实提示，无安全事件空态 |
| 任务书新增项判定 | Login methods / Active sessions / Device management / Authentication settings / Data export / Account deletion 全部需要 IdP 或尚未存在的服务 → **External / Deferred**，本阶段不实现（任务书约束 7） |
| 权限 | 不暴露 IdP 不支持的控制；不显示假会话 |
| 验收 | 浏览器断言：sign-out 按钮 disabled；页面不出现「已登出」「已删除」之类未取得的提示 |

---

## 3. MVP 分类

| Feature | 分类 | 理由（具体到现有代码 / 服务） |
| --- | --- | --- |
| Display name 编辑 | **Required**（已完成） | `setDisplayName` 本地已跑通；服务端持久化由 A1 完成并验过 PATCH→GET |
| Density / landing / defaultWorkspace | **Required**（已存在于本地） | 三个都有真实行为，服务端持久化属 A2 |
| Profile 记录 + 元数据 + 去重 + history | **Required（已完成）** | `src/lib/profile.ts` + `server/profile/store.ts` + 10 条 pipeline 测试 |
| Profile Initialization 六阶段 | **Required（已完成）** | `IMPLEMENTATION.md`：395 单测 / 314 e2e |
| Identity 只读字段展示 | **Required（已完成，样品）** | `USER` seed；真值要等 IdP（Q5） |
| Profile 记录列表 / 详情 UI | Recommended | 数据在 `/api/profile/state` 已有，只差展示面 |
| Profile 记录直接 CRUD、搜索 / 过滤、状态 PATCH | Recommended | 需要写接口与冲突规则，不是「加个按钮」 |
| `imported` 信息类型 | Recommended | 无外部依赖，只是枚举扩展 + 迁移旧值 |
| `pending` 记录生命周期 | Deferred | 现由 candidate 承担审批，重复建 pending 会两套状态 |
| `coworker-observed` 信息类型 | Deferred | 需 Coworker 写接口，本阶段不做 WAM / A2A |
| Avatar / username / email 可编辑 | Deferred / External | 无 avatar service；真值在 IdP，Thylas 不留第二份可写副本 |
| Theme / accent / language / editor / interaction / notifications | Deferred | 无第二套 palette、无 i18n、无通知服务；`UserPage.tsx` 已注明 |
| Default Coworker / default model / compute preference | Deferred / Out of scope | 产品模型没有，或归 WAM |
| Login methods / sessions / devices / auth settings / export / delete | External | IdP 未接入；`server/session/source.ts:45` fail closed |
| 组织级资源管理 | Out of scope | 任务书明确排除 |

**分类原则**：只把「现有服务已经能真实支撑」的项标 Required。任务书里的长期愿景项不因出现在清单里就升级为 MVP。

---

## 4. 数据与 API 需求

### 4.1 复用，不新建

| 实体 | 来源 |
| --- | --- |
| `SessionUser {id, workspaceIds}` | `src/lib/session.ts` |
| `Prefs` / `Landing` / `Density` / `DEFAULT_PREFS` | `src/state/user.ts`（A0 抽到共享契约） |
| `ProfileRecord` / `ProfileSource` / `ProfileCandidate` / `ProfileHistoryEntry` | `src/lib/profile.ts` |
| `ProfileState` / `recordKey()` / `profileFailure()` | `src/lib/profile.ts` |
| typed failure / `sendJson` / `readBody` / `readJsonBody` | `server/http.ts` |

### 4.2 新增（A1 已落地，其余仍是 `[P]`）

| 项 | 说明 | 状态 |
| --- | --- | --- |
| `<storageDir>/user/<userId>.json` | `server/user/store.ts`，沿用 profile store 的按用户文件模式；`STORAGE_DIR` 空时落 `.workbuddy/user/`（gitignore 覆盖） | **已实现**（D-059） |
| `GET /api/user`、`PATCH /api/user` | 只管 displayName；`UserDto {displayName: string|null}`，`isUserPatch` 限 40 字 | **已实现**（A1） |
| `users` 表 + `0003` 迁移 | `id` / `display_name` / `prefs` jsonb / `default_workspace` / 时间戳 | 推迟到真库；Q2 未定 |
| `PATCH /api/user` 支持 prefs | 逐键枚举校验，与 displayName 同一份 User 状态 | A2，未开工 |
| `/api/profile/records*` 写接口 | 扩展现有 `/api/profile/*`，**不新建第二套 profile 端点族** | 冲突规则未定（Q4） |

### 4.3 服务职责与授权

- `server/router.ts`：`USER_PATH` 一条分发，非 `/api/` 仍交回 Vite。
- `src/lib/user.ts`：唯一契约，形状校验与 `statusForUser()` 在这里。
- `server/routes/user.ts`：401 → 本人 userId（只从 session 取）→ 校验 → 写。文件存储不需要 `DATABASE_URL`，因此**没有 503 分支**；顺序与现有路由一致。
- `server/user/store.ts`：一个 userId 一份状态；不建 role / membership 表。真库接入时只换这一处。
- 失败形状沿用 `{ok:false, kind, message, retryable}`，`retryable` 对 401 / 403 必须为 false。

### 4.4 生命周期、来源、历史

| 要求 | 现状 / 落点 |
| --- | --- |
| 记录状态 | `active` / `outdated` / `archived` 已有；`pending` 由 candidate 承担，不重复 |
| 来源 | `sourceUrl` + `evidence` 已存；`ProfileSource` 保留 `retrievedAt` 与失败原因 |
| 时间 | `createdAt` / `discoveredAt` / `updatedAt` / `confirmedAt` 已分离，互不代替 |
| 历史 | `ProfileHistoryEntry` append-only；`commit` 幂等 |
| 去重 | `recordKey(category, content)`；`possibleMatch` 只提示，不静默覆盖 |
| 不覆盖无关用户数据 | `safeUserId()` 决定文件路径，每请求先 401 |

---

## 5. 用户体验要求

- **不新增页面族。** 沿用 `UserPage.tsx` 四分区 + `/user/profile` 五步向导；新能力落在现有分区里。
- **设计系统**：`PlainLayout wide`、`--w-sheet` 行宽、`Field` / `Button` / `EmptyState` / `StatusDot`，样式复用 `user.module.css` 与 `profile.module.css`，颜色与间距只取 tokens。
- **身份管理**：可编辑的只有 display name；其余标明来自 IdP 且只读；avatar 按钮 disabled 并写原因。
- **Profile 管理**：每条记录显示来源 URL、证据、显式/推断、四个时间、状态、置信度（标「模型自评」）；不出现「AI 已了解你」这类无来源的综述。
- **候选审阅**：来源、证据、单条 / 批量确认、编辑、拒绝，编辑值优先；进度是真实步骤，不放假进度。
- **偏好**：能改的给真控件；不能改的显示固定值并写明原因；禁用控件写 `title`。
- **My environment**：保持「A view, not a manager」，全部链接出去。
- **Security**：不出现 IdP 不支持的控制；不显示伪造的会话、设备或安全事件。

---

## 6. 验收条件（可观察）

| # | 命令 / 动作 | 期望 |
| --- | --- | --- |
| 1 | `npm run check` | 退出码 0 |
| 2 | `npm run test` | 50 文件 / 424 全绿（A1 +20） |
| 3 | `npm run api:check` | 16 项全绿（+ `user 401`、`user write then read`） |
| 4 | `npm run e2e` | 315 项全绿（+ 浏览器内 PATCH→GET 回读） |
| 5 | `npm run db:generate`（若建表） | 第二次 `No schema changes`；A1 未建表，本轮不适用 |
| 6 | 改名 → 刷新 → 换 session 重登 | displayName 仍在。**已验**：`api:check` 的 PATCH→GET 与 `e2e` 的浏览器内回读 |
| 7 | 两个不同 userId 各写一条名字 | 互不可见、互不覆盖。**已验**：`server/routes/user.test.ts` 真 HTTP |
| 8 | 无 cookie 请求 User 端点 | `401 unauthorized`，`retryable:false` |
| 9 | 手改 `thylas:user:v1` 为坏 payload | 丢坏条目，不崩，界面显示默认值 |
| 10 | `npx eslint` 新增文件 | 无输出 |
| 11 | Profile commit 连按两次 | 记录数与 history 不重复增长 |
| 12 | UI 检查 | sign-out / avatar / notifications 仍 disabled 且带原因；无「已成功」假提示 |

---

## 7. 未决决策（不静默拍板）

| # | 问题 | 影响 | 需要谁 |
| --- | --- | --- | --- |
| Q1 | ~~User 状态走 `users` 表还是服务端文件？~~ | **已定（D-059）**：服务端 per-user 文件；DB 表方案等真库 | 已关闭 |
| Q2 | `users` 表是否复制 username / email / accountId？ | IdP 是 truth，副本会漂移 | 产品决策 |
| Q3 | `defaultWorkspace` 归 prefs 还是 User 实体？ | 现在是 `Prefs` 字段，搬到实体要迁移旧 envelope | 产品决策 |
| Q4 | 是否扩 `InformationType` 到 `imported` / `coworker-observed`？ | 后者需要 Coworker 写接口，本阶段不做 WAM | 产品决策 |
| Q5 | CHORD IdP 的 cookie 格式与 verifier 接入时点 | 决定真认证何时上线；替换点只有 `server/session/source.ts` | 外部 |
| Q6 | 第二套主题 / i18n 是否立项 | 决定 Appearance / Language 偏好是否从 Deferred 升位 | 产品决策 |
| Q7 | dev cookie 在浏览器怎么注入 | 挡住所有 User 端点的真联调（`P1-7.md` 遗留） | 工程决策 |

---

## 8. 交付物状态区分

| 类别 | 内容 |
| --- | --- |
| **Existing**（本轮之前已有） | Phase 1 全部能力；User 页四区；本地 displayName + 3 偏好；Profile Initialization 六阶段与两份专门文档；`user-connect` 三份 UI 文档 |
| **Newly documented** | 本文件、`PHASE-2-USER-PLAN.md`（能力审计、五域规格、MVP、A/B/C、路线图）、`DECISIONS.md` D-059 |
| **Planned**（未写码） | A2 prefs 服务端化、A3 Profile 记录展示、`users` 表 / `0003`、Profile 记录 CRUD / 搜索 / 状态 PATCH |
| **Actually implemented** | **A0**：`src/lib/user.ts` 契约 + 9 测试，`src/state/user.ts` re-export（UI 零 diff）。**A1**：契约扩 `USER_PATH` / `UserDto` / `isUserPatch` / `statusForUser`；`server/user/store.ts`、`server/routes/user.ts`、`router.ts` 分发、`src/services/user/client.ts`、双模式后台同步、`.env.example` 开关；20 个新测试。无 DB 表、无 UI 改动。验证：`check` 0、50 文件 / 424 单测、16 项 `api:check`、315 项 `e2e`、定向 eslint 干净。详见 `PHASE-2-USER-PLAN.md` §6 / §7 |
| **Unresolved** | Q2–Q7（Q1 由 D-059 关闭）；`profile/IMPLEMENTATION.md` 已知限制 1–8；真库 `db:migrate` 未跑（Docker daemon 未运行）；`VITE_USER_SOURCE=api` 在真实浏览器里需要 dev cookie，与 Q7 同源 |
