# 登录 / 注册页 — 视觉与实施计划

**Date:** 2026-11-15 · 状态：**已实施（P1–P4）**，记录见 §11· 路由：`/login`（独立于 AppShell）
**用户定稿方向**：左表单 / 右背景板；手绘线条；表单是一张可以随便拖的纸；右板黑底白字、电报体、内容是 Moonshot thinking 相关的名言。

---

## 1. 审计：先钉住三条现实

| 项 | 现状 | 影响 |
| --- | --- | --- |
| 登录页 | **不存在**。`/login`、`/signup` 均无路由 | 从零建，不迁移旧页 |
| 会话 | `src/lib/session.ts` 首行写明：**「CHORD owns sign-in. Thylas never implements password flows; it only reads a session cookie.」** | 表单不能真的验密码；只能做「视觉 + 诚实失败」或 CHORD 跳转 |
| 开发态 | 无 IdP；`thylas_session=dev:<userId>:<wsId>` 是显式 dev stand-in | 需要一个「以本地用户继续」的出口，否则页面进去就出不来 |
| 版式 | 全站走 `AppShell`（rail + 内容区）；`body{overflow:hidden}` | 登录页必须是 AppShell **之外**的兄弟路由 |
| 字体 | 自托管 Inter Variable（UI）+ IBM Plex Mono（mono，仅拉丁）+ Noto Sans SC | 「电报体」= `var(--mono)`，不需要新增字体文件 |
| 门禁 | 现在没有任何 gate，dev cookie 自动生效 | 本页是**可访问的原型入口**，不是强制登录墙 |

**结论**：这是"登录页的形态与手感"，不是认证系统的实现。计划里所有会误导的地方都标注出来（§7）。

---

## 2. 目标形态

```
┌───────────────────────────────┬──────────────────────┐
│                               │  moonshot thinking   │
│      ╭──────────────╮         │  ─────────────────   │
│      │ ≡  Sign in   │         │                      │
│      │              │         │  "The best way to    │
│      │  email       │         │   predict the future │
│      │  __________  │         │   is to invent it."  │
│      │  password    │         │   — Alan Kay, 1971   │
│      │  __________  │         │                      │
│      │  [ Sign in ] │         │  "…"                 │
│      │  Create one  │         │   — …                │
│      ╰──────────────╯         │                      │
│        ↑ 可整张拖动            │  黑底 / 白字 / 电报体 │
└───────────────────────────────┴──────────────────────┘
        62%                                  38%
```

- 左侧：暖纸底（`--bg-app`），纸片浮在上面，**默认 −0.8° 微微歪着**
- 右侧：`#0A0A0A` 固定黑（不随主题变），白字 mono，一条 hairline 分隔
- 分栏比例 `62 / 38`；`<960px` 时右板降级为顶部 152px 色带（只留一条语录），纸片不再可拖

---

## 3. 视觉规范

### 3.1 那张纸

| 项 | 值 |
| --- | --- |
| 尺寸 | `420 × auto`（min-height 520），内容撑高 |
| 底 | `--bg-surface`；无投影，只有 1px 偏移的第二道描线表示"纸有厚度" |
| 边 | **手绘不规则矩形**（§3.3），不是 `border-radius` |
| 默认角度 | `rotate(-0.8deg)`；`focus-within` 时 160ms 回正到 0 |
| 内边距 | `32px 34px`（纸上的字不贴边） |
| 握把 | 顶部 40px 条：左侧三道短横线（≡ 的变体，手绘）、标题 `Sign in`；`cursor: grab` |

### 3.2 表单本体

| 项 | 值 |
| --- | --- |
| 标题 | `Sign in`，Inter 500 20px（纸上的正文仍用 UI 字，只有右板是电报体） |
| 字段 | 标签 11px `--ink-3`；输入框**无边框**，只有一条手绘下划线（聚焦时变 `--ink`） |
| 主按钮 | 手绘描边矩形 + 实心 `--ink` 底白字？**不**——保持无彩色：描边按钮，hover 填 `--tint-hover` |
| 次要动作 | `Create an account`（切换同一张纸的注册态）/ `Forgot password?` 不做（没有后端） |
| 错误 | 纸内顶部一行 `role="alert"`，`--error` 文字 + 手绘短线 |
| 注册态 | 同一张纸：多一个 `Name` 字段，标题变 `Create an account`，主按钮变 `Create account`；**不新建第二个视觉** |

### 3.3 手绘线的实现（无依赖）

不引入 rough.js / excalidraw。写一个纯函数：

