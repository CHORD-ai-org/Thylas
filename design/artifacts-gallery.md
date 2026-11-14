# Artifacts Gallery + 封面系统 — 视觉规范与实施计划

**Date:** 2026-11-14 · 状态：**已实施（P1–P4）**，记录见 §8· 范围：Artifacts Library 的网格视图与 Artifact 封面
**用户定稿**：网格视图现在"没用"，改成 Gallery 感觉；封面系统照 Coworker 的做法（有机符号 + 语义底色）；封面符号用**学科符号**（数学、物理等）。

## 1. 问题（现状审计）

| 项 | 现状 | 证据 |
| --- | --- | --- |
| 网格卡片 | 220px 最小列宽、封面区仅 **96px**、内容只有一个 mono 大写 kind 词 | `artifacts.module.css:772-832` |
| 封面 | 无独立封面概念；`cardBody` 只按 kind 给底色差（`tint-hover`/`bg-app`/`tint-live`），几乎无色差 | 同上 `819-825` |
| 识别性 | 7 种 kind 里 4 种同底色；卡片之间只能靠标题区分 | — |
| Coworker 的做法 | 28px 方块 + 姓名首字母 + 4 个固定色相（`#4b6b8f/#6b8f4b/#8f6b4b/#6b4b8f`），按 id hash 选色 | `coworker.module.css:4-20` |
| kind 集合 | concept / methodology / executable / product / empirical / structural / external | `data/artifacts.ts:9-16` |

**结论**：网格缺的是"封面"这一层——没有视觉锚点，卡片只能读文字，所以看起来无用。

## 2. 封面系统定义

一张封面 = **几何符号 + 语义底色 + 状态点**。三件元素都有明确规则，不允许自由发挥。

```
┌────────────────────────────┐
│                         ●  │ ← 状态点（不写词）
│                            │
│            ◯◯              │ ← 符号：自绘 SVG，56px，描边 1.2
│                            │
├────────────────────────────┤
│ Boundary model             │ ← 名称 15px/500，单行省略
│ Where one thing stops…     │ ← summary，2 行 clamp
│ Concept · 2d ago           │ ← meta：kind · updated（不显示 author/version）
└────────────────────────────┘
```

kind 只在 meta 出现一次——封面不再重复角标，避免同一信息两处（全局文案瘦身的同一条原则）。

### 2.1 符号库（自绘 SVG，每 kind 一个）

**定稿：自绘 SVG，不用 Unicode / 字体符号。** 理由：字形依赖字体栈（缺字、跨平台粗细不一、缩放失真），而 SVG 与现有 `icons.tsx` 同一画笔规则，任何尺寸都精确。

绘画规则（与 `src/components/icons.tsx` 一致，只是画布更大）：

| 项 | 值 |
| --- | --- |
| 画布 | `viewBox="0 0 24 24"` |
| 描边 | `stroke-width: 1.2`、`stroke-linecap: round`、`stroke-linejoin: round` |
| 填充 | `fill: none`（唯一点阵节点用 `fill: currentColor`，`r ≤ 1.1`） |
| 颜色 | `currentColor`——由封面层给色，图标自身不写颜色 |
| 边距 | 图形落在 `3..21` 之内，四周至少 3 单位留白 |
| 复杂度 | ≤ 6 个图元；56px 下必须一眼可辨 |

| kind | 图形 | 语义 | 图元（24 网格） |
| --- | --- | --- | --- |
| concept | **两个交叠圆** | 概念 = 关系与边界 | `circle 9,12 r5.5` + `circle 15,12 r5.5` |
| methodology | **推导闸（⊢ 的几何化）** | 步骤与前提 | `M4.5 4.5v15` + `M4.5 12h14` + `M18.5 12l-3-3` `M18.5 12l-3 3` |
| executable | **框内运行三角** | 可执行单元 | `M3.5 6.5v11` `M20.5 6.5v11` + `M9.5 8.2l6.2 3.8-6.2 3.8z` |
| product | **等轴立方** | 交付物 / 构件 | 六边形 `M12 3.2l7.6 4.4v8.8L12 20.8 4.4 16.4V7.6z` + `M4.6 7.8L12 12l7.4-4.2` + `M12 12v8.6` |
| empirical | **坐标 + 观测点** | 测量与推断 | `M4 4v16h16` + 三个 `circle r1.1`（`8,15` / `12.5,11.5` / `17,7.5`） |
| structural | **格架** | 拓扑 / 结构 | 方形 `M4 4h16v16H4z` + `M4 12h16` `M12 4v16` + 四角节点 `circle r1.1` |
| external | **出框箭头** | 外部引用 | `M13 3.5h7.5V11` + `M20.5 3.5L11 13` + `M18 14v5.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10` |

