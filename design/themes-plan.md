# 主题计划 — 默认米色 + 黑 + 白（三套）

**Date:** 2026-11-14 · 状态：**已实施（P0–P3）**，实现记录见 [themes.md](themes.md) · 范围：颜色/主题层，不改布局与组件结构
**用户定稿：只有三种风格 —— 默认（米色）/ 黑 / 白。**

## 1. 目标

1. **默认**：现有 Thylas 米色调，零视觉回归。
2. **黑**（`dark`）：Grok 默认态——近黑底、白字、纯中性灰阶、无彩色装饰。
3. **白**（`light`）：Grok 亮态——纯白底、近黑字、同套中性灰阶（**不是暖色**，与默认米色明确区分）。
4. 三选一切换、持久化、首屏不闪。

## 2. 现状审计（已核实）

| 项 | 事实 | 影响 |
| --- | --- | --- |
| 颜色 token | `design/tokens.css`（**冻结档案**）：`--bg-app #F1EBDD` / `--bg-surface #FBF9F4` / `--ink #493626` / `--ink-2 #927B65` / `--ink-3 #B3A08C` / `--line #E6DED1` / `--line-strong #D8CCB9` / `--accent #B56F50` / `--ok #5E6B50` / `--warn #A8792C` / `--error #8C3A2B` | 消费方全部用变量；只需覆盖变量 |
| tints | `src/styles/tokens.css` 内 4 条暖色 rgba | light/dark 都要覆盖 |
| 切换机制 | **不存在**（无 `data-theme` / `prefers-color-scheme`） | 全新 |
| 用户偏好 | `thylas:user:v1` prefs：`landing/density/defaultWorkspace`，validated read 只挑已知字段 | 加 `theme: 'warm'|'dark'|'light'`，旧 payload 缺省 warm |
| 首屏 | `index.html` 内联 `background:#F1EBDD` + `meta color-scheme=light` + `theme-color` | 需 pre-paint 脚本按存储设 `data-theme` 与底色 |
| e2e | accent 归零断言、大量 `getComputedStyle` 断言 | 新增主题断言不破坏默认态 |
| 图标 | 全部 `currentColor` | 自动跟随 |

## 3. 机制

```
<html data-theme="warm" | "dark" | "light">   （默认 warm）
  ↓
src/styles/themes.css   ← 新增：三套变量块（warm 值 = 今天现值）
  ↓
既有 CSS 全部消费 var(...) —— 组件零修改
```

- `design/tokens.css` 不编辑；`themes.css` 在 `tokens.css` 之后 import。
- 三套只覆盖**颜色类**变量；圆角/间距/字号/动效不动（几何差异会产生布局分支）。
- `color-scheme` 按主题设：warm/light → `light`，dark → `dark`（原生控件与滚动条跟随）。

### 首屏（防闪）

`index.html` `<head>` 内联脚本（<200 B）：

```js
try{var t=JSON.parse(localStorage.getItem('thylas:user:v1')||'{}').prefs?.theme;
t=(t==='dark'||t==='light')?t:'warm';
document.documentElement.dataset.theme=t;
document.documentElement.style.background=t==='dark'?'#0A0A0A':t==='light'?'#FFFFFF':'#F1EBDD';}catch(e){}
```

`<meta name="theme-color">` 由切换函数与首屏脚本同步写。

## 4. 三套 token 表

