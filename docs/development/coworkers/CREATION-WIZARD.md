# Coworker 创建向导 — 改造计划

**状态：** 2026-11-14 19:32 计划完成，**未开工，未写业务代码**。
**输入：** 用户「制定改为向导的计划」。`DESIGN.md §4` 是产品规格，§10 Q-C 是未决冲突。
**范围：** 只改 `/coworkers/new` 的创建体验。不改 config 页、工作页、store 信封、后端。
**标签沿用** `DESIGN.md §0`：Confirmed / Proposed / Open / Deferred。本文件不把提案写成定稿。

---

## 0. 输入与边界

| 项 | 结论 |
| --- | --- |
| 方向 | **Confirmed（用户给的方向）**：把单页表单改为分步向导 |
| Q-C 收敛程度 | 部分收敛：IA 替换已定向。**阶段数、Blueprint 生成、头像步骤、Mind 编辑仍 Open**（§7） |
| 不动 | `CoworkerConfig.tsx` 六段、`CoworkerDetail.tsx`、`thylas:coworkers:v1` 形状、`createCoworker()` 签名、后端（无 Coworker 表 / 无 API） |
| 不做 | WAM、头像生成管线、自然语言生成 Blueprint、假进度、不可编辑的隐藏 prompt、改不了行为的控件 |

**硬约束**：`IDENTITY-RESPONSIBILITIES.md §2`（职责是结构化可见配置，不是隐藏 prompt）；`CONFIGURATION.md §7`（"A dropdown that changes nothing is a lie"）；`ENGINEERING-STANDARDS.md §1`（URL 只在 `src/lib/routes.ts`）；`AGENT.md §1.4`（保留不确定性）。

---

## 1. 现状（核到行号）

| 环节 | 事实 | 证据 |
| --- | --- | --- |
| 入口 | `/coworkers` 右上 `Create Coworker`，空态里也有一个 | `CoworkerDirectory.tsx:68, 115` |
| 页面 | `/coworkers/new`，一个 `<form>`，标题 `Create a coworker`，副标题 `Configure the rest later.` | `CoworkerNew.tsx:35-42` |
| 字段 | Name（必填）、Description、Responsible for（必填文本域）、Not responsible for、What good output looks like、Initial workspace | `CoworkerNew.tsx:57-134` |
| 可提交 | `ready = name.trim() !== '' && forWork.trim() !== ''`；按钮 `Create coworker` 旁注 `created as active in this browser` | `CoworkerNew.tsx:23, 137-140` |
| 提交 | `createCoworker()` 一次写入 → `navigate(routes.coworker(created.id))` | `CoworkerNew.tsx:43-55`、`state/coworkers.ts:183-211` |
| 记录 | id / name / description / `status:'active'` / 三段职责 / 可选 membership / `pinnedArtifactIds:[]` / `mindFramework: defaultMindFramework()`；写 `added` + log `Created <name> — active, N membership(s).` | `state/coworkers.ts` |
| 落地 | 工作页：真实 `ChatCore` + Current Work 空态 + Artifacts + Workspaces + Activity | `CoworkerDetail.tsx` |
| 数据 | 只在浏览器 `thylas:coworkers:v1`，无表、无 API、无运行时 | `IMPLEMENTATION.md`、`AUDIT.md` |
| e2e | 两条创建断言：`creation lands on the working interface as active`、`the directory reflects the created coworker`；靠同一页 `fillAria('Coworker name')` + `click(byText('button','Create coworker'))` | `scripts/ui-checks.mjs` 创建段 |

---

## 2. 可复用的现成向导（不要新造）

`src/pages/user/ProfileInit.tsx` 已经是 5 步向导，`docs/development/profile/IMPLEMENTATION.md` 记录其验收：

| 范式 | 位置 |
| --- | --- |
| `type Step = 'intro' \| 'sources' \| 'discovering' \| 'review' \| 'complete'` + `useState<Step>` | `ProfileInit.tsx:22, 44` |
| `<ol className={p.steps} aria-label="Progress">`，`aria-current="step"`，`.stepOn` | `:128-132`、`profile.module.css:2-16` |
| 每步 `<section data-profile-step="...">` | `:138, 158, 205, 220, 263` |
| `Skip for now`、错误 `<p role="alert">`、真实状态无假进度 | `:122-124, 134`、profile CSS `.error` |
| 无 modal 组件（D-047），确认走 inline 或独立 Review 步 | `user-connect/AUDIT.md` |

