# 11 — 执行计划（可执行拆解）

**Date:** 2026-11-21 · **Status:** [P] 执行拆解，接 `10-execution-roadmap.md`。分 P0 / P1 / K 三阶段，每单元带硬关卡。
**基线：** T0.1 已落地（`src/lib/invoke.ts` + 17 单测，全量验证绿：tsc ✓ · vitest 600 · build ✓ · e2e 356）。

## 0. 前置决策（推荐默认值，改动只需一句话）

| # | 决策 | 推荐默认 | 影响 |
| --- | --- | --- | --- |
| Q2 | `@`/`/` 分流 | **@=对象，/=动作**（按 02 已写） | P0-1/P0-2 的触发设计 |
| Q7 | Artifact 持久化 | **先本地 store + 显式标注 prototype**，不动 schema | P0-8 的写入位置 |
| Q1 | 合并后的 Home 是否即 landing | **暂不动**（MVP 不依赖；Q1 已随合并决策变形） | 无 |

**已定（2026-11-21 创始人）**：① Home Conversation = Overview 输入框与 Chat **合并演化**
（01/09 已修订）；② Agent 执行 = 真实编排（`/api/ai` + profile 管线模式）——与本计划
P0-6/T1.2 一致。UI 合并任务（对应 10-T1.7）排 P0-8 之后或 P1，**不阻塞 MVP 演示**。

---

## P0 — 交互通路 + MVP 抽取演示（功能优先）

### P0-1 Composer token 接入 ✅ DONE
- **目标**：`@` / `/` 触发检测进 composer，唤出调色板。
- **改动**：`src/pages/chat/Composer.tsx`（textarea `onChange/onKeyUp` 取 `selectionStart` → `parseInvokeToken()`；触发态存 `{trigger,start,query}`）。
- **验收**：e2e — 键入 `@` 开面板；`user@host` 不触发；Esc 关闭且文本不动；CJK 可用。
- **风险**：textarea caret 处理（低）。**独立性**：独立。

### P0-2 InvokePalette 组件 ✅ DONE
- **目标**：分组调色板（Coworkers/Artifacts/Resources/Workspaces），键盘全通路。
- **改动**：新建 `src/pages/chat/InvokePalette.tsx`；数据源 `coworkersView()/workspacesView()/listNotes()/artifactsView()`；语法复用 `CommandPalette.tsx:11-81`（listbox、aria-activedescendant、↑↓/Enter/Esc）。
- **验收**：8 行默认 + 键入过滤 + 空态（"No match + 创建动作"）；非成员对象不可见。
- **风险**：低。**独立性**：依赖 P0-1。

### P0-3 Chip 模型（含 draft） ✅ DONE
- **目标**：选中即插入**完整 chip**（wikiCompletion 的"不留半截 token"原则）；chip 弹层 = 绑定为上下文 / 仅引用 / 移除；draft 会话也可用（修 `Composer.tsx:34-36` 缺口）。
- **改动**：`Composer.tsx` + `ContextBar`（chip 行复用）；绑定写 `conversation.context`（现有 `addContextSource`）。
- **验收**：e2e — chip 增删、绑定后 `context` 数量增长、draft 持久可用、`toContextSource` 返回 null 的种类只做"仅引用"。
- **风险**：低-中。**独立性**：依赖 P0-1/2。

### P0-4 Block 契约扩展（T0.3） ✅ DONE
- **目标**：`lib/chat.ts` 增加交互块 kinds：`proposal | candidates | source-picker | diff | approval`（含 `isBlock` 校验、32 块上限不变）。
- **验收**：client+server 同编译；既有 chat 测试全绿。
- **风险**：低（共享契约，一次改完）。**独立性**：独立。

### P0-5 源发现块（source-picker） ✅ DONE
- **目标**：选抽取来源：notes（按日期/标题）+ 会话记录 + files；多选。
- **改动**：`src/pages/chat/` 新块组件 + `ChatCore.tsx` `MessageBlock` 分支；数据来自 `state/notes.ts`、`state/chat.ts`、files 选择器。
- **验收**：块内多选、计数、日期过滤；空态诚实。
- **独立性**：依赖 P0-4。