```ts
// src/lib/sketch.ts
sketchPath(points: [number, number][], seed: string, amplitude = 0.8): string
```

- 用 `mulberry32(hash(seed))` 做确定性抖动：同一 seed 永远生成同一条线（截图与 e2e 稳定）
- 规则：每条边在两端点之间插入 3 个中间点，法向偏移 ±amplitude；转角处断成独立线段（避免尖角被磨圆）
- 输出 `M…L…` 的 `d`，渲染成 `<path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round">`
- **两道描边**：seed 与 seed+'-2'，第二道 `translate(1px, 1px)`、`opacity: .35` → 手绘的"描了两遍"
- 允许手绘的只有：纸框、输入下划线、按钮框、右板的分隔线、握把三道横线。**不用**手绘箭头、涂鸦、胶带、阴影、渐变

### 3.4 电报体面板

| 项 | 值 |
| --- | --- |
| 底 | `#0A0A0A`（字面色，不跟主题变）；文字 `#F2F2F2` |
| 字体 | `var(--mono)` = IBM Plex Mono（自托管，仅拉丁）→ 中文回落到 Noto Sans SC，**不要**用手绘体 |
| 字号 | 引文 14px/1.75，`letter-spacing: .01em`；署名 11px，`opacity: .55` |
| 行宽 | `max-width: 34ch`（mono 下比 UI 字更窄才好看） |
| 引号 | 用真引号 `“ ”`，不用 ASCII |
| 排版 | 标题 `moonshot thinking` + 手绘分隔线；下面语录竖排，间距 40px，面板可滚动，**不自动轮播** |
| 反白 | 不做 `text-transform: uppercase`（与本轮"不要全大写"一致） |

---

## 4. 拖动交互

| 规则 | 值 |
| --- | --- |
| 拖动区 | **只有握把**（顶部 40px）。输入框内必须能正常选字 |
| 手势 | `pointerdown` + `setPointerCapture`；`pointermove` 用 rAF 合并；`touch-action: none` |
| 位移 | `transform: translate3d(x, y, 0) rotate(-0.8deg)`，只动 transform |
| 边界 | 纸至少留 **56px** 在视口四边内（任何方向都不能拖丢） |
| 释放 | 不吸附、不加惯性；`pointerup` 时才写入 localStorage |
| 持久化 | `thylas:login-sheet:v1` = `{ x: number, y: number }`；读取校验数字与边界，坏值回落居中 |
| 键盘 | 握把是 `<button aria-label="Move the sheet">`；方向键 ±8px，Shift ±32px |
| 复位 | 握把双击；或命令面板 `Reset the sheet` |
| 触屏 / 窄屏 | `<960px` 关闭拖动，纸片居中满宽 |
| 动效 | 拖动中无过渡；回正 160ms；`prefers-reduced-motion` 下回正也去掉 |

---

## 5. 文件与组件

| 文件 | 职责 |
| --- | --- |
| `src/pages/auth/LoginPage.tsx` | 两栏骨架、模式切换（signin / create）、提交与诚实失败 |
| `src/pages/auth/LoginSheet.tsx` | 纸：手绘框、握把、拖动状态机、位置持久化 |
| `src/pages/auth/SketchFrame.tsx` | 用 `sketchPath` 渲染一道/两道手绘线（rect / underline / hline 三种形态） |
| `src/pages/auth/QuotePanel.tsx` | 黑底电报体面板 |
| `src/pages/auth/login.module.css` | 全部样式；只用 token，不写死颜色（黑色面板例外，注释说明） |
| `src/lib/sketch.ts` | 确定性抖动路径（纯函数） |
| `src/lib/sheet-position.ts` | `clampToViewport`、`readSheetPosition`（纯函数，可测） |
| `src/data/quotes.ts` | 语录数据（§6） |
| `src/lib/routes.ts` | `login()` |
| `src/app/router.tsx` | `/login` 作为 AppShell 的**兄弟路由** |
| `src/shell/CommandPalette.tsx` | `Go: Sign in` 一条 |

---

## 6. 语录数据（先立规矩，再填内容）

```ts
type Quote = { id: string; text: string; author: string; year?: string; source: string };
```

**规矩**

1. 只收**真实存在**的句子，逐条核对原文与出处；不接受转述、拼贴、网络流传版。
2. 每条必须能填出 `source`（书名/访谈/演讲 + 年份）；填不出就不进库。
3. 中文译文由我们自己译，不标"官方译法"。
4. 首发 8–12 条，宁少不滥；长度控制在 180 字符内（黑板上放得下）。

**候选（P1 需逐条核实）**

