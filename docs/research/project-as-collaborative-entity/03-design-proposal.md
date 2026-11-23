# 03 · Thylas「项目」设计方案（D2/D3 合流稿）

**Date:** 2026-11-22 · **Status:**【提案】待创始人评审。
**格式约定（创始人 2026-11-22）：** 设计方案一律按【大致执行路径】【和用户的具体例子】【需要改变什么】三段作答。本篇为该格式的文档版。
**前提**：01 定位（Workspace ⊃ Project）+ 6 条默认 + 02 场景（S1–S6 未决的默认处置内嵌）。

---

## 【大致执行路径】

四步，每步可独立交付、可验证：

| 步 | 交付 | 验证关卡 |
|---|---|---|
| 1. **骨架（数据先行）** | Project 实体 + 资源引用 + 成员；现有 workspace 内容挂 `project_id`（空=未归类） | 一个本地文件夹连进项目并可解析 |
| 2. **项目地图（先列表后画布）** | Workspace 内项目地图页：项目卡（名字/摘要/参与者/活跃度）；画布复用 C2 手势后补 | 三个 repo 组成一张"Lemma"项目卡 |
| 3. **项目桌面** | 点卡进 C2 空间（复用 boards）+ 讨论/活动窄栏（署名）+ Context 分区入口（GSC project scope） | 产出带署名落回桌面新卡组 |
| 4. **参与与协作** | Coworker 参工层 → 交接包（**复制+留痕**最小版，S1）→ 引用/派生复用闭环（S2：模板后置） | 两项目共享一条 Context 且可解析 |

顺序理由：引用先于画布（对象先于呈现）；参工先于交接（先有成员才有交接）。

对象模型（最小集）：
- **Project**：id、name、summary、workspace_id（唯一归属）、state（active/archived/deleted）、时间。
- **project_connections**（引用不复制）：kind = local-folder / github-repo / file / note / artifact / gsc-context；路径失效→连接器标"待修复"，项目不损坏。
- **project_members**（参工层）：role、资源子集授权、参与历史、署名。
- **Context 分区**：GSC project 级 scope；共享=条目级引用边（S5 默认）。

## 【和用户的具体例子】

- **日常进入**：早上打开 Thylas → Workspace"CHORD"项目地图 → "Thylas 产品研究"卡角标 +3（Mira 昨晚的产出）→ 点卡进桌面，新卡组落在你圈注旁，你的排布一个像素没动。
- **组项目**：新建项目卡"Lemma"，把 `lemma-ai`、`LemmaKnowledgeBase`、`Analysis Engine` 三个 repo 连进来——磁盘不动，桌面只有一张卡。
- **派人**：Workspace 管理面把 Mira 派进"Thylas 产品"，只授权 `docs/` 与 `research/`；她写的决策卡落回桌面，署名 Mira（"由 Mira 提出 · Ceaser 确认"）。
- **共享上下文**：把 GSC 的"检索管线选型"决策同时引用进"GSC 接口"和"Thylas 产品"；A 里更新，B 的引用处标"已更新"——一份数据，两处引用。
- **归档**："Thylas v0 调研"归档后卡片进归档视图，但它的 Context 分区还活着——今天 `@` 它的决策仍可解析；参工历史与署名保留。
- **交接**：Mira 做到一半要下班，打包"当前理解+已做+未决+建议下一步"交给 Archer——Archer 打开是完整工作现场，不是聊天记录。

## 【需要改变什么】

| 类 | 内容 |
|---|---|
| **新增** | Project 实体（`server/persistence/schema.ts` + migration、`src/data/types.ts`）；项目地图页 + 项目桌面路由；引用连接器（本地文件夹、GitHub 先行）；参工成员表 |
| **改动** | Rail Workspace 区：Files/Whiteboard/Processes 挂进项目（现有内容迁"未归类"暂存）；Recently/Notes 归属维度加 project；Overview 加项目卡聚合投影；项目详情可被 `@` 调用（接入 `src/lib/invoke.ts`） |
| **文档重裁** | `product/definition.md` central object 判词：Workspace=环境中心、Project=工作中心（双中心）；coworkers 文档补"参工层"；GSC 侧加 project 级 scope（共享=条目引用）；01 §6 六条默认转"已采纳" |
| **复用不动** | artifact 候选→评审→提交管线（`artifactCandidates`/`mutation.ts`）、C2 手势词汇、WAM 边界、home-interaction 主线 |
| **不做（本轮非目标）** | 实时协作；跨 Workspace 项目转移（先共享）；项目模板/fork；CoworkOS 独立化；署名可验证身份（先显示名）；画布先行（列表先行） |

风险与待验证假设：
- H1（身份锚在意图）在步骤 1 的第一个关卡即被检验——文件夹改名后项目卡存活才算过。
- S1 交接默认"复制+留痕"（安全侧）；若真实使用要求权限转移，步骤 4 内改。
- central object 双中心若引发导航混乱（用户分不清"进环境还是进项目"），回退单中心=Project。

## 项目卡点击效果（补充 · 11-22 晚）

- **单击 = 进入项目桌面**（整屏 C2 空间）：不是弹窗、不是详情页、不是向导。落纸 120ms 过渡；URL 变 `/w/:wsId/p/:projectId`（可回退、可 `@`）。
- 桌面四区：中央 C2 桌面（上次排布原样恢复）｜左材料栏（把材料带进来）｜右窄栏（讨论/活动/署名，可见不抢戏）｜顶（项目名 + 参与者头像 + Context 入口 + 菜单）。
- 落点：有待审产出 → 新卡组一次性高亮 + 右窄栏"3 项待审"，不弹窗；否则恢复上次视口。
- 空项目首次进入：空桌面 + 一行"把材料带进来——连接文件夹或拖入文件"。
- 卡片其余手势：hover=摘要浮层；右键=进入/共享/归档/转移/删除；圈选=交代给 Coworker；拖动=摆位；拖线=项目关系。
- Esc/返回 → 回项目地图；Overview/Recently 聚合处点卡 → 直接进桌面（地图是组织层，非必经）。

## 布局修订（11-22 晚 · 创始人反馈）

- **补：对话抽屉（随时调取的 agent chat）**——⌘J / 顶栏气泡唤起右侧抽屉；不遮桌面、收起后排布不动；圈选 → "带去对话"；对话结论 → "放回桌面"。即"电话在旁边"的可随时拿起形态（Home Conversation 桌面常驻态）。
- **防文字冗余**：UI 文字预算硬规则 → 见 05-execution-plan.md（桌面卡零描述、批注 ≤12 字、窄栏一行一事 ≤20 字、空状态一行、解释进 tooltip）。创始人关注点：UI MVP 文字不得冗余。

## Change log

| 日期 | 变更 |
|---|---|
| 2026-11-22 | 创建。按创始人三段格式落 D2/D3 合流方案：四步执行路径、6 个用户例子、改变清单、风险。 |