| Token | 默认 warm | 黑 dark | 白 light |
| --- | --- | --- | --- |
| `--bg-app` | `#F1EBDD` | `#0A0A0A` | `#FFFFFF` |
| `--bg-surface` | `#FBF9F4` | `#141414` | `#F7F7F7` |
| `--ink` | `#493626` | `#F2F2F2` | `#111111` |
| `--ink-2` | `#927B65` | `#A6A6A6` | `#5C5C5C` |
| `--ink-3` | `#B3A08C` | `#6E6E6E` | `#9A9A9A` |
| `--line` | `#E6DED1` | `#242424` | `#E8E8E8` |
| `--line-strong` | `#D8CCB9` | `#3A3A3A` | `#CFCFCF` |
| `--accent` | `#B56F50` | `#FFFFFF` | `#111111` |
| `--accent-weak` | `#F0E2D7` | `#1F1F1F` | `#EDEDED` |
| `--ok` | `#5E6B50` | `#8FBF8F` | `#3F6B3F` |
| `--warn` | `#A8792C` | `#D4A94E` | `#8A6A1F` |
| `--error` | `#8C3A2B` | `#E57070` | `#B3352A` |
| `--tint-sel` | 暖 rgba(181,111,80,.09) | rgba(255,255,255,.08) | rgba(0,0,0,.05) |
| `--tint-hover` | 暖 rgba(73,54,38,.035) | rgba(255,255,255,.045) | rgba(0,0,0,.03) |
| `--tint-live` | 暖 rgba(181,111,80,.055) | rgba(255,255,255,.05) | rgba(0,0,0,.035) |
| `--scrim` | rgba(73,54,38,.16) | rgba(0,0,0,.6) | rgba(0,0,0,.14) |
| `color-scheme` | `light` | `dark` | `light` |

**规则**
- 黑/白两套：**无彩色 accent** —— action 用纯白（黑底上）/ 纯黑（白底上）反转块；与既有 e2e 的 accent 收敛同向。
- ok/warn/error 在黑/白下保留**低饱和语义色**（失败必须可辨，不依赖纯文字）。
- 白 ≠ 米色：白是纯中性（#FFF/#111），米色的暖调仅属于默认主题。

## 5. 切换入口与持久化

| 项 | 设计 |
| --- | --- |
| 入口 | User → Preferences 增「Theme」行：Warm paper / Black / White 三枚单选（现有 prefs 行语法） |
| 持久化 | prefs 增 `theme: 'warm'|'dark'|'light'`；read 白名单校验，缺省 `warm` |
| 生效 | `setTheme()` 写 store + `data-theme` + `meta[name=theme-color]`（无刷新，150ms 过渡） |
| 命令面板 | `Theme: warm paper` / `Theme: black` / `Theme: white` |
| 跟随系统 | 不做（避免用户不知情换肤） |

## 6. 风险与硬关卡

1. **零回归**：warm 块逐值等于现值（含 `--tint-*`）；六页 warm 截图与基线逐像素比对。
2. **e2e**：默认按 warm 跑；新增——三主题各自 computed 值、刷新持久化、`theme-color` 同步、旧 payload 缺省 warm（单测）。
3. **首屏闪色**：脚本在 `<style>` 之前。
4. **对比度**：dark/light 下 ink/bg ≥ 7:1、ink-2 ≥ 4.5:1、ink-3 仅装饰 ≥3:1，脚本抽样。
5. **暖色渗漏**：`--tint-*`、scrollbar、`boards/scene.ts` 等 grep 全部 `#` 色值，逐个变量化或明确保留（画布内容色不随主题）。
6. 不做打印样式。

## 7. 阶段

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **P0** | `themes.css` 三块骨架（warm 值不变）+ `data-theme` 默认 warm + 首屏脚本 | warm 六页截图零差异；e2e 全绿 |
| **P1** | dark / light 完整 token + `color-scheme` + meta 同步 + tint 覆盖 | 两套截图目检 + 对比度抽样 + 无暖色渗漏 |
| **P2** | Preferences 三选一 + prefs 持久化 + 面板命令 | 切换/刷新 e2e；旧 payload 单测 |
| **P3** | e2e 新断言、文档（THEMES.md）、PROGRESS | tsc/vitest/e2e/build 全绿 |

## 8. 已定 / 仍待定

已定（用户）：三套主题 = 默认 / 黑 / 白。
仍待定：
1. 黑/白下 accent 全用反转（纯白/纯黑）——建议按计划执行。
2. Boards 画布内容色不随主题——建议。
3. 是否需要在外露位置显示主题名——建议不露，Preferences 内即可。