| 引文 | 署名 | 备注 |
| --- | --- | --- |
| The best way to predict the future is to invent it. | Alan Kay | 1971，Xerox PARC 内部谈话 |
| If you want to build a ship, don't drum up people to gather wood… teach them to yearn for the vast and endless sea. | Antoine de Saint-Exupéry | Citadelle，措辞有多个流传版本，需定版本 |
| The reasonable man adapts himself to the world; the unreasonable one persists in trying to adapt the world to himself. | George Bernard Shaw | Man and Superman |
| A ship in harbor is safe, but that is not what ships are built for. | John A. Shedd | Salt from My Attic, 1928 |
| Any sufficiently advanced technology is indistinguishable from magic. | Arthur C. Clarke | Profiles of the Future, 1973 |
| Imagination is more important than knowledge. | Albert Einstein | 1929 访谈 |
| We wanted flying cars, instead we got 140 characters. | Peter Thiel | Zero to One；数字有 140/150 两版，需定 |
| It's easier to make something 10× better than 10% better. | Astro Teller | 转述普遍，需找一次可引用原话 |

> 判断：前 6 条可稳定引用；后 2 条必须找到可引用出处，否则删掉——黑板上写错一句，整页的可信度就没了。

---

## 7. 诚实边界（必须写在页面上）

1. **不验密码**：表单提交不会认证任何人；错误态文案是 `CHORD sign-in is not connected in this build.`
2. **不存密码**：不写 localStorage、不发请求体里的密码（连请求都不发）。
3. **出口**：纸上保留一行 mono 小字 `Continue as local dev user` → 写 `thylas_session=dev:u-local:ws-1` 并跳 `/overview`；这是与全站一致的 dev stand-in，明确标注 "no credentials".
4. **不做**：忘记密码、第三方登录、邮箱验证、注册写库、门禁重定向。
5. 页面不声称"安全"、不显示锁图标。

---

## 8. 待拍板

| # | 问题 | 建议 |
| --- | --- | --- |
| D1 | 表单字段：email + password（像登录）vs 只要 email + 验证码（贴合 CHORD 无密码假设） | **email + password**（你要的是登录页的形态），但配 §7 的诚实说明；若嫌矛盾就换 email-only |
| D2 | 注册：同一张纸切换 vs 独立 `/signup` | **同一张纸**（一个视觉，两种模式） |
| D3 | 语录：静态列表 vs 自动轮播 | ~~静态~~ → **已改：单条 + 9s 淡入淡出**（用户第二轮要求） |
| D4 | 手绘：自写 jitter vs 引入 rough.js | **自写**（约 30 行，确定性可测，不加依赖） |
| D5 | 纸片初始位置：居中 vs 偏左上 | **居中偏上**（`y = -6vh`），更像一张随手放的纸 |

---

## 9. 阶段与验收

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P0 | 本计划定稿 + 逐条核实语录 | 你确认 D1–D5 |
| P1 | `sketch.ts` + `sheet-position.ts` + 单测；`SketchFrame` 在空白页画一个框 | 单测：同 seed 同路径、clamp 不越界；截图目检线条不抖成锯齿 |
| P2 | 两栏骨架 + 黑底面板 + 语录排版 | 1440/1024/860 截图；黑面板在 3 主题下都不变色 |
| P3 | 纸 + 表单 + 拖动 + 持久化 + 键盘 | 拖动真机验证：pointer/键盘/双击复位/刷新保持 |
| P4 | 注册态、错误态、dev stand-in 出口、palette 入口、e2e、文档 | tsc / vitest / build / e2e 全绿 |

**e2e 清单（P4 加）**

1. `/login` 打开时没有 rail（`[data-rail]` 不存在），两栏都在
2. 握把拖动 → `transform` 改变 → 刷新后位置保持
3. 方向键把纸移动 8px；双击复位
4. 空邮箱提交 → `role="alert"` 文案，不发请求
5. 提交合法值 → 出现 `not connected in this build`；点 `Continue as local dev user` → 落到 `/overview` 且 cookie 有值
6. `860px` 下：面板变顶部色带、纸不可拖

---

## 10. 风险

1. **拖动 vs 选字**：握把以外的区域绝不能绑 pointerdown，否则输入框选不了文本。
2. **手绘过度**：只画结构线，一旦开始画箭头/涂鸦/胶带，整站风格就被这一页带偏。
3. **黑面板与三主题**：这是全站唯一不跟主题走的表面，CSS 里要写死并注释原因，e2e 断言它在 light 主题下仍是 `#0A0A0A`。
4. **语录准确性**：见 §6，宁可 6 条真话，不要 12 条网络版。
5. **它是"唯一没有 rail 的页面"**：`body{overflow:hidden}` 下必须自己管滚动，窄屏尤其。

