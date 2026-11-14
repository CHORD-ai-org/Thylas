# Backend roadmap — 五个阶段

**状态：** 2026-11-12 记录；**Phase 1 于 11-13 完成（P1-0 … P1-8）**。
**当前后端（11-14 08:20）：** `server/` 30 个 `.ts` 文件；9 个 API 路径 / 25 个操作（含 Profile 管线 7 个、A1 的 `GET|PATCH /api/user`）、3 张表 + 3 个迁移、dev session 的 401/403、本地目录文件存储、chat 与 user 双模式。P1-8 之后有外部提交加入 `server/profile/*`、`server/routes/profile.ts` 与 `src/pages/user/ProfileInit.tsx`；逐条见 [`AUDIT.md`](AUDIT.md)（18:05 快照，头部有更新注记）与 [`PHASE-2-USER.md`](PHASE-2-USER.md) §0。真库 CLI、CHORD IdP verifier、S3 直传未验。
**不是同一份：** `docs/planning/roadmap.md` 是 2026-11-07 的 UI MVP 里程碑 M0–M6。

---

整个 Roadmap 分为五个阶段：

### Phase 1 — Backend Foundation
搭建后端基础设施：数据库、API 层、认证与授权、文件存储、环境配置。先确定核心数据模型和基本 CRUD 能力，保证系统具备可靠的持久化基础。

展开计划：[`PHASE-1.md`](PHASE-1.md)。

### Phase 2 — Core Entities
实现四个核心对象：User、Workspace、Coworker、Artifact。建立它们之间必要的关系，支持创建、编辑、查询、归档，以及 Workspace 成员和 Coworker 的基本访问权限。

**User 模块（11-14：文档 + A0 + A1 落地）**：规格 [`PHASE-2-USER.md`](PHASE-2-USER.md)、实施分类与路线图 [`PHASE-2-USER-PLAN.md`](PHASE-2-USER-PLAN.md)。Q1 已由 D-059 拍板（服务端 per-user 文件，暂不建 `users` 表）；A1 的 displayName 持久化已验 PATCH→GET。Profile Initialization 管线已由外部提交实现，专门文档在 `docs/development/profile/`。A2 prefs / A3 记录展示未开工。

### Phase 3 — Working Experience
实现 Conversation、Message 和 Current Work。支持用户与 Coworker 对话、历史记录持久化、基础上下文注入，以及工作状态的创建和更新。MVP 阶段直接连接 DeepSeek API，不引入 WAM。

### Phase 4 — Artifact & Resource Management
支持 Artifact 的创建、编辑、版本记录、Workspace 关联和基本引用；支持上传文件、管理资源，以及让 Coworker 在授权范围内读取相关内容。先保证 Artifact 是真正可用的持久化对象，而不是复杂的知识图谱。

### Phase 5 — Integration & Stabilization
打通前后端所有核心流程，完善权限校验、错误处理、日志、数据迁移和部署。验证完整用户路径：创建 Workspace → 创建 Coworker → 开始协作 → 生成 Artifact → 在后续工作中重新使用。

### 核心建议与目标
我的核心建议： MVP 后端不要围绕未来的 WAM 架构设计，而要围绕当前 Thylas 的真实产品流程设计。优先保证数据正确、关系清晰、接口稳定、功能可用。为未来接入 WAM 留出合理的扩展空间即可，不要提前实现它。

最终目标不是做出一个庞大的 Agent Backend，而是让 Thylas 成为一个真正能够保存、组织和持续推进用户工作的产品。
