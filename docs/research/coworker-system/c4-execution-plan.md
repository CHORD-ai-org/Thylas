# C4 协作 — 执行计划

**Date:** 2026-11-24 · **Status:**【提案】待开工。上游：Coworker-System-Plan §27（C4-1/2/3）、§7（本地闭环已裁）、§16–19（技术底座）、§23（借语义不借依赖）。
**红线**：轻量协调器 = 只做协作原语的状态机，不做通用编排；禁递归 spawn / 开放式 agent 聊天 / 全 mesh（反模式黑名单 §19）。Q-D 不在此裁——Methodology 保持声明式。

---

## 单元与顺序

### C4-1a 协作原语状态机（纯函数，无 I/O）

- `src/lib/collaboration.ts`：typed state + **完整迁移表**（借 LangGraph 语义：typed state、显式迁移、无隐式边）。
  - 状态：`proposed → delegated → working → responded | challenged → … → completed | needs_human | cancelled`。
  - 动词（迁移）：delegate / respond / challenge / negotiate / handoff / request_human / approve / reject / complete。
  - CoworkOS ↔ A2A 映射（§18）：request_human = INPUT_REQUIRED；approve/reject = AUTH_REQUIRED 解闸；handoff = Task 转移；complete = 终态。
- **门禁：状态机无空洞态**——(state × verb) 矩阵全枚举，每格要么是定义好的迁移、要么是显式拒绝（contract 错误），测试断言全矩阵，一个洞都不许有。

### C4-1b 场次实体 + 事件 journal（先落库后执行）

- `collaboration_sessions` 表（migration 0009）：id · projectId（FK） · state · participants（jsonb：coworkerA/B id+name） · budget（jsonb：maxSteps/maxSeconds） · currentStep · summary · timestamps。
- 每次迁移 = **先写 `coworker_events`（append-only）再执行**——崩溃可恢复、可回放（§30）。
- API（projects 路由族）：`POST /api/projects/:id/sessions`、`GET`（list/get）、`POST /:sid/transition`（body {verb, payload?}，服务端跑迁移表校验）、`POST /:sid/stuck|resume`（复用 needs_human 形态）。
- **门禁**：非法迁移 400 且状态不变；每迁移恰一条事件（journal 断言）。

### C4-2 本地协调器（双 Coworker 一场）

- `src/services/collaboration/session.ts`：`runCollaborationSession({session, askFn, projects, coworkers})`——**hub-and-spoke**：协调器居中，Coworker 不互聊（§17 红线）。
- 一场的固定剧本（不是通用引擎）：delegate A → A 生成-校验（**复用 C2-3 loop**，轮次计入预算）→ handoff（**复用 C3 包**）→ B 生成-校验 → complete。
- **预算强制**（§17）：maxSteps / maxSeconds 由协调器检查（不是模型自觉），触顶 → `needs_human` 并带原因。
- 依赖全注入（askFn/clients），测试零 AI 调用。
- **门禁：双 Coworker 可追溯协作一场**——脚本 askFn 跑完全场，断言：状态序列完整、A/B 各自署名的产出落回、事件可回放成完整链（谁发起/给了什么/期望/产出/是否被接受五问可答）。

### C4-3 对抗性旅程 + UI

- 测试组（错误路径必走，§25）：
  - **断网**：askFn 抛错 → 场次停在原状态可恢复，不半死；
  - **半交接**：handoff 事务失败 → 场次无半状态（C3 原子性复用）；
  - **越权**：非本 workspace 会话操作场次 → 403；
  - **断链**：参与者 coworker 不存在 → contract 拒绝；
  - **连点**：complete 幂等（第二次返回同一终态，不产生第二条事件风暴）。
- UI：Projects 抽屉"协作"区——发起一场（任务 + A + B + 预算）、状态与步骤（从事件读）、needs_human 浮出（复用"需要你"红标）；错误路径一行字反馈（文字预算内）。
- **门禁：对抗五连全过 + 错误反馈预算合规**。

### K 类

- 旅程脚本补断（"3 分钟雇到"与协作一场各一条 e2e，能写多少写多少）；文案走查；README/THINKING 归档；英文 commit。

## 质量关卡（全过 = C4 完成 = C0–C4 全交付）

1. 状态机 (state × verb) 矩阵零空洞。
2. 双 Coworker 协作一场：状态序列 + 双署名产出 + 事件链可回放。
3. 预算强制：触顶 → needs_human（断言恰在上限停）。
4. 对抗五连全过，错误反馈一行字、预算内。
5. 全量 tests + tsc 干净。

## 依赖与边界

- 复用：C2-3 生成-校验 loop、C3 交接包、coworker_events journal、needs_human 形态。
- 不做：WAM 对接、通用编排引擎、递归 spawn、Methodology 可执行化（Q-D 未裁）、token 计量精确统计（v0 以步数+秒为硬预算，token 只记不卡）。