---

## 11. 实施记录（2026-11-15）

| 项 | 落地 |
| --- | --- |
| 路由 | `/login` 作为 AppShell 的**兄弟路由**（无 rail / 无 dock）；命令面板 `Go: Sign in` |
| 手绘 | `src/lib/sketch.ts`：FNV-1a + mulberry32、每条边 3 个内点，**四边各自成段并向外过量 1.4× 振幅**（过量才是"画的"，不是"描的"）；两道描边 = 第二遍偏移 1.4px、28% 透明度 |
| 纸 | 420 宽、`rotate(-1.1deg)`、`focus-within` 回正；框与按钮都用 `SketchFrame`（按 ResizeObserver 实测尺寸生成路径，不随布局拉伸）；下划线用 `SketchUnderline`（viewBox 只横向拉伸，安全） |
| 拖动 | 只有 46px 握把起拖；window 级 pointermove（不用 setPointerCapture，合成事件也能测）；四边至少留 56px；`pointerup` 才写 `thylas:login-sheet:v1`；方向键 ±8/±32；双击复位并清存储 |
| 电报体 | `#0A0A0A` 固定底（三主题不变）+ 左侧 `rgba(255,255,255,.14)` 边线（否则 dark 下与页面同色合并）；IBM Plex Mono、13.5px/1.85、36ch、真引号 |
| 语录 | 6 条全部可溯源；**删掉了两条**候选（Thiel 的 140/150 字符、Teller 的 10×），因为只有二手转述 |
| 表单 | email + password（D1 采纳建议）；注册 = 同一张纸多一个 Name 字段；提交只做本地校验 + 明确"未连接"，**不发请求、不写密码** |
| 出口 | `Continue as local dev user` → 写 `thylas_session=dev:u-local:ws-1` → `/overview`，与全站 stand-in 一致 |
| 响应式 | ≤960：面板变 152px 色带（只留第一条语录），sheet 回到流内、不可拖 |

**验证**：tsc 干净 · vitest **525/525**（新增 sketch 9 / position 6 / quotes 3）· build ✓ · e2e **342/342**（新增 9 条登录断言）。

**截图**：`design/reference/login/login-{warm,dark,light}.png`、`login-860.png`、`login-dragged.png`。

### 执行中撞到的两件事

1. **全局文案硬关卡**：`src/` 里禁止出现 "Nothing was sent"（processes 的旧道歉句式），我的注册提示正好用了这句，被 e2e 静态检查拦下 → 改成 `Accounts are created by CHORD — this build creates none.`
2. **e2e 不要写死居中坐标**：视口内边距一变，`236` 就错。改成从 `stage.clientWidth / sheet.offsetWidth` 现算，并直接用存储值比对"回到原位"。

### 仍未做

- 登录页没有门禁：直接访问 `/overview` 仍然进得去（现有 dev cookie 语义未变）。
- 没有"忘记密码"：没有后端，也就不给假入口。

---

## 12. 第二轮修订（用户反馈，2026-11-15）

| 反馈 | 落地 |
| --- | --- |
| 左右应该一半一半 | `.page` 改为 `1fr 1fr`（原 62/38） |
| 左上角放 logo | `.logo` 绝对定位 26/22，`τ Thylas`，可点回 `/`（`data-login-logo`） |
| 表单形状要不规则 | 新增 `paperShape()`：7 个角，**顶边向右上斜、右上角切一刀、底边左侧略高**；`SketchFrame variant="paper"` 用干净多边形填充 + 抖动描边（抖动只在下笔上，填充保持干净） |
| 加 Google / GitHub / X OAuth | 三个 `Continue with …`，各自手绘框；点击只报 `X sign-in is not connected in this build.`，不发请求 |
| 右边每次只显示一句 + 渐变动画 | `QuotePanel` 单条渲染，9s 一换，320ms 透明度过渡；`prefers-reduced-motion` 下直接切换不淡入 |

### 这一轮踩到的坑

1. **绝对定位的 SVG 盖住了纸上的文字**：`.frame` 是 `position: absolute`，在同一个层叠上下文里画在静态内容之上 → 只有 `position: relative` 的按钮文字活下来。修法：`.frame { z-index: 0 }`，`.grip` / `.form` 各自 `position: relative; z-index: 1`。
2. **不规则边会咬字**：左下角原来收到 `0.062w`，正好落在 26px 内边距上，`Create an account` 贴边。修法：形状左下角回到 `0.03w`，内边距加到 30，底部 36。
3. 50/50 之后面板变宽，语录原本顶到上边；改成头在上、**语录在剩余空间垂直居中**。

