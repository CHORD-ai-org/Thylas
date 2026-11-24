# C0 持久化垫层 — 执行计划

**Date:** 2026-11-24 · **Status:**【提案】待开工。上游：Coworker-System-Plan §27（C0-1/2/3）、§23（选型）、§24（云四条）。
**原则**：契约即规格、先建 trace、门禁=自动化断言。镜像 projects P0 的既有模式（契约 `src/lib/*` → 路由 `server/routes/*` → PGlite 测试）。

---

## 单元与顺序

### C0-1a Schema + Migration

- `server/persistence/schema.ts` 新增两表 + migration `0005`：
  - **`coworkers`**：id（text pk，客户端 id）· ownerId（云四条的租户键）· name · description · role · domain · avatar（jsonb：手绘剪影配置）· mind（jsonb：四维配置）· methodologies（jsonb 数组）· toolsets（jsonb）· createdAt/updatedAt/deletedAt（软删）。
  - **`coworker_events`**（C0-3 trace）：id · coworkerId（FK cascade）· projectId（可空）· actorKind（user/coworker/system）· verb · payload（jsonb）· createdAt。索引 `(coworkerId, createdAt)`。**append-only**：无 update/delete。
- 门禁：migrate.test 断言两表存在 + 双跑幂等。

### C0-1b 契约 + 客户端

- 扩展 `src/lib/coworkers.ts`（同域一份契约）：`COWORKERS_PATH`、CoworkerDto/EventDto、错误信封（镜像 projects）、name/avatar 校验复用现有。
- 新增 `src/services/coworkers/client.ts`（typed、不抛错）+ 客户端测试。
- 门禁：双端编译错误（字段改动 tsc 报警）。

### C0-1c 路由 + 跨会话门禁

- `server/routes/coworkers.ts`：GET/POST `/api/coworkers`、GET/PATCH/DELETE `/:id`、GET/POST `/:id/events`。会话 → ownerId 校验 → 写（D-056 序）。
- 注册进 `server/router.ts`。
- **门禁（C0 主关卡）**：POST 创建 → 全新客户端 GET 仍在（跨会话存活）；软删后列表消失；越权（他人 ownerId）403。

### C0-3 trace 可回放

- events 写入走同一 route 模块；回放 = 按 `(coworkerId, createdAt)` 升序读。
- **门禁**：写 N 条事件 → 回放序列 == 原序列；崩溃中途可续（只追加，天然安全）。

### C0-2 原型对齐（双轨读）

- `state/coworkers.ts` 保 hook API 不变（useCoworkers/createCoworker/…），底层改双轨：**服务端优先**，不可达时落回 localStorage envelope（`thylas:coworkers:v1`）；写入同理。
- 页面零改动：CoworkerDirectory/New/Detail/Config/TeamGallery 不动。
- **门禁**：现有 `coworkers.test.ts` 全过（无回归）+ 双轨测试（server 路径 / fallback 路径各一组）。

### K 类

- 现有 5 页面文案顺手过文字预算；README/THINKING 归档；英文 commit（预期又被钩子拆分，照旧）。

## 质量关卡（全过 = C0 完成）

1. Coworker 跨会话存活（API 级断言）。
2. events 回放 == 原序列。
3. 5 页面无回归（vitest + tsc 干净，全量 631+ 不少）。
4. 云四条自查：稳定 id ✓ 无本机绝对状态 ✓ jsonb 可导出 ✓ ownerId 租户键 ✓。

## 依赖与边界

- Q-E = 表（云前瞻已加强，默认裁决）。
- 不做：入职名册（C1-1）、派工（C2）、协作状态机（C4）——C0 只有实体 + 事件。
- Coworker 的"跨 Workspace"特性由 ownerId 承载归属；入职关系表留 C1。
