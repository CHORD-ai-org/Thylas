# Themes — implementation notes

**Date:** 2026-11-14 · Plan: [`themes-plan.md`](themes-plan.md) · 状态：已实施（P0–P3）

## 三套主题

| 主题 | `data-theme` | ground | 说明 |
| --- | --- | --- | --- |
| 默认 | `warm` | `#F1EBDD` | 现有米色，逐值等于原 palette（零视觉回归） |
| 黑 | `dark` | `#0A0A0A` | Grok 风格中性黑，白字，accent = 纯白反转块 |
| 白 | `light` | `#FFFFFF` | 纯中性白（非米色），黑字，accent = 纯黑反转块 |

## 机制

- `src/styles/themes.css`：三块颜色变量（ground/rail/paper/surface · ink trio · line pair · accent/accent-weak/**accent-strong/on-accent** · ok/warn/error/idle · tints/scrim · `color-scheme`）。
- `design/tokens.css` 保持冻结；`base.css` 在 tokens 之后 import themes（覆盖 tints），`html` 带 150ms 背景过渡。
- 首屏：`index.html` 内联脚本读 `thylas:user:v1 → prefs.theme`，设 `data-theme` 与 pre-ground、同步 `theme-color`；`meta color-scheme` 改为 `light dark`，由 CSS 按主题决定。
- 运行时：`src/lib/theme.ts` 的 `applyTheme()` 是唯一写入点（store 变化 → `App.tsx` 的 `ThemeEffect` 调用），避免三处逻辑打架。

## 语义与色值决策

- **primary 按钮**从硬编码 `#fdf8f1/#a9613f` 改为 token：`--accent-strong` + `--on-accent`（米色=陶土/米白；黑=白/近黑；白=黑/白）。
- 黑/白下 **accent 无彩色**（纯白/纯黑反转），与既有「accent 只做强调」的收敛方向一致。
- ok/warn/error 三套都保留低饱和语义色——失败必须可辨，不靠文字兜底。
- Boards 画布：两处 `rgba(181,111,80,…)` 高亮改 `color-mix(var(--accent))`；网格点改 `var(--ink)` 14%——白板粘纸内容色（绿/黄/粉）按计划不变。
- `.tone_live` 的暖 rgba 边框改 `color-mix(var(--accent))`。

## 入口

- User → Preferences → Theme：Warm paper / Black / White 三枚单选（`data-theme-option`）。
- 命令面板：`Theme: warm paper` / `Theme: black` / `Theme: white`。
- 持久化：`prefs.theme`（`src/lib/user.ts` 的 validated read 白名单；未知值回落 `warm`；旧 payload 无字段 = warm）。
- 本地存储（不随 displayName 上服务端——`UserPatch` 只含 displayName）。

## 测试与验收

- 单测 425/425（新增 theme 持久化/非法值回落/默认 prefs 断言）。
- e2e 320/320（新增 5 条：warm 默认值、黑切换含 `theme-color`、刷新持久化 + `aria-pressed`、白为纯中性、切回 warm）。
- build ✓；截图：`design/reference/themes/{overview-warm,overview-dark,overview-light,chat-dark}.png`。
- 暖色渗漏 grep：除白板内容色外，CSS 中已无硬编码暖色；primary 按钮 token 化。

## 已知限制

1. 不跟随系统 `prefers-color-scheme`（避免不知不觉换肤）。
2. 白板节点内容色（粘纸绿/黄/粉）不随主题——它们是内容，不是 UI。
3. 打印样式未做。
4. 主题只影响颜色：圆角/间距/字号/动效三套一致。
