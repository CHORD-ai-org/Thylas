# Project as a Collaborative Entity — 研究索引

> 状态：第一轮发散（2026-11-22）。概念探索，未定案，非架构、非 PRD。
> 标签约定：【事实】=仓库已存在 · 【直觉】=创始人原话 · 【假设】未验证 · 【开放】未决 · 【提案】=本轮设计建议。
> 直接上游：`docs/product/projects/DESIGN-BOUNDARIES.md`（7 原子拆解）· `docs/product/boards/SPATIAL-ENVIRONMENT-VISION.md`（C2）· `docs/research/malleable-context-space/` · `docs/product/gsc/MANIFESTO.md`。

## 1. 研究目的

重新思考 Project 的存在形式：不再是本地文件夹/Workspace/侧边栏记录，而是
**独立身份、挂接资源、组织 Context/Artifact/Coworker、可讨论协作共享复用、可空间化呈现的持续工作现场**。
本阶段只找产品概念与系统边界（Thylas × GSC × CoworkOS），不实现。

## 2. 现有事实

- 【事实】代码里只有 Workspace（`src/data/types.ts:12`，scope: personal|org），**无 Project 实体**。
- 【事实】Artifact 对象性论证 + 治理管线（候选→评审→提交）已落地：`src/state/artifactCandidates.ts`、`server/profile/store.ts`、`src/lib/mutation.ts`；`docs/product/artifacts/` 有完整产品模型。
- 【事实】Coworker 多 Workspace 成员制已设计（role/资源/Artifact/Tool 授权逐项授予）：`docs/product/coworkers/WORKSPACE-RELATIONSHIP.md`。
- 【事实】GSC 实体 = item/cluster/context/proposal/tag；scope 词表现状 personal/workspace（项目级 scope 不存在）；已有 owner_id + cluster_shares（view/add）；溯源有 origin/derived_from，**无署名级**（哪个 agent/哪个人）。依据：`D:/github projects/GSC/DOMAIN_MODEL.md`、`DESIGN_BOUNDARIES.md`。
- 【事实】@ 对象调用已落地（`src/lib/invoke.ts` + 17 单测）；圈选即交代/结果落位的手势词汇已定义于空间愿景。
- 【事实】空间环境已拍板 C2：空间是完整工作环境，不是视图（MCS 11 决策卡）。

## 3. 核心设计直觉

**从"文件在哪里"换成"工作在哪里"。** 【直觉】
项目 = 身份先于资源（文件夹只是挂接的材料之一）；对象性向 Artifact 看齐（可命名、可 `@`、可讨论、可复用）；空间是它的桌面；Context 随项目走（共享 = 引用而非复制）；Coworker 是成员（署名 + 参与历史 + 交接）；Cluster 不预设层级。
【直觉·11-22 校准】**Workspace ⊃ Project**：Workspace=环境（工具、Coworker 名册与进出管理），Project=工作现场。Cluster 职责并入 Workspace。

## 4. 当前进度

- [x] 第一轮（2026-11-22）：直觉重述 · 职责边界盘点（明确/争议）· 现有设计盘点 · 概念拆分（混合概念识别）· 7 个启发式问题 · 5 个产品假设。
- [x] 定位校准（2026-11-22 下午）：Workspace ⊃ Project 双层模型 → [01-positioning-workspace-project.md](01-positioning-workspace-project.md)（6 条细分待拍板）。
- [x] D1 场景推演（2026-11-22 傍晚）：10 场景按新模型推演 → [02-scenarios.md](02-scenarios.md)（暴露 S1–S6 未决）。
- [ ] D2 设计备选（方案卡：对象模型/页面结构/交接与复用语义/边界协议，不选唯一方案）。
- [x] D2/D3 合流（2026-11-22 傍晚）：创始人定三段作答格式 → [03-design-proposal.md](03-design-proposal.md)（执行路径四步/用户例子/改变清单）。
- [ ] D3 领域模型 + Thylas×GSC 分工协议 → D4 交互设计（复用 C2 手势）→ D5 路线图。
- [x] Ream 应用脑暴（2026-11-22 晚）：全文核实（证据级升全文）→ [04-ream-application.md](04-ream-application.md)。**→ 暂存**（创始人指示，桌面/骨架成型后再回）。
- [x] 执行计划（2026-11-22 晚）：→ [05-execution-plan.md](05-execution-plan.md)（P0–P4 + K；修订①对话抽屉、修订②文字预算）。
- [x] 设计文档 Outline（2026-11-22 晚）：→ [06-design-doc-outline.md](06-design-doc-outline.md)（PDF 版，待过目后开写）。
- [ ] A 核心稿（Part II+III）→ `draft/A-core.md` **已出草稿，待创始人评审概念模型**；B 交互稿 → C 成书（PDF）。

