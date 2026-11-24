# 08 · Artifact/项目 详情页 — 执行方案

**Date:** 2026-11-24 · **Status:** [P] 执行拆解（设计 = 创始人截图两张："Articraft详情页面规划"）。
**上游**：05-execution-plan（P0 骨架 ✅、P1 项目地图 ✅、P2 项目桌面未做）、03-design-proposal（四区桌面）、P0 已落三表（projects/project_connections/project_members，`schema.ts:96-150`）+ `/api/projects` + 连接健康探针。
**纪律**：无假控件、文字预算（05 §修订②）、e2e ≥371 不回退。

---

## 1. 设计解读（截图元素清单）

| 元素 | 截图批注 | 读出的语义 |
|---|---|---|
| 缩略图 + 名称 + 快速链接 | — | 项目身份头（头图/名字/快捷 URL 条） |
| 工具栏：🔍 / 📄 / 🔗 | "连接选项是用来管理项目的 github、Cloudflare……" | 项目内搜索 / 文档 / **连接管理**（多连接器） |
| **Brief Info** | "这里只展示最关键的信息" | 一页纸摘要，禁冗余 |
| 下一步我们干些什么？ | (generated cue) ×2 + Ask anything 输入框 | **AI 生成的下一步提示** + 对话入口 |
| Coworker 区 | "这一个是指给coworker的"（Elarie/Dolly 头像） | 成员/指派（project_members） |
| 自定义组块区域 | 网格块（一块高亮/一块选框） | 用户可配置的组块画布 |
| 右栏 Files \| Changes | "change 不是 Git 记录，而是语义总结"；worktree 树 + 分支名 | **worktree 浏览器**：文件树 + 变更的语义摘要 |
| Sidebar | "这里默认的是收缩状态"（独立截图） | 页面自带侧栏，默认收起 |

## 2. 与 P0–P4 的关系（一处修订，需拍板）

03-design-proposal 曾写"单击=进入项目桌面：**不是详情页**"。本设计**就是详情页**（身份头 + Brief + 组块 + worktree）。两种读法：

| | 读法 | 含义 | 影响 |
|---|---|---|---|
| **a** | 详情页**取代** P2 桌面（推荐先做） | C2 空间降级为组块之一或后续入口；P2 路由让给本页 | P2-2 四区布局按本截图重排 |
| b | 详情页与桌面**并存** | 详情=概览/工作台，桌面=空间整理；顶栏加"打开桌面" | 两个表面，成本高 |

**推荐 a**（修订 03）：worktree/changes/cue 是项目日常主入口，空间是整理动作——先有工作台，空间后置。**[Q1 待创始人确认]**

## 3. 映射表（元素 → Thylas 落点 → 现状）

| 元素 | 落点 | 现状 |
|---|---|---|
| 路由 + 骨架 | `/w/:wsId/p/:projectId`（P2 原路由）+ 四区布局 | 路由未建；`Projects.tsx` 仅地图 |
| 缩略图/名称 | `projects` 行（name）+ 连接 repo 首字母/cover | P0 表已有 |
| 快速链接 | 项目 links（复用连接 locator？或新字段） | **[Q2]** |
| 工具栏 🔗 连接 | 复用 P1 **连接抽屉**（local-folder + github-repo + 健康度）；cloudflare = 新连接器 | ✅ 已落 |
| 工具栏 🔍 | 项目内搜索（files.project_id 过滤 + notes） | files.project_id ✅ |
| 工具栏 📄 文档 | 项目文档区（组块的一种？或独立 tab） | **[Q3]** |
| Brief Info | `projects.summary` + 关键状态（连接健康/最近变更） | summary 字段待核/补 |
| generated cue | 真实编排：`/api/ai` + 项目上下文（THINKING 拍板）→ cue 卡 | 无；AI 端点 ✅ |
| Ask anything | 对话抽屉入口（P2-3 计划：⌘J / 抽屉） | ChatCore ✅ 可复用 |
| Coworker 区 | `project_members`（role）+ Coworker 最小实体（P4-0 垫层） | 表 ✅ / 实体 ❌ |
| 自定义组块 | 组块系统 v0（见 Q4） | 全新 |
| Files 树 | 连接解析的 worktree 树（local-folder 直读 / github API） | P0 解析探针 ✅ |
| Changes 语义总结 | agent 对 diff 生成语义摘要（非 git log） | 全新（真实 diff→/api/ai） |
| Sidebar 收缩 | 页面级侧栏，默认收起 | **[Q5]** |