- **白名单**：`cover.symbol` 只接受 `ArtifactKind` 里的 7 个 id，渲染层查表；未知值忽略并回退到该 artifact 的 kind。
- **无缺字风险**：SVG 字符串常量，不经过字体栈；`aria-hidden`，不参与可读名。
- 符号不参与语义判断：它标识"这是哪类工作"，不表示难度或质量。
- **唯一出处**：图形只写在 `src/pages/artifacts/ArtifactCover.tsx` 的一张表里。其它地方要用封面（详情页、搜索结果、Coworker 引用）必须复用该组件，不得复制路径。

### 2.2 色相（6 个，三主题各自定义）

在 `themes.css` 增加 6 个中性偏冷的 hue token，warm/dark/light 各一套；封面底色与符号色都由 hue 派生，**不新增硬编码颜色到组件**。

| 名称 | warm（低饱和纸感） | dark（近中性） | light（中性亮） |
| --- | --- | --- | --- |
| `--cover-blue` | `#5B7794` | `#7E9BC4` | `#4C6E93` |
| `--cover-green` | `#5F7A5A` | `#86A886` | `#4F6E4A` |
| `--cover-clay` | `#9A6B52` | `#C08A6E` | `#8A5B44` |
| `--cover-violet` | `#6E6488` | `#9C92C4` | `#605580` |
| `--cover-teal` | `#4F7A78` | `#79ABA8` | `#416966` |
| `--cover-amber` | `#96783F` | `#C6A55E` | `#82672F` |

派生规则（组件 CSS 只用这两条）：

```css
.cover { background: color-mix(in srgb, var(--cover) 13%, var(--bg-surface)); }
.coverGlyph { color: color-mix(in srgb, var(--cover) 70%, var(--ink)); }
```

- **选色规则（实施后修订）**：纯 id hash 把 7 个种子压到 3 个色相上，视觉上像同一张卡。改为 **kind 锚点 + id 位移**：`index = (kindIndex + hash(id) % 3) % 6`。7 个种子落在 5 个色相上，同 kind 的 artifact 仍可在三格窗口内变化。显式指定时以用户选择为准。
- external 例外：符号固定出框箭头，hue 照常派生（跟随来源系统是后续）。
- 对比度：符号对封面底 ≥ 4.5:1；三主题截图目检通过（见 §8）。
- 13% 而非 11%：11% 在 warm/white 下几乎看不出色差，13% 仍属纸感范围。

### 2.3 尺寸与排版

| 项 | 值 |
| --- | --- |
| 封面比例 | 16:10；高度 `clamp(128px, 15vw, 168px)`（`aspect-ratio` 兜底） |
| 符号尺寸 | `clamp(40px, 4.4vw, 56px)`，居中，`opacity: .92` |
| 角标 | 状态点 6px，距边 12px（不写 kind，见 §2） |
| 圆角 | 卡片 12px；封面与卡片同圆角，内描边 `inset 0 0 0 1px color-mix(var(--ink) 8%)` |
| hover | 边框 `--line-strong`；符号 `translateY(-1px)`（`prefers-reduced-motion` 关闭） |
| 不用 | 渐变、投影、彩色徽章堆叠、作者头像 |

## 3. Gallery 布局规范

- 网格：`repeat(auto-fill, minmax(240px, 1fr))`，`gap: 16px`；列数断点：≥1400 → 4，1024–1400 → 3，720–1024 → 2，<720 → 1。
- 卡片结构（固定顺序）：封面 → 名称（单行省略）→ summary（2 行 clamp）→ meta（kind · updated + 状态点）。**不显示** version / relations / author（细节页有）。
- 默认视图：Gallery；列表视图保留（高密度浏览，含 kind chip/status/updated 三列）。
- 空态：整宽卡（与 Compute Running instances 同语法），一句 "No artifacts yet." + 创建链接。
- 悬停/焦点：整卡是可点区域（`<a>`），`focus-visible` 与 hover 同态；封面符号不随 hover 变色（只位移 1px）。
- 密度：Gallery 一屏目标 6–9 张卡（1440×900）。

## 4. 数据模型（向后兼容）

```ts
// data/artifacts.ts（Artifact 可选字段）
cover?: {
  symbol?: ArtifactKind;  // 白名单 id，缺省 = 该 artifact 的 kind
  hue?: CoverHue;         // 'blue'|'green'|'clay'|'violet'|'teal'|'amber'，缺省按 id hash
};
```

- `thylas:artifacts:v1` 的 validated read 忽略未知字段 → 旧数据天然兼容；新字段缺失时全部自动派生。
- 新建页（`/artifacts/new`）增"Cover"一行：6 个 hue 圆点 + 符号预览（可换 kind 候选），**可选**，不阻塞创建。
- 外部 artifact：默认 `⧉`，不提供符号选择（来源符号化是后续）。

