# 视觉负载优化 — 执行计划

**Date:** 2026-11-24 · **Status:** [P] 执行拆解（上游：`visual-refresh.md` 调研 + GSC 处方）。
**目标**：把"看着累"降下来——去线框感、放大字阶、删解释字、收动作、淡色分层。
**红线**：表格 grammar 不动（SP-04a 审计过关：表头 44px/行 32px/列预算，`ui-checks.mjs:652-664`）；暖纸身份不动；静谧计算美学不破；无假控件。

## 视觉负载指标（操作化，可测）

| 指标 | 现状 | 目标 | 测法 |
|---|---|---|---|
| 首屏常驻描边卡 | 每卡皆框 | ≤ 2 | css 源检查 + 走查截图 |
| 正文字号/行高 | 13/20 | ≥14 / ≥1.55 | typography.css |
| mono 用于纯文本的调用点 | 遍地 | ≈0（只留数字/ID） | grep `--t-mono-s` 调用点 |
| 每区块解释句 | 常驻 | ≤1 行，其余 tooltip | 文字预算走查 |
| 分区手段 | 全靠线 | ≥2 处淡色面 | 走查截图 |

## 前置决策（推荐默认，改一句即变）

| # | 决策 | 推荐 |
|---|---|---|
| Q1 | 卡圆角 | **18px 一步走**（现 12；GSC 是 22），走查后可再升 |
| Q2 | 正文字阶 | **14.5/23**（GSC 阅读线）；表格行内不动 |
| Q3 | pill 化范围 | 输入框/搜索 pill；**按钮保持 8px 圆角矩形** |
| Q4 | 轮换色板 | **复用现有 6-hue 封面白名单**（blue/green/clay/violet/teal/amber），不引 GSC 新色 |

## P0 — 令牌与样板（一夜见效）

### T1 令牌升级 ✅ DONE（合批 T1+T2，2026-11-24）
- **改动**：`src/styles/tokens.css` — `--r-md 12→18`、新增 `--shadow-card`/`--shadow-pill`（GSC 双层低透明度配方）、`--fill-N`（6-hue 22% color-mix，Q4）；`typography.css` — `--t-ui/--t-ui-strong` 13/20→14.5/23、新增 `--t-meta 500 12.5/18 sans`。
- **验收**：三主题（warm/black/white）截图走查；e2e 像素断言同步（见风险）。
- **风险**：**e2e 表格断言（44/32px、列宽）与 Overview 输入框测量可能回退——表格行内字号不动即安全，仅改卡片/正文档**。**独立性**：一切的前提。

### T2 三张样板卡柔面 ✅ DONE
- **改动**：`projects.module.css .card`、`skills.module.css .card`、`files.module.css .gcard` —— 常驻边框→`transparent`，hover/选中显 `--line-strong`，加 `--shadow-card`；填充分层（surface/paper）。
- **验收**：e2e 新断言——三卡 hover 显边、默认无边（css 计数 ≤2）；截图对照 visual-refresh §5 标准 1/4。
- **独立性**：依赖 T1。

## P1 — 铺开与减负

| # | 目标 | 改动 | 验收 |
|---|---|---|---|
| T3 | 柔面铺开 | `processes/workspaces/chat(candidate/extract)/notes` 卡片套同一处方；**表格/树行保持 hairline** | 全站走查；e2e 不回退 |
| T4 | 文字减负 | 解释句进 tooltip（合流 05 文字预算）；`--t-mono-s` 纯文本调用点换 `--t-meta` | grep 调用点≈0；每区块解释≤1 行 |
| T5 | 行内动作隐藏 | 卡片 actions hover/··· 收起（打开/归档/删除这类常驻排） | 截图无常驻按钮排；e2e 点击路径不变（hover 露出） |

## P2 — 淡色轮换

| # | 目标 | 改动 | 验收 |
|---|---|---|---|
| T6 | 6-hue 22% 卡底轮换 | 项目卡/技能卡列表 `nth-child(6n+N)` 用 `--fill-N`；三主题 color-mix 自适应 | 截图有淡色分区（指标 5）；不刺眼 |

## K — 随手
- lint 既有 5 errors 顺手清。
- e2e 像素断言同步（files 列预算、Overview rect 等——只同步数值，不放松语义）。
- `design/tokens.css`（冻结档案）不动，全部走 `src/styles/tokens.css` 覆盖（D-041 模式）。

## 硬关卡（每单元收口）
tsc ✓ / vitest 全绿 / build ✓ / e2e 全绿（含同步后视觉断言）/ lint 无新增 / **视觉走查对照 visual-refresh §5 五条** / 表格 grammar 断言不回退。

## 排序

```
T1（令牌）→ T2（三样板卡）→ 视觉走查（Q1 18px 够不够在此定）
→ T3 + T4 并行 → T5 → T6 → K
```

## MVP 验收（整体）
打开 Overview/项目地图/技能/文件网格：无满页线框、正文 14.5/23、动作收起、淡色分区可见、表格账本依旧。三主题各截图一张存 `docs/design/` 走查归档。
