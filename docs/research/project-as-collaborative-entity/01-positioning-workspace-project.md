# 01 · 定位校准 — Workspace ⊃ Project

**Date:** 2026-11-22 · **Status:** 创始人输入已定（Containment 方向）；6 条细分待拍板。
**来源：** 创始人 2026-11-22 校准原话："workspace 应该是包含 project 的，因为 Workspace 需要包含很多的工具，比如管理 coworker 进入 project，还有很多别的。"
**标签约定：** 【直觉】创始人原话 · 【提案】本轮设计建议 · 【开放】待拍板 · 【事实】仓库现状。

---

## 1. 校准结论（一句话）

**Workspace ⊃ Project。Workspace 是环境/机构层——装工具、装名册、管"谁进哪个 Project"；Project 是里面正在做的一件事（工作现场）。**

```text
Workspace（环境）
├─ 工具：Compute / Connect / …
├─ Coworker 名册与授权（入职管理："管理 coworker 进入 project"）
├─ 人的成员、Workspace 级 Context/设置
├─ Artifact 资产库（跨项目复用的家）【提案】
└─ Project × N（工作现场）
    ├─ 材料：文件/笔记/画布
    ├─ GSC 项目分区（Context）
    ├─ 讨论与活动（带署名）
    ├─ 参工的 Coworker（角色/子集授权/参与历史）
    └─ 产出 artifact
```

**被撤回的方案**："Project 换代 Workspace"（本人 2026-11-22 上午提案）——作废。理由：Workspace 的职责（工具、名册、进出管理）不是"另一种项目"，Project 装不下。

## 2. 双层定位卡【提案·主体待拍板】

| | **Workspace（环境）** | **Project（工作现场）** |
|---|---|---|
| 一句话 | 你建的一个工作机构：有名册、有装备、有规矩 | 机构里正在做的一件事：材料、上下文、产出、参与者 |
| 装什么 | Coworker 名册与授权、工具（Compute/Connect…）、Artifact 资产库、人的成员、Workspace 级 Context/设置 | 文件/笔记/画布（材料）、GSC 项目分区、讨论与活动、参工的 Coworker、产出 artifact |
| 不装什么 | 具体工作的材料与上下文 | 工具管理、名册、权限授予 |
| 界面 | Rail 顶部切换器 + 管理面 | 项目卡 → C2 桌面（空间） |
| 生命周期 | 长期 | 有始有终（可归档） |

## 3. Coworker 两层制【提案】

| 层 | 动作 | 内容 | 既有资产 |
|---|---|---|---|
| Workspace 级 = **入职** | 管理 Coworker 进入 | 名册、身份、工具权限 | `docs/product/coworkers/WORKSPACE-RELATIONSHIP.md` 成员制归位到这层 |
| Project 级 = **参工** | 派进项目 | 角色（在这做什么）、资源授权子集、参与历史、产出署名 | 新增；brief §2.5 "Coworker as Project Participants" 的落点 |

"管理 coworker 进入 project" = Workspace 管理面把名册里的人派进某个 Project。

## 4. 命名裁定

| 词 | 裁定【提案】 |
|---|---|
| **Cluster**（brief §2.2 Thylas Cluster） | 与 Workspace 同位（关联 GSC/WAM/多 repo/资料/artifacts/coworkers 的容器）。**砍掉**，职责并入 Workspace。若未来出现"跨 Workspace 项目群"需求再议。 |
| **Workspace** | 保留现名，含义收窄为"环境/机构层"。 |
| **Project** | 新对象：工作现场层，属于唯一 Workspace。 |

## 5. 对既有事实的影响

| 现状（【事实】） | 校准后要动的 |
|---|---|
| Rail 每个 Workspace 直接展开 Files/Whiteboard/Processes（`src/shell/Rail.tsx`） | 这三类挂到 Project 下；Workspace 内新增"项目地图"（画布） |
| `product/definition.md` 把 central object [C] 判给 Workspace | 判词待重裁：候选改为 Project（工作现场）或双中心（Workspace=环境中心，Project=工作中心）【开放】 |
| GSC scope 词表 personal/workspace（`D:/github projects/GSC/DOMAIN_MODEL.md`） | 大概率三层：personal / workspace / project；共享 = 引用不复制【提案】 |
| Coworker 成员制（WORKSPACE-RELATIONSHIP.md） | 保留为"入职层"，补"参工层" |

## 6. 待拍板（逐条，默认已给）

| # | 问题 | 默认【开放】 |
|---|---|---|
| 1 | 今天 Workspace 里的 Files/Boards/Processes/Notes 迁入 Project？ | 迁，允许"未归类"暂存 |
| 2 | Artifact 资产库放 Workspace 级、项目只引用？ | 是（跨项目复用的前提） |
| 3 | Context 三层：personal / workspace / project，共享=引用？ | 是 |
| 4 | 项目画布：每个 Workspace 一张地图，Overview 做跨 Workspace 聚合投影？ | 是 |
| 5 | Cluster 砍掉？ | 砍 |
| 6 | 项目属于唯一 Workspace？ | 是（否则入职授权闭合不了）；跨 Workspace 协作走 Context 引用 |

## 7. 假设改写记录

| 假设 | 校准前 | 校准后 |
|---|---|---|
| H1 身份锚在意图 | 附带"Project 换代 Workspace" | **层级部分改写**：Project 身份仍独立于文件夹，但归 Workspace 管辖（不换代、不并列） |
| H2–H5 | — | 不受层级影响，保留 |

## Change log

| 日期 | 变更 |
|---|---|
| 2026-11-22 | 创建。定位校准入档：Workspace ⊃ Project 双层定位卡、Coworker 两层制、Cluster 砍掉、6 条待拍板。 |
