# 自定义入口 + 技能页 + 素材页 — 执行计划

**Date:** 2026-11-23 · **Status:** [P] 执行拆解（设计稿 = 创始人截图：sidebar 底部「自定义」→ 技能/素材 → 两个页面）。
**产品**：Thylas。截图作目标视觉参照（WorkBuddy 风格），语义按 Thylas 落。
**方式**：P0/P1/K 单元卡，硬关卡沿用（tsc ✓ / vitest 全绿 / build ✓ / e2e 不回退 / lint 无新增 / 行号证据 / 无假控件）。

## 0. 设计 → Thylas 落点映射

| 截图元素 | Thylas 落点 | 现状 |
|---|---|---|
| sidebar 底部「自定义」行 | `src/shell/Rail.tsx` nav 底部新增一项（icon+label） | Rail 已有 Overview/Recently/Compute/Connect + workspace 房间（`Rail.tsx:131+`） |
| 点击弹出「技能 \| 素材」 | popover 菜单（复用 Composer model popover 语法，`Composer.tsx:146-192` 模式） | 无通用 Popover 组件（D-047 无 modal），bespoke 即可 |
| 技能页（我的技能 + 官方目录 + 分类 + 开关） | 新页 `/skills`，全局级（不属 workspace） | **repo 零 skill 概念**——全新域 |
| 素材页（文件夹/文件缩略图网格 + 搜索 + 上传） | **改版现有 Files 页**（`/w/:wsId/files`），树+列表 → 网格缩略图视图（列表保留切换） | `Files.tsx` 树+列表；upload 未接线（Files.tsx:207 自述）；域模型现成（`types.ts:52-73`） |

## 1. 前置决策（推荐默认，改一句即变）

| # | 决策 | 推荐默认 | 影响 |
|---|---|---|---|
| Q1 | "技能"在 Thylas 的语义 | **可启用的能力模块**（"自动化重复工作"，最终挂到 Coworker/流程）；页面先行，域用本地 store，不建后端 | P0-4/5 |
| Q2 | 素材页 = 改版 Files 还是新页 | **改版 Files**（不造第二个文件库） | P0-3 |
| Q3 | "套餐锁定"6 项怎么显示 | Thylas 无计费 → **不展示锁定**，或 disabled + `title` 写明原因（无假控件） | P0-4 |
| Q4 | 「自定义」命名 | 先按设计稿叫"自定义"，导航语义 [Q] 待创始人复核 | P0-1 |

## P0 — 三件套（入口 + 两页）

### P0-1 Rail「自定义」入口 + 弹出菜单 ✅ DONE
- **目标**：Rail nav 底部一行「自定义」，点击弹出两项：**技能**（puzzle icon）/ **素材**（box icon），点击分别导航 `/skills` 与当前工作区 Files。
- **改动**：`src/shell/Rail.tsx`（底部项 + popover 状态）、`rail.module.css`、`src/components/icons.tsx`（如缺 IconPuzzle/IconBox）。
- **验收**：e2e — 点击弹出两项；技能→`/skills`，素材→`/w/:wsId/files`；键盘可达（role=menu）；折叠态只显 icon。
- **风险**：低。**独立性**：独立。

### P0-2 路由与 Tab 接入 ✅ DONE
- **改动**：`src/lib/routes.ts` 加 `skills()`；`src/app/routerChildren.tsx` 加 `{ path: 'skills' }`；`src/lib/tabs.ts` 视需要加 tab 类型（技能页可先不进 tab，同 Notes 顶层路由模式）。
- **验收**：直达 URL 可开；⌘K 命令面板加"Go to Skills"。
- **独立性**：依赖 P0-1 的导航文案可并行。

### P0-3 素材页改版（Files 升级为网格缩略图） ✅ DONE
- **目标**：文件夹/文件**卡片网格**（缩略图 + 名称 + 大小/日期），顶部搜索 + 新建文件夹 + 上传；保留列表视图切换（dense browsing，交互契约）。
- **改动**：`src/pages/Files.tsx` + `files.module.css`（网格视图）；缩略图按 `FileKind`（7 种，`types.ts:8`）出 glyph/封面（复用 `TypeGlyph`/`ArtifactCover` 的画法）；**上传接线**（`/api/files` 已存在，`server/routes/files.ts`——若 P0 内不及，按钮 disabled+理由，不假做）。
- **验收**：e2e — 网格渲染文件卡、搜索过滤、视图切换、空态；文件详情跳转不断。
- **风险**：中（动现有页，e2e 里 Files 检查需同步）。**独立性**：独立。

### P0-4 技能页（壳 + 目录 + 开关） ✅ DONE
- **目标**：`/skills` 页 = ①「我的技能」区（空态：*尚无我的技能 / 创建你自己的技能来自动化重复工作* + 添加技能）②「官方技能」区（分类 chips 过滤 + 搜索 + 卡片网格：名称/描述/开关/预览/更多）。开关**真实生效**（存启用状态）。
- **改动**：新 `src/pages/Skills.tsx` + `skills.module.css`；复用 `Chip/Button/EmptyState/SectionLabel`。
- **验收**：e2e — 空态、分类过滤、搜索、开关持久（reload 后仍在）、"全部禁用"可用。
- **风险**：低-中。**独立性**：依赖 P0-2。

### P0-5 技能域模型（本地 store） ✅ DONE
- **目标**：`src/state/skills.ts`——`Skill {id,name,description,category,source:'official'|'mine',enabled}`；种子官方目录（首批 ~12 项中文示例，标注 sample 数据）；`enabled` 状态 localStorage 持久（envelope 模式，同 `state/user.ts`）。
- **验收**：单测 — 启用/禁用/全部禁用/按分类过滤/搜索排序。
- **风险**：低。**独立性**：独立，可与 P0-4 并行。

## P1 — 完整体验

| # | 目标 | 改动 | 验收 |
|---|---|---|---|
| P1-1 | 添加技能流程（自定义技能：名称+描述+行为草稿） | 向导式 inline 面板（无 modal），产出 `source:'mine'` 技能 | e2e 创建→列表出现→可开关 |
| P1-2 | 技能详情（预览/编辑/删除）+ 卡片"更多"菜单 | 详情页或侧栏 | 增删改闭环 |
| P1-3 | 素材上传/新建文件夹真接线 | `files.ts` API 接 UI（去掉 "not wired" 声明） | 上传→网格出现→详情可预览 |
| P1-4 | 技能 ↔ Coworker 挂接（技能可指派给 Coworker） | Coworker 配置页加技能选择 | 选中持久、详情可见 |

## K — 已知问题（随时插队）
- K-a：Files 页 seed 数据假声明（`Files.tsx:207`）随 P1-3 消除。
- K-b：lint 既有 5 errors 顺手清。

## 硬关卡（每单元收口）
1. tsc ✓ / vitest 全绿（含新单测）/ build ✓ / e2e ≥361 不回退 / lint 无新增。
2. 行号证据写进完成报告。
3. 无假控件：锁定/未接线一律 disabled + 原因；种子数据标注 sample。
4. 不加依赖、不动无关代码、视觉遵守静谧计算美学（截图风格作参照，token 用现有）。

## 排序

```
P0-5（独立）──┐
P0-1 → P0-2 → P0-4 → [P1-1/2]
P0-3（独立，可并行）→ [P1-3]
最快路径：P0-1→2→4 + P0-5（技能三件套可演示）→ P0-3（素材改版）→ P1。
```

## MVP 验收（整体）
从 Rail 点「自定义」→ 弹出技能/素材 → 技能页能开/关技能并过滤搜索；素材页网格浏览文件并切列表。e2e 全绿。
