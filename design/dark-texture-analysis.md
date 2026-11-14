# Dark 模式质感分析（对照 ChatGPT）

**Date:** 2026-11-14 · 对象：`[data-theme='dark']` · 状态：**分析已完成，P0–P2 已实施**（P3 彩色落点未拍板，保持无彩色）

> **证据边界（必须说明）**：ChatGPT 的 dark 界面截图这次没有拿到——chatgpt.com 被 Cloudflare 挡在 headless Chrome 外（Turnstile + IP 拦截），你此前提供的三张真实截图（对话页/插件页/资料库）是浅色态。所以本文的"GPT 手法"来自：①那三张截图里可验证的层级/边框/密度手法；②`design/reference/chatgpt/STYLE-GUIDE.md` 的规格；③GPT/Grok dark 的公开设计语言。**我们的现状**则是可证的：token 值 + 现有 dark 截图（`design/reference/themes/overview-dark.png`、`chat-dark.png`）。

---

## 结论先行

我们的 dark 不是"风格不同"，而是**几个物理层面的值没做完**：阴影还是暖棕色、边框是实色灰、明度只有两档、白块过大、hover 太弱、材质全实色、文字靠亮度硬拉。质感 = 这三件事的组合：**明度阶梯 + 半透明 hairline + 双层阴影**。我们三项都缺。

## 逐条根因（按感知影响排序）

### 1. 阴影 token 仍是暖棕色 —— 硬 bug

`design/tokens.css:72-73`：
```css
--e1: 0 1px 0 rgba(73, 54, 38, .06);   /* 棕 */
--e2: 0 8px 24px -12px rgba(73, 54, 38, .25);
```
`--e1/--e2` 被 boards、palette、shell 的浮层使用（`boards.module.css:312/322/558/606/658`、`palette.module.css:18`、`shell.module.css:545`）。dark 下这些阴影**是棕色的**——在 #0A0A0A 上要么看不见，要么是一团脏棕。这是"廉价感"最直接来源：浮层与背景分不开。

**GPT 手法**：dark 阴影是纯黑 + 低透明，并且**永远配一条 1px 半透明白描边**（`0 0 0 1px rgba(255,255,255,.06), 0 8px 24px rgba(0,0,0,.5)`）——描边负责"贴边"，黑阴影负责"离地"。
**修法**：`--e1/--e2` 进 `themes.css` 三套；dark 用 `0 0 0 1px rgba(255,255,255,.06), 0 10px 30px rgba(0,0,0,.45)`。

### 2. 边框是实色灰，数学上就"画死"了

| | 值 | 对底色 | 对比 |
| --- | --- | --- | --- |
| 我们 `--line` | `#242424` | `#141414`（surface） | **1.19:1** |
| 我们 `--line-strong` | `#3A3A3A` | `#141414` | 1.5:1 |
| GPT dark 边框 | `rgba(255,255,255,.10)` | 叠在任意层上 | ~1.35:1，但**透出底色** |

数值接近，观感差很多：实色灰在黑底上"发灰、发脏"；半透明白会跟着下层亮度变化，边界更细腻。全站 `inset 0 0 0 1px var(--line)` 的伪边框（`grammar.module.css:129`、`shell.module.css:126/206/409/529`）在 dark 下尤其明显——它们看起来像"画上去的线"，而不是面板自身的边缘。

**修法**：dark 的 `--line: rgba(255,255,255,.085)`、`--line-strong: rgba(255,255,255,.14)`；light 同理用黑色透明。CSS 变量直接存 rgba 即可，无需改任何消费方。

### 3. 明度只有两档，卡片浮不起来

| 层 | 我们 | GPT dark 典型 |
| --- | --- | --- |
| ground | `#0A0A0A` | `#212121`~`#0A0A0A` |
| surface | `#141414`（+10 级） | 比 ground **+8~14 级** |
| elevated（popover/menu） | **不存在** | 再 +6~10 级 |
| rail | `#0E0E0E`（介于两者） | 与主区同底或略暗 |

我们 rail `#0E0E0E` 插在 ground 和 surface 中间，视觉上 rail 成了一条"沟"（截图里左侧像被压下去）。而 popover 没有第三档明度，只能靠（棕）阴影分离。

**修法**：加 `--bg-elevated`；rail 与 ground 同底（`#0A0A0A`）只留 hairline；surface 提到 `#161616`；elevated `#1E1E1E`。

### 4. accent = 纯白 → 大块纯白，刺且无体温

dark 截图里 "New conversation" 与 send 圆钮是**满白块**——对比 21:1，眼睛先被按钮吸走，而且整屏没有任何彩色落点（全灰），像没上色的线框稿。

**GPT 手法**：dark 的 primary 是 `rgba(255,255,255,.12)` 底 + 白字（按钮"融"在界面里，靠文字与 hover 辨识）；彩色只出现在极小面积（链接、选中项）。
**修法**：`--accent-strong: rgba(255,255,255,.14)`、`--on-accent: #F2F2F2`（hover 到 .2）；send 圆钮保留纯白（小面积、功能性），与 primary 拉开层级。

### 5. hover / active 太弱，界面"不回应"

`--tint-hover: rgba(255,255,255,.045)`——黑底上增亮 4.5%，几乎不可见；GPT 的 hover 是 `.06~.08`、active `.10`，且行高亮同时改变边框/文字。
**修法**：hover `.07`、active `.10`；列表行 hover 额外用 1px 左缘 accent 或 `--line-strong` 描边（现有 grammar 可复用）。

### 6. composer 与 header 没有材质

