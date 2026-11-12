# GPT 风格迁移 — SPEC

**Date:** 2026-11-12 · 参考：`design/reference/chatgpt/`（REFERENCE.md 规格观察 + STYLE-GUIDE.md）
**原则（用户定）：** 抄 ChatGPT 的形（布局/组件/间距/动效），不抄色（配色仍是 Thylas token）；全部文案不变；GPT 没有的页面自研布局但复用同一套组件词汇。数据层与业务逻辑零改动——只动 CSS module 与少量布局结构。

## 1. Token / 语法层调整

| Token | 现状 | 迁移后 |
| --- | --- | --- |
| 圆角 | `--r-sm/md/surface`（偏小） | 输入/按钮 8–10px；面板 12px；composer/搜索胶囊 24px（pill） |
| 面板边框 | 到处 1px hairline | **层级改底色差**：同层无框，跨层用 `--bg-app` vs `--bg-surface` 区分；hairline 只留列表行分隔 |
| 阴影 | 几乎无 | 悬浮元素（popover/dock）保留轻阴影；平面元素维持无阴影 |
| 字号 | body 14px | 正文 15px；小 UI 13px（基本一致，微调） |
| 动效 | `--dur-fast/fast` | 统一 150–200ms ease-in-out；hover 提亮；click scale 0.97（可选） |
| 间距 | 已近 8px 网格 | 确认不动 |
| accent | `--accent`（蓝） | **只用于强调**：send 圆钮、active chip、链接 hover——大面积保持中性 |

## 2. 全局组件词汇（各页面复用）

1. **胶囊搜索/输入**：icon 内嵌左，全宽或定宽，圆角 pill。
2. **区块 + ›**：小标题（mono 大写）+ 右箭头，无框分组。
3. **两列行**：圆角方 icon + 粗名称 + 灰描述 + 右侧动作（+/…）。
4. **chips 切换**：active = 深底胶囊（Rail/Directory/Library 通用）。
5. **主按钮「新建 ▾」**：头行右侧。
6. **空态大问句**：居中 display 级问句 + 下一行动作。
7. **无气泡消息流**：留白+底色区分（已是，保持）。
8. **hover 出现的操作图标**：列表行/消息/区块通用（已是，保持）。

## 3. 逐页迁移

| # | 页面 | 动作 | 对标 |
| --- | --- | --- | --- |
| 0 | **Chat（样板）** | 空态大问句 + composer 居中沉底两态；composer 胶囊化（+ 内嵌左、send accent 圆钮右）；头部极简 | gpt-real-01 |
| 1 | Overview | 无对标自研：intent 输入改居中大问句+胶囊（GPT 首页模式）；Recently/Compute/Processes 无框分组、区块+› | GPT 首页 |
| 2 | Artifacts Library | 头行右移（搜索/新建 ▾ 进头行）；加网格/列表视图切换（网格 = masonry 卡片，形态随类型自渲染）；chips 靠拢 | gpt-real-03 |
| 3 | Connect | 布局直接对标插件目录：区块+›、两列行、全宽胶囊搜索、添加 ▾ | gpt-real-02 |
| 4 | Coworkers Directory/Detail | Directory 同 Artifacts；Detail 会话区随 Chat 样板 | gpt-real-01/03 |
| 5 | Rail | 密度/active 态靠拢（深底高亮块、分组标签），结构与项不变 | gpt-real-01 侧栏 |
| 6 | Compute / User / Notes | 无框层级 + 组件词汇替换，保结构 | — |
| 7 | detail 类页面（artifact/coworker config） | 边框弱化（底色差分组）、区块+›、hover 图标 | — |

## 4. 不做

- 不改配色值（token 色相不变）；不改文案；不改路由；不改数据层；不做 GPT 的账号/升级位；不引入 Inter（保持现有字体栈——字体属品牌）。

## 5. 验收

每页迁移后：截图（shots 脚本）+ 对应 e2e 全绿 + 与参考图并排目检。全部页面完成后跑全量 e2e。

## 6. 执行记录（2026-11-12）

| 页面 | 状态 | 截图 |
| --- | --- | --- |
| Chat（landing + conversation） | ✅ | `design/reference/chatgpt/thylas-chat-*.png` |
| Overview（居中大问句 + 胶囊 intent + 圆形 ink send） | ✅ | `thylas-overview.png` |
| Artifacts Library（头行 icon 组 + 网格/列表切换 + 类型自渲染卡片） | ✅ | `thylas-artifacts-grid.png` |
| Connect Discover（两列行 + 区块 + 全宽胶囊搜索） | ✅ | `thylas-connect.png` |
| Coworkers（Directory 头行一致；Detail 会话区随 Chat 样板） | ✅（创建时已达标） | `coworkers-*.png` |
| Rail（workspace 徽章 PERSONAL/ORG·MEMBER 移除，工作记录照旧） | ✅ | `thylas-rail.png`（含 Overview） |
| Compute（runForm/rec/kindCard 无框化，输入类边框保留） | ✅ | `thylas-compute.png` |
| User（planCard 无框化） | ✅ | `thylas-user.png` |
| Notes（code/search 为功能性边框，保留） | ✅（无需改动） | — |
| detail 类页面 | ✅（section 分隔为 hairline 行分隔，即目标形态；composer 随 Chat 样板） | — |

**第二批完成**：多余文字提示清理（rail/grid 的 PERSONAL/ORG·MEMBER 徽章、chat 的 CONTEXT 标签与 Add context 文字按钮→icon-only，aria 名保留）；卡片容器无框化 4 处。e2e 302/302。迁移全部页面完成。

硬关卡修正记录：overview accent 归零约束（send 改 ink 底 32px）；connect 文案保真（tierNote 不顶替 'No flow to open'）。e2e 302/302。
