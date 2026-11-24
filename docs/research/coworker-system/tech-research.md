# Coworker 技术调研 — 效果与性能

**Date:** 2026-11-24 · **Status:** 调研记录（支撑规划 PDF Part VII 技术底座）。
**两轮**：①多智能体编排实证（成本/延迟/模式）②协作协议格局（MCP/A2A/ACP）。

---

## 1. 多智能体编排实证

| 发现 | 数据点 | 来源 |
|---|---|---|
| 多智能体典型开销 **3–10× token** vs 单体 | Anthropic 2026-01 综述 | profectuslab |
| 交接是有损的 | 每次 handoff 丢细节；"hop 一无关、hop 三关键"的细节已丢 | 同上 |
| 并行 ≠ 更快 | 一客户单体循环比多智能体 harness 快约 2× | 同上 2026-10 |
| **拆分沿上下文边界，不按职位名** | 正当拆分三种：上下文隔离（约 >1k token 噪声）/ 真并行 / 专门化；+ 独立校验（不见构建过程） | profectuslab / velura |
| 层级 supervisor-worker 性价比最优 | 97.7% 效果 @ 60.9% 成本（1 万份 SEC 文件基准）；frontier 只给判断环节，执行用小模型（省 32%） | tentoro |
| 生成-校验回路 | rubric 驱动（"每个数字有引用"，不问"好不好"）；**硬上限 2–3 轮**；校验者要比生成者便宜 | velura |
| 交接必须结构化 | JSON（task/instructions/inputs/output_schema/max_steps），"自由聊天式交接 = 降神" | velura |
| **先建 trace 再建第二个 agent** | 每边界一个 span、每次交接一条结构化记录，可回放；OTel GenAI 约定 | velura |
| 拓扑成本 | 全 mesh = N² 通信路径；生产收敛 hub-and-spoke/层级 | tentoro / llm4agents |
| 预算由编排器强制 | max steps / tokens / seconds，不信模型自觉 | velura |
| 反模式 | 开放式 agent 聊天、递归 spawn、按职位拆 agent、共享自由文本记忆、盲聚合、ring leadership | 多源一致 |

## 2. 协作协议格局（2026）

| 协议 | 边界 | 关键机制 | 状态 |
|---|---|---|---|
| **MCP**（Anthropic→LF） | 模型 ↔ 工具/数据 | 能力调用、资源读取 | 成熟，1.0 预计 2026 Q3 |
| **A2A**（Google+LF，150+ 成员） | 智能体 ↔ 智能体 | Task/Message/Artifact/AgentCard；**异步优先状态机**（INPUT_REQUIRED / AUTH_REQUIRED） | v0.x，活跃 |
| **ACP**（IBM） | 企业 REST 互操作 | 命名空间/会话/Run 生命周期 | v0.3；**已宣布收敛向 A2A**（2026-05） |

关键结论：
- 三协议都是**线缆**：持久上下文/权限/审计不归协议——归 Context 层（印证 CoworkOS 不做记忆、GSC/分区持上下文的边界）。
- A2A 状态机 = 审批链/长任务的结构骨架：INPUT_REQUIRED（请求人工）↔ 我们的 Request Human Input；AUTH_REQUIRED ↔ Approve/Reject。
- 工程坑：AgentCard 握手 token 膨胀（高频协作握手成本>任务成本）；跨 agent 权限链（RFC 8693 Token Exchange 在引入）。
- 延迟量级：MCP 毫秒 / A2A 秒–分钟 / ACP 秒–小时。

## 3. 对我们设计的映射（结论）

| 设计项 | 调研修正 |
|---|---|
| 本地协调器（Q-A 已裁） | 形态 = hub-and-spoke 轻量状态机，非 mesh；不做递归 spawn |
| 交接包 v0 | 字段按结构化 JSON 定形（task/inputs 引用/output_schema/max_steps + 双方署名） |
| 可追溯 | C2 前先建 trace 表（span + 交接记录）——"先建 trace 再建第二个 Coworker" |
| CoworkOS 动词 | 映射 A2A 状态机（见 PDF Part VII §20）；不押注 ACP（已收敛） |
| 模型分层 | 判断（采纳/驳回/裁决）= 强模型；执行/抽取 = 小模型 |
| 红线 | 禁开放式 agent 聊天、按职位拆、共享自由文本记忆、盲聚合；协调消息不产出用户价值的删 |

## 4. 第三轮：技术路径文献（2026-11-24）

- 记忆架构四分层（CoALA/MemGPT）：working/episodic/semantic/procedural；分层蒸馏（episode→semantic consolidation）防 context rot（堆上下文=退化+延迟+成本三杀）；遗忘分级。
- LangGraph 模型：typed state + 节点 + 条件边 + 每步 checkpoint = 持久执行/可中断（interrupt=人工兜底）/可回放；三拓扑（supervisor/swarm/hierarchical）；预算用 loop_count 强制 END。踩坑：checkpoint 须全量状态、非确定性节点须捕获、条件边勿滥用。
- 取舍：借语义不借依赖（自研轻量状态机 TS）；Methodology=程序性记忆（声明式工作流 JSONB），Method Run=状态机实例。