GPT dark 的输入区/顶栏是半透明 + `backdrop-filter: blur(12px)`（或至少底色差 + 顶部 1px 内高光 `rgba(255,255,255,.06)`）。我们是纯实色面板 + 一条实色分隔线——边缘是"切"出来的，不是"叠"出来的。
**修法**：composer/panel/rail 在 dark 加 `background: color-mix(in srgb, var(--bg-surface) 86%, transparent)` + `backdrop-filter: blur(12px) saturate(1.1)`；边框改半透明白。**只 dark 生效**，warm 保持纸感。

### 7. 文字层级靠亮度硬拉，字重/字距没有 dark 版

| | 我们 | 对 ground 对比 |
| --- | --- | --- |
| `--ink` `#F2F2F2` | 18.9:1 | 过亮，长文发胀 |
| `--ink-2` `#A6A6A6` | 8.4:1 | ok |
| `--ink-3` `#6E6E6E` | **3.8:1** | caption 发糊（截图里 mono 标签几乎读不出） |

GPT dark 正文 `#ECECEC`、次 `#B4B4B4`、弱 `#8F8F8F`（≈5.5:1），并且**用 500/600 字重而非明度差**分层级；深底白字视觉会"膨胀"，字距通常收 `-0.01em`。

**修法**：ink 降到 `#EBEBEB`、ink-3 提到 `#8A8A8A`；ui 正文在 dark 加 `letter-spacing: -0.005em`；标题保持现有 serif 不动。

---

## 一条可复用的"dark 质感公式"

```
质感 = 3 档明度（ground 0 / surface +12 / elevated +20 级）
     + 半透明白 hairline（8% / 14%）
     + 双层阴影（1px 白 6% 描边 + 大半径黑 45%）
     + 半透明交互（hover 6-8% / active 10%）
     + 半透明材质层（composer/header: 86% + blur 12px）
     + 小面积高对比（primary 12-14% 白，而非满白）
```

warm 与 light 不需要这套（纸与白靠阴影/边框已够），**它们只补三项通用修复**：`--e1/--e2` 主题化（白底用黑低透明）、`--accent-strong` 已有、hover 略提。

## 修复清单（建议顺序）

| 优先级 | 项 | 只改 `themes.css` 值？ | 感知收益 |
| --- | --- | --- | --- |
| **P0** | 1 阴影去暖 · 2 边框半透明白 · 5 hover/active 抬升 · 7 ink-3 提亮 | 是（+ `--e1/--e2` 移入） | 最大，一次性解决"脏/平/糊" |
| **P1** | 3 第三档 elevated + rail 与 ground 同底 · 6 composer/header 半透明材质 | 是（+ 三处 `backdrop-filter` 规则） | 层次与"空气感" |
| **P2** | 4 primary 改 12% 白底（send 保持纯白）· 正文 dark 字距 | 是 | 让按钮退后、界面透气 |
| **P3（需拍板）** | 引入一个彩色落点（如 `#5B8DEF` 用于链接/选中） | 是 | "体温"；但会打破"无彩色"的 Grok 路线 |

全部改动集中在 `src/styles/themes.css`（+ `design/tokens.css` 里 `--e1/--e2` 下沉到主题层），不动布局、不动组件结构；warm/light 视觉零回归（除阴影与 hover 的通用微调）。

确认后我按 P0 落地并出三主题对比截图；若要 P3 的彩色落点，请指定一个色（或让我挑一个低饱和蓝）。


## 实施记录（2026-11-14，18:40）

| 项 | 落地 |
| --- | --- |
| 1 阴影 | `--e1/--e2` 下沉为三套主题变量；warm 保留原棕值，dark = `0 0 0 1px rgba(255,255,255,.06), 0 10px 30px rgba(0,0,0,.45)`，light = 黑低透明 |
| 2 边框 | dark `--line/--line-strong` → `rgba(255,255,255,.085/.14)`；light → `rgba(0,0,0,.09/.16)`；warm 不动 |
| 3 明度 | 新增 `--bg-elevated`（dark `#1E1E1E`）；dark rail 与 ground 同底 `#0A0A0A`，surface 提至 `#161616` |
| 4 primary | dark `--accent-strong: rgba(255,255,255,.14)`、`--on-accent: #F2F2F2`；send 小圆钮仍为 `var(--ink)`（小面积高对比） |
| 5 hover | dark tint-sel/hover/live → `.095/.07/.06` |
| 6 材质 | themes.css 新增 `.glass`（仅 dark：88% elevated + `blur(12px) saturate(1.1)` + 顶部内高光）；挂到 ChatCore header、Composer、Context popover、CommandPalette、ChatDock |
| 7 文字 | dark ink `#EBEBEB`、ink-2 `#B4B4B4`、ink-3 `#8A8A8A`（≈5.5:1）；dark body 字距 `-0.005em` |

**验证**：
- tsc ✓ · vitest 425/425 · build ✓ · e2e **322/322**（新增 `texture: dark uses translucent hairlines...`、`texture: a real composer is frosted in dark`）
- **warm 逐像素零回归**：`before-overview-warm.png` 与新截图 `cmp` 完全一致（`IDENTICAL`）
- light 仅 hairline 从实色改半透明（预期变化），截图目检无回归
- 截图：`design/reference/themes/{before-*,overview-warm,overview-dark,overview-light,chat-dark}.png`

**连带修复**：主题块在 e2e 中创建了会话，导致后续 chat 块 `empty` 断言失败 → chat 块开头清 `thylas:chat:v1`（house 惯例：每个块自己重置状态）。

**未做（需拍板）**：P3 彩色落点（链接/选中色）——保持 Grok 无彩色路线。