其余复用：`components/ui.tsx` 的 `Button` / `Field` / `EmptyState`；`artifacts.module.css` 的 `form` / `formRow` / `input` / `editorBody` / `select` / `formActions`；`PlainLayout size="console"`。**不引入 wizard 库，不加路由常量。**

---

## 3. 推荐阶段设计（**Proposed**：5 步）

| # | 步骤 | 界面 | 数据 | 标注 |
| --- | --- | --- | --- | --- |
| 1 | Intention | `描述你想要的协作者` 文本框 + `从空白开始` 按钮 | 只为后续字段提供提示文案，不生成不可见 Blueprint | **不做**自然语言生成（无服务端能力，W2） |
| 2 | Identity | Name（必填，占位 `Protocol Reviewer`）、Description（`One line someone else can understand`）、首字母色块预览 | name / description | 头像步骤 **不进 MVP**（W3 / Q-B） |
| 3 | Responsibilities | 三段：`Responsible for`（必填）、`Not responsible for`、`What good output looks like`，沿用现有占位文案 | forWork / notFor / output | 与现表单同字段，零迁移 |
| 4 | Environment | `Initial workspace` 下拉（`None for now`）+ 原句 `membership grants access — nothing is implied by creating`；下方显示 Mind Framework 6 维只读摘要与「创建后可在配置页查看」 | wsId；Mind Framework 用默认值 | **不给编辑控件**（Q-D 仍 Open） |
| 5 | Review & create | 汇总前 4 步所填内容 + `Create coworker`；`Back` 可改 | 最后一步调一次 `createCoworker()` | 提交后仍落到 `/coworkers/:id` |

- 步骤条 5 项，复用 `ProfileInit` 的 `<ol>` 写法；每步 `data-coworker-step="..."` 供 e2e 定位。
- `Skip for now` 直接跳第 5 步，保留一条快速创建路径（等价今天的填两项就提交）。
- **Deferred**：`DESIGN.md §4.1` 的第 6 步 First Encounter（真实任务 + trace）。它排在 `DESIGN.md §9.1 #5`，依赖 CollabEvent，不塞进本轮。
- 与 `DESIGN.md §4.1` 的差异：规划 6 阶段含 Intention 的 Blueprint 生成、Visual identity 生成头像、Mind & Method 可编辑；本计划全部标 Open/Deferred，只落地「分步」这件事。

---

## 4. 路由与状态

| 项 | 决定 | 理由 |
| --- | --- | --- |
| 路由 | **仍是 `/coworkers/new` 单路由**，内部 `step` state | `src/lib/routes.ts:22` 是 URL 唯一来源；不为步骤新增子路由，`routerChildren.tsx:67` 零改动 |
| 草稿 | 只放组件 state，刷新回第 1 步 | 与现在一致；**不新增 localStorage key** |
| 创建接口 | `createCoworker()` 签名与 envelope 形状不变 | 不动 store 单测与既有数据 |
| 校验 | Name + Responsible for 仍是两个必填；每步 `Next` 的 disabled 条件写进 UI | 与 `ready` 语义一致，不引入新规则 |
| 提交次数 | 只在第 5 步调一次 | 防止中途产生空白 Coworker 记录 |

---

## 5. 文件改动清单

| 文件 | 改动 | 是否新增 |
| --- | --- | --- |
| `src/pages/coworkers/CoworkerNew.tsx` | 重写为 5 步：Step 联合类型、步骤条、5 个 section、Back/Next/Skip、Review 汇总、一次提交 | 改 |
| `src/pages/coworkers/coworker.module.css` | 加 `.steps` / `.stepOn` / `.step`（照 `profile.module.css:2-16`），不跨页 import CSS module | 改 |
| `scripts/ui-checks.mjs` | 重写创建段 2 条断言；新增步骤条、Back、Skip、Review 汇总断言 | 改 |
| `docs/development/coworkers/IMPLEMENTATION.md` | 更新 Creation 一行与验证数字 | 改 |
| `docs/product/coworkers/CONFIGURATION.md §8` | 加 dated 注记：该节约束的是 **config 页** 一屏六段，创建改向导不改它 | 改 |
| `docs/development/coworkers/DESIGN.md §10` | Q-C 记入方向输入；§4.2 状态补一句「向导计划见本文件」 | 改 |
| `src/lib/routes.ts` / `src/app/routerChildren.tsx` / `src/state/coworkers.ts` | **零改动** | — |

**不新增组件测试文件**：`vitest.config.ts` 环境是 `node`，仓库未装 Testing Library。向导行为由 e2e 覆盖，纯逻辑（如 step 校验）如需单测放 `src/lib/coworkers.test.ts` 同目录。

---

## 6. 测试与验收（可观察）