## 4. 前置决策（推荐默认，改一句即变）

| # | 决策 | 推荐默认 |
|---|---|---|
| Q1 | 详情页 vs 桌面 | **a：详情页即项目主表面**，C2 空间后置为组块/入口 |
| Q2 | 快速链接是什么 | 连接的 locator 快捷跳转条（repo/文件夹直达），不建新表 |
| Q3 | 📄 文档 | = 组块区的文档型组块 v1，不建独立页 |
| Q4 | 自定义组块 v0 | 三种：**文本块 / 链接块 / 材料块**（拖动排布，复用 boards 卡语法）；不做自由嵌套 |
| Q5 | Sidebar | 页面右栏（Files\|Changes）**默认收起**、点工具栏展开；截图 2 按此读（若指别的栏，翻案成本低） |
| Q6 | generated cue 机制 | 真实 `/api/ai` + 项目 summary/最近变更做上下文；无 key 时 disabled+理由，**不缓存假 cue** |

## 5. 执行单元

### P0 详情页骨架（可看可点）
- **P0-1 路由 + 四区骨架**：`/w/:wsId/p/:projectId`；顶栏（缩略图/名称/快速链接/工具栏三钮）+ Brief Info + 组块区占位 + 右栏占位。改动：`routerChildren.tsx`、`routes.ts`、新 `src/pages/projects/ProjectDetail.tsx`。验收：e2e 进页、四区在、URL 可回退。
- **P0-2 连接管理接线**：工具栏 🔗 → 现有连接抽屉（P1 落的）；cloudflare 连接器**只留 disabled+理由**（无假控件）。验收：从详情页能开抽屉、健康度显示。
- **P0-3 右栏 Files 树**：读连接解析结果渲染 worktree 树（复用 `Files.tsx` 树语法）；未连接→空态一行（文字预算）。Changes tab 先放**诚实占位**（"变更摘要待接"）。验收：local-folder 连接的文件夹出树。
- **P0-4 Ask anything 入口**：输入框 + ⌘J 唤起对话抽屉（P2-3 预留形态；先接 ChatCore dock）。验收：输入进对话、抽屉收起排布不动。

### P1 能力（真实语义）
- **P1-1 generated cue**：cue 卡生成（`/api/ai` + 项目上下文，Q6）；两条刷新按钮。验收：有 key 出真 cue、无 key disabled+理由。
- **P1-2 Coworker 指派**：成员区（project_members + P4-0 最小实体：id/名字/头像）；添加/移除成员。验收：指派持久、详情可见。
- **P1-3 自定义组块 v0**：文本/链接/材料块 + 添加/删除/拖排布（Q4）。验收：块增删排布持久（本地 store，envelope 模式）。
- **P1-4 Changes 语义总结**：真 diff（连接 repo）→ `/api/ai` 出语义摘要列表（"改了什么、为什么"）；标注模型与时间。验收：改动真实、非 git log 罗列。
- **P1-5 项目内搜索 🔍**：files.project_id + 名称/内容过滤，结果跳详情。

### K 随手
- 文字预算走查（05：空态一行、解释进 tooltip）；lint 既有 5 errors 顺手清。

## 6. 硬关卡（每单元收口）
tsc ✓ / vitest 全绿 / build ✓ / e2e ≥371 不回退 / lint 无新增 / 行号证据 / 无假控件（cue/摘要/连接器未接线一律 disabled+理由）/ 种子标注 sample。

## 7. 排序

```
P0-1 → P0-2 → P0-3 → P0-4（骨架成立）→ P1-1 + P1-2（页面“活”起来）→ P1-3 → P1-4 → P1-5
最快见效：P0-1..4（一屏可演示）→ P1-1（cue 真生成）→ P1-4（Changes 语义总结，设计的灵魂点）。
```

## 8. MVP 验收（整体）
打开项目详情页：顶栏身份 + Brief 一行 + cue 两条（真生成）+ 成员头像 + 组块区可增删 + 右栏 worktree 树与 Changes 语义摘要 + ⌘J 对话。e2e 全绿。
