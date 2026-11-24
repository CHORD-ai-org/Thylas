# 视觉减负 — GSC 视觉方案调研与移植提案

**Date:** 2026-11-24 · **Status:** [P] 调研 + 提案（未实施）。触发："现在的页面看着太累了"。
**来源**：`D:/github projects/GSC` 全量视觉提取（tokens.css / UI_COLORBLOCK_REFACTOR.md / LIGHT_UP_UX_VISION.md / INTERACTION_UX_PLAN.md / THYLAS_REFERENCE.md）。

---

## 1. 诊断：为什么累（Thylas 现状）

| # | 症状 | 根因（现状证据） |
|---|---|---|
| 1 | **满页线框感**：每张卡、每个面板、每行都带 1px 边 | 卡片=hairline 描边；页面像 wireframe/账本，眼睛先解析边框才找到结构 |
| 2 | **小字 + mono 过载** | UI 13/20、caption 11/16、mono-s 11/16；meta/来源/时间到处是小号 mono |
| 3 | **解释性文字常驻** | 每个表面带 detail/hint/副标题（GSC 同病，一次删了 50+ 处） |
| 4 | **无面性层级**：全白底 + 线，靠线分区 | 缺"填充色块"这层中间结构（GSC 的解法核心） |
| 5 | **圆角偏小、偏工具感** | 卡 12px（GSC 大卡 22px、composer 30px） |

## 2. GSC 方案提炼（直接可拿的）

GSC 走过同一条路（INTERACTION_UX_PLAN: "全站不是丑，是把字段直接摆上屏"）。核心四招：

| 招 | GSC 做法 | 值 |
|---|---|---|
| **柔面代线** | 卡=圆角填充面 + `border:1px transparent` + **hover 才显边** + 极轻双层阴影 + hover 上浮 1px | `views.module.css:370-371` |
| **圆角升档** | sm 13 / lg 22 / xl 30 / pill 999；按钮输入框全胶囊 | `tokens.css:31-34` |
| **字阶放大 + 行高宽松** | 正文 **14.5/23**、行标题 15/23、meta 12.5/18、页标题 27/35（w650）；mono 只给数字/ID | `tokens.css:35-47` |
| **彩色柔化 22%** | 6 色轮换卡（蓝#4F7DFF 紫#7C63FF 青#17C3C3 粉#EC4899 琥珀#F5A623 绿#2FBF71）全部 `color-mix(22%, surface)` 填充，饱和色只点睛 | `tokens.css:53-67` + nth-child(6n+N) 轮换 |

配套（成本低、见效快）：
- **删解释文字**（GSC 一次删 50+ 处副标题/提示）。
- **行内动作默认隐藏**（悬浮/收进 ···），无常驻按钮排。
- **语义色仅 4 个**（灰原文/绿确认/紫机器/红异常）且**永远配文字**，不单独用色编码。
- **微型大写标签**统一 11px/.08em/ink-3（比现在的多处 mono 更安静）。
- **密度双档**（comfortable/compact）作为偏好。

## 3. Thylas ↔ GSC 令牌对照

| 令牌 | Thylas 现状 | GSC | 建议 |
|---|---|---|---|
| 卡圆角 | `--r-md: 12px` | 22px | **升到 18–22**（`--r-md` 一处改） |
| 按钮/输入 | 8px | 999 胶囊 | 输入框/搜索 pill 化；按钮可选 |
| 正文 | `--t-ui 13/20` | 14.5/23 | **UI 升 14/22**，read 16/26 保留 |
| meta | `--t-mono-s 11/16` 顶大量 meta | 12.5/18 非 mono，mono 只给数字 | **减少 mono 角色**，meta 回归 sans |
| 卡片边界 | 1px hairline 常驻 | transparent→hover 显边 | **换柔面**（最大减负项） |
| 彩色 | 6-hue 仅封面/verdict 骨 | 6-hue 22% 填充轮换 | 封面扩为**卡片淡色底**（同 6 色，22%） |
| 语义色 | verdict 4 色已配字 | sem 4 色必配字 | 一致，保持 |
| 主题 | 暖纸 warm | 冷灰黑白 | **保留暖纸身份**（GSC 自己也说"不换视觉基底"） |

## 4. 移植提案（按性价比排序）

| # | 改动 | 落点 | 量级 | 预期 |
|---|---|---|---|---|
| V1 | **卡片换柔面**：去常驻边框 → 填充面+hover 显边+轻阴影 | `tokens.css`（shadow）+ 各卡片类 | 中 | 线框感消失，疲劳降一半 |
| V2 | **圆角升档** + 输入框胶囊化 | `tokens.css` 一行 ×2 | 小 | 立刻柔和 |
| V3 | **字阶放大**：13→14/22，meta 退 mono | `typography.css` | 小 | 阅读舒适（GSC:"reading comfort is a core capability"） |
| V4 | **卡片淡色轮换**：6-hue 22% 填充用于列表/项目卡 | tokens + 卡片类 nth-child | 中 | 结构靠色块不靠线 |
| V5 | **删解释文字**：detail/hint 走 tooltip（与文字预算规则合流） | 全站文案 | 中 | 界面安静 |
| V6 | 行内动作默认隐藏 | 各卡片 actions | 小 | 常驻按钮排消失 |
| V7 | 密度双档偏好 | tokens + user prefs | 小 | 看情况 |

**不移植**（与 Thylas 静谧基线冲突）：收据打印机拟物、光标粒子、玻璃拟态、发光动效——GSC 的 LIGHT_UP_UX_VISION 自己也禁这些。

## 5. 验收标准（实施后怎么算"不累了"）

1. 首屏可见常驻描边框 ≤ 2 个（对比：现在每卡皆框）。
2. 正文 ≥ 14px、行高 ≥ 1.55；mono 只出现在数字/ID。
3. 一页内解释性句子 ≤ 1 行/区块（其余进 tooltip）。
4. 色块承担分区（≥ 2 处淡色面），边框只在 hover/选中出现。
5. 文字预算走查沿用 05 规则（空态一行、批注 ≤12 字）。

## 6. 落地单元（若做）

- **T1 令牌**（V2+V3+shadow）：tokens.css/typography.css，全站生效，e2e 视觉断言不回退。
- **T2 卡片处方**（V1+V4）：先项目卡/技能卡/文件网格三处样板，再铺开。
- **T3 文字删减**（V5+V6）：按页走查，接文字预算关卡。

完整 GSC 令牌原文见提取报告引用：`GSC/src/styles/tokens.css`；对照表 `GSC/THYLAS_REFERENCE.md`。
