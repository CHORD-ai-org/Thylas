# Notes 优化执行计划 — 可收缩 Sidebar + 全屏无边框编辑区

**Date:** 2026-11-13 · **状态：已实施（P0–P3）** · 范围仅 Notes 页
**用户需求**：左侧一个可收缩的独立 sidebar，选项为 **文件 / 搜索 / 书签**；右侧编辑区全屏无边框，像 Obsidian。

## 1. 审计结论（现状事实）

| 项 | 现状 | 代码 |
| --- | --- | --- |
| 页面结构 | `TabStrip` 顶栏 + `.body` flex：左 `.list` 236px + 右 `.readerWrap` | `src/pages/Notes.tsx` §return、`notes.module.css` 1–15 行 |
| 左侧栏 | **单个混合列表**：Notes 标题 + New + 搜索框 + scopes chips + 笔记行 + foot；无功能切换、无收缩 | `Notes.tsx` 236–308 行 |
| 右编辑区 | `.reader` 有 `bg-surface` 卡片底、`40px 44px 96px` padding、`max-width: var(--w-read)`；视觉是一张纸/卡片，不是全屏文档 | `notes.module.css` 115–135 行 |
| 搜索 | 已有：debounced 200ms、标题+正文匹配、scope 过滤、empty state | `Notes.tsx` 42–80 行 |
| 书签 | **不存在**，无 store、无数据 | — |
| 状态 | `thylas:notes:v1`（notes 本体 + scope）；自动保存 800ms、版本号冲突检测、脏标签、TabStrip、ContextPanel | `src/state/notes.ts`、`Notes.tsx` |
| 测试 | notes 相关 e2e 19 条（打开/编辑/保存/重载/Esc/脏标签/搜索正文/空态/方向键…）+ 全量 302/302 | `scripts/ui-checks.mjs` 617 行起 |

**差异**：现有左侧栏是"文件列表 + 搜索"揉在一起，不是可收缩的三选项 sidebar；右区是带底色的纸片，不是 Obsidian 式"页面即文档"。

## 2. 目标信息架构

```
┌──┬──────────────────┬────────────────────────────────────────────┐
│功│ 文件 / 搜索 / 书签│  编辑区（全屏、无边框、页面即文档）        │
│能│ 当前选项的面板    │  内容居中可读列 ≈700px，背景 = 页面        │
│条│ 236px · 可收缩    │  阅读/编辑同布局，工具条 hover 出现        │
│56│ ← 收缩仅收面板，  │  TabStrip 顶栏保留；ContextPanel 默认折叠  │
└──┴──────────────────┴────────────────────────────────────────────┘
```