## 5. 实施阶段

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P0 | 本规范定稿（SVG 符号表/色相/尺寸/断点） | 用户确认（**已定：自绘 SVG**） |
| P1 | `themes.css` 6 hue tokens；`src/lib/cover.ts`（hash、白名单、派生）；`ArtifactCover` 组件 | 单测：hash 稳定性、白名单拒绝、hue 覆盖；三主题截图 |
| P2 | Gallery 替换现有 `cards`（封面 + 名称 + summary + meta），设为默认视图；列表视图保留 | 截图 1440/1024/720；e2e `data-artifact-card` |
| P3 | 新建页 Cover 选择（色相 + 符号预览，可选）+ store 字段 + 校验 | 创建带/不带封面两条路径；旧 payload 兼容单测 |
| P4 | 文档收尾 + PROGRESS | tsc / vitest / build / e2e 全绿 |

## 6. 硬关卡与风险

1. **不破坏既有 e2e**：创建/搜索/筛选断言全部保留；视图选择器从 `data-artifact-row` 改为 `data-artifact-card`（Gallery 默认），并保留一条列表视图断言。
2. **符号一致性**：封面 SVG 与 `icons.tsx` 同一画笔（1.2 描边、圆头），但画布 24——不得混用 16 网格路径导致视觉粗细不一。
3. **色彩克制**：6 hue 只在封面出现；kind chip/status 保持现有中性样式，避免"彩色卡片墙"。
4. **warm 零回归**：列表视图与详情页不动；新增 hue token 不影响任何既有取值。
5. **可访问性**：封面 `aria-hidden`；链接可读名 = `${name}, ${kind}, ${status}`；对比度抽样。
6. **性能**：内联 SVG，无图片请求；7 个图形常量，不引入图标字体/图标包。

## 7. 未决

1. ~~符号风格~~ → **已定：自绘 SVG**（2026-11-14，用户拍板）。规范见 §2.1。
2. ~~是否允许用户自选符号~~ → **已定：首发只选色相，符号固定按 kind**（符号=工作类型，不该被随手换；要做需先有「跨 kind 借用符号」的产品理由）。
3. ~~Gallery 是否显示 status 文案~~ → **已定：只放状态点**，文字在 meta 的 kind 旁不重复。
4. 外部 artifact 是否显示来源 logo（Notion/Linear 等），涉及商标与授权。
5. 是否给 Gallery 加"按 kind 分组"（像 Connect 的区块）——建议首发不做，用筛选 chips。

## 8. 实施记录（2026-11-14）

| 项 | 落地 |
| --- | --- |
| 符号 | 7 个自绘 SVG，全部在 `src/pages/artifacts/ArtifactCover.tsx` 的 `GLYPHS` 表里：交叠圆（concept）/ 推导闸（methodology）/ 框内三角（executable）/ 等轴立方（product）/ 坐标+观测点（empirical）/ 格架（structural）/ 出框箭头（external）。24 网格、1.2 描边、圆头圆角、只有点阵用 fill |
| 色相 | `themes.css` 三套 × 6 个 `--cover-*`；封面只写 `--cover: var(--cover-<hue>)`，底色与符号色由 `color-mix` 派生，组件无硬编码颜色 |
| 派生 | `src/lib/cover.ts`：FNV-1a → `(kindIndex + hash % 3) % 6`；`sanitizeCover` 白名单过滤，未知值直接丢弃 |
| Gallery | `ArtifactLibrary` 默认视图改为 Gallery（`data-artifact-gallery` / `data-artifact-card`）；封面 → 名称 → summary（2 行 clamp）→ `kind · updated`；状态只用一个 6px 点 |
| 列表 | 保留，头部切换按钮（`List view` / `Grid view`）仍在；`data-artifact-row` 未改 |
| 新建 | 可选 Cover 行：小封面预览 + `Auto` + 6 个色点（`data-cover-hue-option`），不阻塞创建；`createArtifact` 接受 `cover`，store 读取时再校验一次 |
| 测试 | `src/lib/cover.test.ts` 10 条（hash 稳定、白名单、派生、覆盖）；`artifacts.test.ts` +2（封面持久化、非法 hue 被丢但 artifact 保留）；e2e +2（封面白名单与色相分布、SVG 结构与无文字回退），并补一条列表视图断言 |

**验证**：tsc 干净 · vitest **507/507** · build ✓ · e2e **331/331**。

**截图**：`design/reference/artifact-gallery/gallery-{warm,dark,light}.png`、`gallery-{1024,720}.png`、`new-cover-picker.png`。

**没做（有意）**：按 kind 分组、来源 logo、符号选择器、封面图上传——都在 §7 或超出本次范围。封面是本地派生值，刷新即还原，没有任何服务端写入。