| # | 动作 | 期望 |
| --- | --- | --- |
| 1 | 打开 `/coworkers/new` | 步骤条 5 项，第 1 项 `aria-current="step"`，`data-coworker-step="intention"` 可见 |
| 2 | 填 Name 与 Responsible for，逐步 Next 到第 5 步 | Review 显示所填字段原文；Back 回去值不丢 |
| 3 | `Skip for now` | 直接到第 5 步，未填字段显示「未填写」而非假值 |
| 4 | 点 `Create coworker` | 落到 `/coworkers/<id>`，标题为新名字，状态 `active`，composer 存在，目录新增一行 |
| 5 | 刷新 `/coworkers/new` | 回第 1 步，无残留草稿，且不新增空白记录 |
| 6 | 检查 localStorage | `added` 只多 1 条，log 只多 1 条 `Created …` |
| 7 | `npm run check` / `test` / `api:check` / `e2e` | 全绿；原有 12 条 Coworker 断言与 Mind Framework 配置页断言不回归 |
| 8 | `git diff --name-only src/state/coworkers.ts src/lib/routes.ts` | 空 |

---

## 7. 待拍板（不静默决定）

| # | 问题 | 推荐 | 影响 |
| --- | --- | --- | --- |
| W1 | 5 步 vs `DESIGN.md §4.1` 的 6 阶段 | 5 步；First Encounter 延后 | 决定步骤条与 e2e 数量 |
| W2 | Intention 要不要自然语言生成 Blueprint | 不做（当前创建零网络，也无服务端能力） | 若要做，需先定模型调用与可编辑展示，属另一个特性 |
| W3 | 头像是否进向导 | 不进；保留首字母色块 | Q-B 未决，`AVATAR-VISUAL-SYSTEM.md` 的生成管线无代码 |
| W4 | Mind Framework 在向导里是否可编辑 | 不；只读摘要 | Q-D 仍 Open，`CONFIGURATION.md §7` 禁止改不了行为的控件 |
| W5 | config 页六段是否也改 tab | 不动 | 超出「创建改向导」的范围 |

**Confirmed**：以上五条都还没被用户回答。本计划按「推荐」列写，实施前需一句确认；任一改动只影响对应步骤，不动骨架。

---

## 8. 实施单元（有序，一次一个）

| 单元 | 内容 | DoD |
| --- | --- | --- |
| W-1 | `CoworkerNew.tsx` 换骨架：Step 类型、5 步 section 空壳、步骤条、Next/Back；提交逻辑暂原样挂在第 5 步 | 页面能走完 5 步并提交，e2e 旧断言仍通过（可临时兼容） |
| W-2 | 把现有 6 个字段按 Identity / Responsibilities / Environment 归位，保留全部 aria-label 与占位文案 | `fillAria('Coworker name')` 等定位仍有效 |
| W-3 | Intention 文案 + Review 汇总 + `Skip for now` 快速路径 | §6 第 3 条通过 |
| W-4 | 提交收口：只在第 5 步调一次 `createCoworker()`，log 文案不变 | §6 第 4、5、6 条通过 |
| W-5 | 重写 `scripts/ui-checks.mjs` 创建段；跑 `check` / `test` / `api:check` / `e2e` | §6 全绿 |
| W-6 | 文档同步：`IMPLEMENTATION.md`、`CONFIGURATION.md §8` 注记、`DESIGN.md §10`、`PROGRESS.md`、本文件状态 | 无文档仍写「创建是单页表单」 |

**每单元单独验证，不并行开多个。**

---

## 9. 风险

| 风险 | 处理 |
| --- | --- |
| 工作树有并发 theme/texture 改动，正在改 CSS 与 `scripts/ui-checks.mjs` | 动这两个文件前先 `git diff` 看最新内容；只做精确替换 |
| e2e 端口 5180/8798/9337 曾被并发 `ui-checks.mjs` 占用；当日稍晚的并发提交记录已跑到 323/323 全绿 | 改创建段前仍先看最新 `git diff`；验证前确认端口空闲，必要时用独立 Vite/CDP 端口做局部渲染验证 |
| 无 modal 组件（D-047） | 确认对话框不做；Review 用独立步骤 |
| 改动扩散到 store / 路由 | §6 第 8 条设为硬验收；`createCoworker` 签名不变 |
| 回滚 | 主体只有 `CoworkerNew.tsx` + 少量 CSS，单文件可还原 |

---

## 10. 状态

**Planned**。本轮只交付这份计划与索引同步；未写业务代码、未改 e2e、未改路由。等用户对 §7 五条给一句确认后，从 W-1 开工。