- **功能条**（56px icon rail）：3 个 icon + label（Files / Search / Bookmarks），active 深底块（GPT 侧栏词汇）。
- **面板**：随功能条切换；**收缩** = 面板宽→0（功能条保留），状态持久化在 `thylas:notes-ui:v1`（宽度/上次选项），键盘 `⌘/Ctrl+\` 切换（对齐 Obsidian 习惯）。
- **编辑区**：去掉 `.reader` 的卡片底和四周留白壳；内容列居中；CodeMirror 背景透明、去边框（`.cm-editor` 相关样式在 `chat/editor` 或 `notes/NoteEditor`）。

## 3. 三个选项的明确定义

| 选项 | 内容 | 复用 |
| --- | --- | --- |
| **文件** | 现有笔记列表 + scopes chips + New（命名/范围逻辑不动）；行仍带 `data-note-row` | 现成 `visible` 过滤 + `onListKeys` 方向键 |
| **搜索** | 独立视图：全宽胶囊搜索（复用 debounced 逻辑）+ 结果行（标题 + 命中片段 + scope），点击打开；空态文案保留 | `query/debounced/needle`、`emptyMessage` |
| **书签** | 新能力：笔记可加星/取消星，面板列出已加星笔记；空态「还没有书签」；行可打开 | 新 store（见 §5），笔记行组件复用 |

**诚实边界**：书签只存本浏览器，不声称同步；搜索仅本地 notes 正文（现有行为），不声称全文索引。

## 4. 全屏无边框编辑区（Obsidian 化）

1. `.readerWrap` 保持 `flex:1` 滚动；`.reader` 去 `background`、`padding` 壳改 `padding: 32px 24px 120px`、`max-width: 760px; margin: 0 auto`（列居中，非卡片）。
2. 阅读与编辑**同一容器**，切换只换内容组件——消除"编辑时换皮"。
3. 标题/meta 保留，meta 降为 caption；`readerTools`（Edit / Done）改为 hover 出现的轻操作（保留 `aria-label` 与可发现性——键盘 focus 时可见）。
4. CodeMirror：背景透明、去 outline/border、光标/选区沿用现有 token；`[[` 链接补全保留。
5. 冲突条、脏标签、自动保存逻辑 **零改动**（P0 风险区，不动）。

## 5. 书签数据（最小新增）

- 独立 envelope `thylas:bookmarks:v1`（`{version:1, ids:string[]}`），**不动 `thylas:notes:v1` 契约**；validated read（丢坏 id、丢弃已删笔记）、上限 200。
- store：`src/state/bookmarks.ts` + 单测（增删、重载、坏 payload、tombstone 笔记）。
- 入口：笔记行 hover 星标 + 阅读/编辑头工具条星标；两处共用同一 action。

## 6. 硬关卡 / 兼容清单（实施前必须守住）

1. e2e 19 条 notes 断言依赖：`data-note-row`、`aria-label="Search notes"`、`aria-label="Note title"`、编辑器 accessible name、`[role="tab"]`、空态文案、方向键顺序——**全部保留**（搜索默认仍可直达；功能条切换不得让"搜索"消失于默认视图）。
2. `TabStrip`、`ContextPanel`、`useRegisterTab`、脏标签 beforeunload、冲突「Keep mine / Load theirs」流程不动。
3. `notes:v1` 数据契约不动；书签另开 key。
4. 响应式：<900px 面板默认收起，编辑区全宽；功能条保留。
5. 文案保真原则：不删已有可见文案（上一轮 GPT 化曾触发 e2e 漂移）——新增 label 才有新文案。

## 7. 执行阶段

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **P0** | 功能条 + 面板切换（文件/搜索先占位为书签空壳）+ 收缩状态持久化 | tsc、notes 19 条 e2e 全过、截图 |
| **P1** | 编辑区全屏无边框（reader/editor 同容器、CodeMirror 透明化） | 阅读/编辑两态截图、编辑流程 e2e 全过 |
| **P2** | 搜索独立视图 + 书签 store/入口/空态 | 书签单测、搜索正文命中 e2e 全过 |
| **P3** | 响应式 + hover 工具 + 全量验证 + 文档收尾（本文件标「已实施」+ IMPLEMENTATION.md） | 全量 e2e 302/302、build、暗色/亮色各截图 |

每阶段完成后跑 `npm run e2e`，失败不复盖。

## 8. 未决问题（需拍板）

1. 书签是否允许跨 workspace（scope 过滤）——建议：不过滤，书签是用户级收藏。
2. 功能条是否第三个 icon 之外还要底部「设置/收缩」——建议：收缩按钮放功能条底部，设置不要。
3. ContextPanel（右详情）默认折叠还是彻底从 Notes 移除——建议：默认折叠保留入口，Obsidian 全屏感更好。
4. 编辑区列宽 760px 是否合适（现 `--w-read`）——实施后用截图目检再定。


## 9. 执行记录（2026-11-13）

| 阶段 | 交付 | 验证 |
| --- | --- | --- |
| P0 | 56px 功能条（Files / Search / Bookmarks，active 深底）+ 236px 可收缩面板；`thylas:notes-ui:v1` 持久化 view/collapsed；<900px 默认收起；快捷键 **Ctrl/Cmd+Shift+B**（Rail 的 Ctrl+\ 不冲突） | e2e 三视图/收缩/持久化 4 条 |
| P1 | `.reader` 去 `bg-surface`/`40px 44px` 壳 → 透明、padding 0、`max-width:760px` 居中列；阅读/编辑同容器；CodeMirror 本来已透明；工具条 hover 提亮（键盘 focus-within 可见） | full-bleed e2e 断言 + 截图 |
| P2 | `thylas:bookmarks:v1`（独立 envelope、validated read、上限 200）+ 6 条单测；星标入口（行 hover + 文档头）；搜索独立视图（**独立 findQuery，不串扰 Files 列表**） | 书签增删/重载 e2e + 搜索正文命中 |
| P3 | 响应式、e2e 新增 8 条、截图 3 张 | **tsc 干净 · vitest 385/385 · build 过 · e2e 310/310** |

### 新增文件

- `src/state/bookmarks.ts` · `src/state/notesUi.ts` · `src/state/bookmarks.test.ts`
- `src/components/icons.tsx`（IconBookmark）
- 截图：`design/reference/chatgpt/notes-{files,search,document}.png`

### 未决问题处置

1. 书签跨 workspace → **用户级，不过滤**（按建议）。
2. 功能条底部 → **只放收缩**（按建议）。
3. ContextPanel 默认折叠 → **未做**：e2e `aside[aria-label="Scope"]` 断言依赖其可见；面板右上 X 可手动关闭，关闭后编辑区即全屏。留待与 e2e 一起改。
4. 列宽 760px → 截图目检通过。

### 诚实边界

书签只存本浏览器；搜索仅本地 notes 标题+正文（无全文索引声明）；`notes:v1` 契约、自动保存/冲突/TabStrip/脏标签零改动。