## 5. 未决问题

| # | 问题 |
|---|---|
| O-P1 | ~~Project 与 Workspace 的关系~~ **创始人输入（11-22 校准）：Workspace ⊃ Project**——Workspace=环境层（工具、Coworker 名册与进出管理），Project=工作现场层。"Project 换代 Workspace"方案作废。逐条校准中。 |
| O-P2 | 项目身份锚在 id / 路径 / 名字？本地文件夹改名移动后项目卡发生什么？ |
| O-P3 | "可复用"的具体语义：模板 / fork / 引用 / 派生？Context 与参与历史跟着走吗？ |
| O-P4 | 项目画布与空间环境（C2）是同一张桌子吗？ |
| O-P5 | 项目级 GSC scope 的粒度与生命周期（归档/删除/转移时分区怎么办）？ |
| O-P6 | 署名最小闭环：显示名字即可，还是要可验证身份？ |
| O-P7 | 一个本地文件夹被多项目引用、其中一方要独占修改时，冲突在哪层解决？ |
| O-P8 | CoworkOS 与 WAM A2A：上层 / 并列 / 替代？首个真实试跑路径是哪条？ |

## 6. 相关文档索引

| 文档 | 给本研究什么 |
|---|---|
| [01-positioning-workspace-project.md](01-positioning-workspace-project.md) | **定位校准**：Workspace ⊃ Project 双层定位卡、Coworker 两层制、命名裁定、待拍板 6 条 |
| [02-scenarios.md](02-scenarios.md) | **场景推演 D1**：10 场景（看到/做什么/系统发生什么）+ S1–S6 未决 |
| [03-design-proposal.md](03-design-proposal.md) | **设计方案（三段格式）**：执行路径四步、用户例子、改变清单、风险 |
| [04-ream-application.md](04-ream-application.md) | **Ream 应用脑暴（暂存）**：取 8 / 补 5 / 增 5 |
| [05-execution-plan.md](05-execution-plan.md) | **执行计划**：P0–P4 + K、验证关卡、文字预算、home-interaction 会师点 |
| [06-design-doc-outline.md](06-design-doc-outline.md) | **设计文档 Outline（PDF）**：18 章 + 附录、页预算、PDF 管线 |
| `docs/product/projects/DESIGN-BOUNDARIES.md` | 创始人原话 7 原子（A–G）、边界图、撞名裁定、依赖顺序 |
| `docs/product/definition.md` | Workspace=central object [C]；D4 一对象一 scope、引用不复制；B2 ingestion；责任矩阵 |
| `docs/product/artifacts/` | 对象性四论证（lifetime/agency/reference/evolution）、治理、CANONICAL-REUSE |
| `docs/product/coworkers/` | 成员制、WAM 边界、working experience（署名的近亲） |
| `docs/product/gsc/MANIFESTO.md` + `D:/github projects/GSC/{DOMAIN_MODEL,DESIGN_BOUNDARIES}.md` | GSC 实体/scope/共享/溯源现状 |
| `docs/product/boards/SPATIAL-ENVIRONMENT-VISION.md` | 空间手势词汇、C2 拍板 |
| `docs/research/malleable-context-space/` | 归因五类（feedback/independent/co-edit/takeover/reuse）、View≠Representation、开放问题 |
| `docs/home-interaction/` | 委派/交接接壤（D2/D3）、MutationIntent 治理（执行权限 ≠ 提交权） |

## Change log

| 日期 | 变更 |
|---|---|
| 2026-11-22 | 创建。第一轮发散 6 项交付入索引；场景推演与设计备选待创始人讨论后推进。 |
| 2026-11-22 下午 | 定位校准：创始人提出 Workspace ⊃ Project（Workspace 含工具与 Coworker 进出管理）。O-P1 收敛；"Project 换代 Workspace"假设撤回；H1（身份锚在意图）保留、层级部分改写。 |