**验证**：tsc 干净 · vitest **528/528**（+3 多边形断言）· build ✓ · e2e **343/343**（登录 10 条，含三 provider 与面板单条）。

---

## 13. 提交后的转场（第三轮，2026-11-15）

用户要求：填完表单点登录 / 注册后，右边黑板的文字散成星星 → 黑色铺满整页 → 表单收成彗星 → 在太空飞驰 → 镜头越贴越近 → 一片白 → 进入用户引导。

### 分镜（毫秒）

| 时间 | 发生什么 | 实现 |
| --- | --- | --- |
| 0–520 | 引文碎成星点，从文字区飞向全屏 | canvas：150 颗星，出生点取自面板文字矩形，`starProgress` 控制 0→1 |
| 0–620 | 纸片缩小、旋转、飞向屏幕中心，淡出 | `.page[data-warp] .sheet` 的 `sheetCollapse` 关键帧，位移用 `--warp-x/y` |
| 700–1460 | 黑色从右半屏长成整页 | `.veil` 的 `inkGrow`：`clip-path: inset()` 从面板矩形插值到 `inset(0)` |
| 880–1760 | 彗星从中心点射出，向右飞 | `cometState()` 第一段：中心 → `0.84W`，半径 5→9，尾巴 0.3→1 |
| 1760–2460 | 镜头追上：彗星被拉回画面中心并放大，背景星拉成径向线 | `cometState()` 第二段：`0.84W` → 中心，半径 9→74；110 条 streak 随进度拉长 |
| 2430–2890 | 白场 | canvas 全屏白，`flashOpacity()` |
| 3000 | 交给用户引导 | 写 dev cookie → `/user/profile`（Profile Initialization 向导） |

### 关键实现

- **时间轴是纯函数**：`src/lib/signin-warp.ts` 导出 `cometState / starProgress / flashOpacity / easeOutCubic`，canvas 循环只问"第 t 毫秒彗星在哪"。7 条单测覆盖起止点与单调性。
- **彗尾从自己的历史采样**：每 5ms 采一个点、共 42 段，所以尾巴会跟着曲线弯，而不是一条直线。
- **光晕用 canvas 径向渐变**：CSS 的"不要渐变"是给静态界面的，光源没有衰减就会像一个靶心（第一版就是三个硬边圆环，难看）。
- **星点被裁在黑色区域内**：`wipeLeft(t)` 跟着 `inkGrow` 同一条 760ms 曲线算黑边的位置，星点只在已经变黑的地方出现，否则米色那一半会像落了灰。
- **纸片在转场时被提升为 `position: fixed`**：留在 stage 里会被 `overflow: hidden` 从中间切掉。

### 撞到的三个坑

1. **`animation-fill-mode: forwards` 在延迟期间不生效**——`inkGrow` 延迟 700ms，延迟期间元素按 base 样式（无 clip-path）渲染，于是整页立刻变黑，"从右半屏长出来"这一拍直接消失。改成 `both`。
2. **`requestAnimationFrame` 改状态会抢在首帧前**：原本用 state + `transition: clip-path`，rAF 里 `setExpanded(true)` 常常在浏览器绘制初始 clip 之前执行，过渡没有起点，直接跳到终态。改成把几何塞进 CSS 变量、用 `@keyframes` 读变量，无竞态。
3. **彗星从屏幕左边缘进场与"纸片收成彗星"打架**：纸片在正中心消失，彗星却从外面飞进来。改成彗星从中心点出发，纸片的消失即彗星的诞生。

### 边界与降级

- **仍然不认证任何人**：提交只做本地校验；转场结束写入的是全站一致的 dev stand-in cookie（`dev:u-local`），落地页是 Profile Initialization 向导。
- **`prefers-reduced-motion: reduce`**：整段转场跳过，直接进引导（不做剪辑版动画）。
- 转场期间页面 `aria-busy="true"`，canvas 与 veil 都是 `pointer-events: none`。

**文件**：`src/lib/signin-warp.ts`(+test) · `src/pages/auth/SignInTransition.tsx` · `login.module.css`（`inkGrow` / `sheetCollapse` / `.veil` / `.warpCanvas`）· `LoginPage.tsx`。

**验证**：tsc 干净 · vitest **535/535** · build ✓ · e2e **343/343**（"valid form turns the page into the warp, then hands over to onboarding" 会真的等 3.6 秒看落地路由）。截图：`design/reference/login/warp-*.png`。
