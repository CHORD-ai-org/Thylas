# Profile Initialization Pipeline — implementation notes

**Date:** 2026-11-13 · 入口：User 页 → `/user/profile` · 审计与决策见 [`AUDIT-PLAN.md`](AUDIT-PLAN.md)

## 已实现（Phase 3–5，全部真实实现）

| 阶段 | 实现 |
| --- | --- |
| A 源提交 | 6 类（website/github/linkedin/portfolio/article/custom）；URL + 类型后端校验；多源、去重、删除未完成源；LinkedIn 直接返回 422（不假装支持） |
| B 发现 | `server/profile/fetch.ts`：仅 http/https；**字面私网 IP + DNS 解析双检**、host 黑名单、逐跳重定向校验（≤3）、8s 超时、512 KB 上限、content-type 白名单、HTML 去 script/style/nav/重复行；403/401 明示「不绕过登录墙/付费墙」；记录 `retrievedAt` 与失败原因 |
| C 抽取 | `server/profile/extract.ts`：复用服务端 DeepSeek（密钥不出服务端）；prompt 明确页面为不可信数据；结构化 JSON 校验、**证据必须能在页面文本中找到**、敏感信息过滤、去重、显式/推断区分、模型自评置信度 |
| D 候选 | 临时候选区；逐条 accept/edit/reject、批量确认；展示来源 URL、证据、类型、置信度、发现时间；**编辑内容作为用户确认值永久优先于原抽取** |
| E 初始化 | 仅 accepted/edited 写入 records；`recordKey(category, normalized content)` 去重；保留 sourceUrl/evidence/discoveredAt/confirmedAt/confirmedBy；幂等 commit；overview 只用已确认记录生成；history append-only |
| F 再发现 | 手动重跑；成功源不重复抓取；候选与既有 records 比对标 `possibleMatch`；同键已确认记录 commit 时 no-op，从不静默覆盖 |

## API 契约（`src/lib/profile.ts`，前后端共享）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/profile/state` | session/sources/candidates/records/history/overview（按登录用户隔离） |
| POST | `/api/profile/sources` | `{type,url}` → 200 state / 400 / 422 |
| DELETE | `/api/profile/sources/:id` | 仅 pending/failed 可删 |
| POST | `/api/profile/discover` | 逐源 fetch → 抽取 → 候选；单源失败不影响其它源 |
| PATCH | `/api/profile/candidates/:id` | `{action:'accept'|'reject'|'edit', content?}` |
| POST | `/api/profile/commit` | 写入 + overview + history；幂等 |
| POST | `/api/profile/reset` | 取消会话；**保留已确认记录与历史** |

错误形状：`{ok:false,error:{kind,message,retryable}}`，kind = contract/unauthorized/forbidden/not_configured/network/upstream/unsupported/not_found；401 用既有 `sessionFailure`。

## 存储 schema（文件，不是 DB 表）

`server/profile/store.ts` 写 `<storageDir>/profile/<userId>.json`（未配置 storageDir 时 `.workbuddy/profile/`，被 `.gitignore` 覆盖）。每文件：

```
{ version:1, sources[], candidates[], records[], history[], session, overview }
```

时间语义分离：`createdAt`（源/记录产生）· `discoveredAt`（抓取时刻）· `updatedAt`（修改）· `confirmedAt`（用户确认）。状态：source pending/ok/failed/unsupported；candidate pending/accepted/rejected/edited；record active/outdated/archived。用户隔离 = session.id 决定文件路径 + 每个请求先 401 校验，后端执行。

**为何不用 DB 表**：本部署 `DATABASE_URL` 为空，`createDb()` 返回 null、现有 DB routes 回答 503；不改动其语义，也不引入第二套连接。文件是真实服务端状态，非浏览器 mock；迁移到 `users/profile_*` 表是未来工作（见未决）。

## 安全

SSRF：字面 IP 与 DNS 双检（含 `169.254.169.254`、IPv6、IPv4-mapped）、重定向逐跳、scheme/credentials/host 校验、超时与体积上限。密钥仅服务端；页面文本只作为数据，不执行脚本；模型输出逐字段校验；LinkedIn 不声明支持；敏感信息（邮箱/电话/证件/凭据/生日等）在抽取层丢弃。

## 前端

User 页头部入口 → `/user/profile` 五步：Intro / Sources / Discovering / Review / Complete。进度为**真实步骤**，发现阶段展示逐源真实状态、无假进度；可跳过；审阅界面含来源、证据、Explicit/Inferred、时间、置信度（标注「模型自评」）、单条与批量确认、编辑、拒绝；完成页展示 overview 与每条记录的来源/时间；可再次运行。

## 测试（395/395 单测，314/314 e2e）

- `server/profile/pipeline.test.ts` 10 条：SSRF（私网/字面 IP/重定向回私网/403/非 HTML）、抽取（fence JSON、敏感过滤、证据校验、模型失败）、store（隔离/去重/编辑优先/幂等/reset 保留）、**真实 HTTP 六阶段流程**（401、其它用户隔离、部分源失败不毁结果、编辑→commit→overview→history→重跑不重复）。测试用注入 fetcher/llm 替身，不触外网、不调真模型。
- e2e 4 条：User 入口、向导、源提交真实 pending、发现失败诚实呈现无假候选；服务端状态按 run 使用唯一 userId 避免串扰。
- 截图 `design/reference/chatgpt/profile-{intro,sources}.png`。

## 已知限制 / 未决

1. **认证**：CHORD IdP 未接入；dev cookie 是既有显式 stand-in（P1-5）。生产需要真 session 校验。
2. **DB 化**：需 `DATABASE_URL` + users 表；文件存储不跨设备/多实例。
3. **联网**：CDP e2e 无法访问外网，完整真实抓取由用户在浏览器手动验证；CI 只测注入替身。
4. **LinkedIn/受限平台**：不抓取；用户导出文件的格式与授权 UI 待定。
5. **敏感信息**：MVP 一律过滤；用户显式授权纳入的 UI 未做。
6. **置信度**：模型自报，非校准概率；不参与自动接受。
7. **冲突处理**：`possibleMatch` 只作提示，尚无「以新代旧」的审阅流（不静默覆盖是既定边界）。
8. **不实现**（按任务边界）：WAM、多智能体编排、全网身份发现、持续监控、自动接受推断、向量记忆、人格建模、知识图谱。
