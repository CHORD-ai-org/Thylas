# 11 — Thylas 行动线与决策点登记

**Date:** 2026-11-22 · **Status:** [P] 行动建议 + [Q] 决策登记。由研究结论 + 已落地执行（P0 完成）综合而来。
前置事实：@ 通路、抽取 MVP、MutationIntent 已落地（见 `docs/home-interaction/11-execution-plan.md`）；创始人 11-21 已拍板 Overview+Chat 合并、Agent 执行走真实编排。

## 1. 三条行动线

### 线一：不等决策，立即可做

| # | 事项 | 依据 | 量级 | 现成地基 |
|---|---|---|---|---|
| A1 | `/api/ai*` 加 session 鉴权 | 执行计划 P1-1，现无检查 | 小 | `server/session/source.ts` |
| A2 | 对话驱动 Profile 更新（接真 pipeline） | home-interaction 08 §6 | 中 | `server/profile/*` 全流程已发货 |
| A3 | chat 冲突重放 / lint 清理 / ContextBinding 改名 | K-1/K-2/K-3 | 小 | — |
| A4 | **Engagement trace**：MutationIntent history 接到 Artifact 版本 + board 卡片 | Ream（研究 01/06） | 中 | `lib/mutation.ts` 事件形态 |
| A5 | **归因五类**（feedback/independent/co-edit/takeover/reuse）进 MutationIntent | CLEO，Q-G 倾向 G3 | 中 | `mutation.ts` status 机 |
| A6 | **共享原语最小测试**："选 N 项 → ask Coworker → results as proposals" | 研究 07 §2.5 | 小 | 抽取管线（artifactCandidates） |
| A7 | Overview 输入框 + Chat 合并 | 创始人已拍板（THINKING.md） | 大 | ChatCore/Composer 现成 |

### 线二：等创始人决策（见 §2）才动

- **Q-C 空间** → Huabu 计划 A1（节点 kind + 渲染）、boards 持久层设计。
- **Q-E 持久阶梯** → boards scratch/kept/canonical 三层与提升 UX。
- **Q-F 共享策略** → 是否产出 representation 交换格式（spec 级共享）。
- **Q-D 过程一等** → Reflection/决策记录是否成实体族。

### 线三：推荐顺序

1. A1 + A3（安全与正确性）
2. A5 + A4（研究最大增量：归因 + 痕迹层）
3. A6（可演示给创始人的共享原语样板）
4. A7（Overview+Chat 合并，创始人拍板项）

## 2. 决策点登记（8 项，需创始人讨论）

| # | 决策 | 来源 | 不定的代价 |
|---|---|---|---|
| D1 | **基底 vs 设计语言**：Malleable Context Space 是共享架构还是仅共享原则 | 研究 09 #1 | 决定 D2 共享粒度 |
| D2 | **Q-F 共享策略**：concepts / spec / SDK | 08-Q-F | SDK 早做会耦合，晚做会漂移 |
| D3 | **先做哪个场景**（A GSC / B Thylas / C Lemma） | 09 #4 | 三线并进 = 蔓延 |
| D4 | **C1 版本哲学**：Thylas 不可变+权威 vs GSC supersede —— 统一、映射、并存？ | 10-glossary C1 | 阻塞交换格式 |
| D5 | **Q-C 空间状态**：视图 / 环境 / 混合 | 08-Q-C | **已定 2026-11-22：C2 完整环境** → 设计稿 `docs/product/boards/SPATIAL-ENVIRONMENT-VISION.md` |
| D6 | **Q-E 持久阶梯** + scratch TTL | 08-Q-E | 表示存储未定 |
| D7 | **Q-D 过程一等**：derived / first-class / hybrid | 08-Q-D | schema vs events 之争 |
| D8 | 是否接受 C 主张"长程协作必须显式过程"（尽管有开销） | 09 #4[概念] | 影响 D7 |

## 3. 已定（不再讨论）

- Overview 输入框 + Chat 合并演化（创始人 2026-11-21）。
- Agent 执行 = 真实编排（/api/ai + profile 管线模式，接口留 WAM 兼容）。
- WAM 边界：运行时归 WAM，Thylas 投影。
- 不共享：WAM runtime state、Lemma learner model、Coworker persona、GSC taxonomy 强加 Lemma。
- 纪律：不把每个概念变成 DB 实体；无假控件；proposal→confirm 是最强共享原语。

## 4. Q-C 空间决策卡（详细展开，供讨论）

**问题**：Spatial Workspace 是"又一个视图"还是"有自己状态/操作/交互的工作环境"？

| 备选 | 含义 | 优势 | 劣势 |
|---|---|---|---|
| C1 纯视图 | 空间只是投影，无自有状态 | 简单（GSC Canvas-tree 先例） | 与 Inkitiate 证据矛盾——"塑造空间即工作本身"，视图承载不了 ink 语义 |
| C2 完整环境 | 自有表示+状态+持久化 | 匹配 Inkitiate 三活动（bring in / think with / shape） | 持久化问题倍增；"无限画布"陷阱 |
| C3 混合 | 视图 + 瞬态 marks 草稿层；排布经持久阶梯保存 | 对两边诚实；可优雅降级 | 一张表面两层持久需要清晰 UX |

**证据**：Inkitiate [paper] "shaping the space IS the work"；D [paper] 重组是最难缺口；
**Thylas 现状已偏 C3**（boards 排布持久、手势仅 undo）。
**卡住什么**：Huabu 计划 A1（节点 kind）、boards 的 scratch/kept 层、ink 提升规则。
**关键未知**：空间关闭时什么留下（Q-E 交叉）；agent 可否自动提升表示层级（推定否）。

### 4.1 三方案实现与效果差异

| | C1 纯视图 | C2 完整环境 | C3 混合 |
|---|---|---|---|
| 实现 | 零改动（boards 现状即终态）；ink/marks 是会话内 state，关页即弃 | 新 `Representation` 域实体 + store/表 + 版本 + events 全量；每次落笔=可寻址对象 | 持久排布层（现状不变）+ 瞬态 marks 层（IDB+TTL）+ 提升动作（candidate→commit）+ 结构移动事件 |
| 代码量级 | ≈0 | 一个新域（store+治理+UI） | 中（`boards/marks.ts` + events + promote） |
| 关页重开 | 排布在，笔迹圈注没了 | 一切都在（含草稿涂鸦） | 排布在；笔迹 TTL 后消失，除非一键提升 |
| agent 可见性 | 空间提示不可见 | 全部一等上下文 | 持久排布+事件+已提升注释 |
| 存储/治理 | 零 | 倍增+清理负担 | 有界（TTL 兜底） |
| 主要风险 | "塑造空间"成果不被承认 | 噪音、无限画布陷阱 | 两层持久的 UX 需清晰 |