### P0-6 抽取服务（candidate 产生） ✅ DONE
- **目标**：对选中来源跑抽取 → artifact-shaped 候选（带 evidence span + confidence + `informationType`）。
- **改动**：`src/services/ai/` 增加结构化抽取调用（prompt-parse，模式照 `server/profile/extract.ts`）；候选写入新 `src/state/artifactCandidates.ts`（本地 envelope，**显式标注 prototype**）。
- **验收**：候选含可回溯 evidence（能在原文定位）；不产生 canonical；失败为 typed error。
- **风险**：A5 无结构化输出通道 → prompt-parse 脆弱（**标注模拟**）。**独立性**：依赖 P0-5。

### P0-7 候选审阅块（candidates） ✅ DONE
- **目标**：可管理候选集：accept / reject / edit、批量选择、按类型分组；复用 `ProfileInit.tsx:220-261` CandidateCard 与 `lib/profile.ts:58-77` 状态机（pending/accepted/rejected/edited）。
- **验收**：e2e — 编辑 3、拒绝 4、接受 5 的路径；信息负荷规则生效（摘要先行、evidence 按需）。
- **独立性**：依赖 P0-4/6。

### P0-8 提交 + 溯源 + 历史（MVP 收口） ✅ DONE
- **目标**：接受项提交为 canonical artifact（本地 store，Q7 默认），带 provenance（sources/evidence/author）、幂等 content key、append-only history——语义镜像 `server/profile/store.ts:198-242`。
- **验收**：**08 §4 端到端 e2e 走通**：选源→抽取→审阅→提交→带溯源持久；重复提交幂等；UI 全程标注 "local prototype"。
- **风险**：中（MVP 最大件）。**独立性**：依赖 P0-6/7。

---

## P1 — 治理闭环

| # | 目标 | 改动 | 验收 |
| --- | --- | --- | --- |
| P1-1 | `/api/ai*` 加 session 鉴权（现无检查） | `server/router.ts:48-50` + ai-handler | 未授权 401；既有 ai 测试绿 |
| P1-2 ✅ DONE | `MutationIntent` 类型 + 校验（06 §2） | `src/lib/mutation.ts` + 8 测试 | 风险分级、执行权≠提交权、幂等提交门 |
| P1-3 | 对话驱动的 Profile 更新（08 §6）接真实 pipeline | `state/profile` 客户端 + Proposal 块 | 候选→commit→history 真持久 |

## K — 已知问题（随时修，不阻塞）

| # | 问题 | 证据 |
| --- | --- | --- |
| K-1 | chat PUT 冲突不重放（多端编辑会丢） | `state/chat.ts:117-121` |
| K-2 | lint 5 errors / 2 warnings（既有） | `npm run lint` |
| K-3 | `ContextSource` 与 GSC "Context" 撞名 → 计划改 `ContextBinding`（A6，随 P0-4 一次做或不做） | 09 §2 |

---

## 硬关卡（每个单元收口时必须满足）

1. tsc ✓ / vitest 全绿（含新增单测）/ build ✓ / e2e ≥356 不回退 / lint 无新增。
2. 行号证据：完成报告引用改动文件:行号。
3. 模拟诚实：无后端的部分显式标注 prototype，不假冒功能（interaction contract：无假控件）。
4. 不改无关代码、不加依赖、不动 WAM 边界。

## 排序与依赖

```
P0-1 → P0-2 → P0-3 ┐
P0-4（独立，可并行）├→ P0-5 → P0-6 → P0-7 → P0-8（MVP 演示达成）
                   ┘
P1-1 独立；P1-2 依赖 P0-4；P1-3 依赖 P1-2
K-1/K-2/K-3 独立随时插队
```

**最快见效路径**：P0-1→2→3（@ 通路可用）→ 4→5→6→7→8（08 §4 演示）。P0-4 可与 P0-1..3 并行。
