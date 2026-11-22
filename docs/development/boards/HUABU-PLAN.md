# 复刻 Huabu 到 Thylas 画板 — 计划（含本土改良）

**Date:** 2026-11-21 · **Status:** **[P]** 计划稿，未实施。决策标注沿用 THINKING.md 约定（[C]/[P]/[Q]/[Deferred]）。
**源:** microsoft/Huabu（`microsoft.github.io/Huabu`）。**宿主:** Thylas 现有画板（`/w/:wsId/boards/:boardId`）。

---

## 1. 复刻什么：Huabu 的一句话模型

Huabu = **无限工作面（Space）**，"你与智能体共同思考的地方"。命题：**"Thoughts become structure."**
四步循环：**EXTERNALIZE（外化）→ ARRANGE（排布）→ DELEGATE（委派）→ RETURN（回归）**。

| Huabu 概念 | 含义 |
| --- | --- |
| **Space** | 无限画布，思考的场所 |
| **Node** | 想法 / PDF / 网站 / 图片 / 视频 / 文件 → 各是一个可见节点，可放置、重访、连接 |
| **Arrange** | 位置即思考（非装饰）；按时间或方向排布 |
| **Connect** | 节点连成对人和智能体都可读的上下文 |
| **Brief → Delegate** | 给智能体简报；并行跑任务 |
| **Return** | 每个结果回到 Space，成为可交付工作 |

差异主张：用一张"活的表面"取代线性 prompt/聊天流——"别再对着虚空提示"。

---

## 2. 本土改良（这是差异点，不是翻译）

照搬是平庸的。中国市场的来源、模型、协作、合规、场景都不同，必须先定这条线。**[P]**

| 维度 | 国际版默认 | 本土改良 |
| --- | --- | --- |
| **输入源（Bring in anything）** | PDF、网站、图片、视频、文件 | **微信公众号文章**（mp.weixin.qq.com）、飞书/钉钉/企微文档、语雀、腾讯文档、WPS、知乎、小红书、B站、**知网 CNKI**、本地 md/Word |
| **模型 / 智能体** | OpenAI / Anthropic | **国产 LLM**：DeepSeek（`server/config.ts:75` 已是默认）、Kimi/月之暗面（已有）→ 补 Qwen/通义、豆包、GLM、文心、MiniMax；支持**本地化部署**（DeepSeek 本地 / vLLM），数据不出境 |
| **命名 / 文案** | Space / node / brief / delegate | **画布**（Space）、**素材卡**（node）、**指令**（brief）、**委派**（delegate）；界面中文优先，英文作副 |
| **协作生态** | Slack / Teams | **微信 / 企微 / 飞书 / 钉钉** 分享与回流；小程序 / H5 分享码 |
| **合规** | GDPR | **PIPL / 数安法**、生成内容**内容安全审查**、境内存储、实名与水印、等保 |
| **场景 / 产出** | 通用 ship work | **中国特色可交付物**：公文、教研/课程设计、论文写作、招投标、电商/小红书文案、政务汇报、党建材料 |
| **输入习惯** | 拉丁键盘 | **中文 IME 兼容**、拼音检索、短语/模板库、长文写作习惯 |

> 本土改良不是一节附录，而是**并行工作流**（见 §5）：输入源适配 + 国产模型接线 + 合规 + 中文 UX，与画布能力同等优先。

---

## 3. 概念映射：Huabu → Thylas 现有画板（核到文件）

Thylas 画板**已具备**一个严肃的无限画布底座，复刻是"补节点与委派"，不是从零造。

| Huabu | Thylas 现有 | 文件 / 行号 | 状态 |
| --- | --- | --- | --- |
| Space（无限工作面） | `Board` + viewport pan/zoom | `types.ts:198`、`scene.ts:193-236` | **[C] 已有** |
| Arrange（位置即思考） | 自由放置 + `sections`（命名区域）+ 拖拽/对齐/分布 | `BoardSection` `types.ts:163`、`gestures.ts` | **[C] 已有** |
| Connect（可读上下文） | `BoardEdge`（label/side/shape/direction），拖锚点连线，空白处释放=建卡并连 | `types.ts:188`、`useBoardEditor.ts:596-648` | **[C] 已有** |
| Node（可见节点） | `BoardCard` | `types.ts:173` | **[C] 已有，但只有文本**（title/eyebrow/lines） |
| 重访 / 引用 | `ref`（引用标签 + 跳转居中） | `types.ts:184`、`Boards.tsx:351,894` | **[C] 已有（弱）** |
| 运行状态回流 | `live`（`{runLabel,note}` + LIVE 点） | `types.ts:186`、`Boards.tsx:354` | **[C] 已有（占位）** |
| Bring in anything | — | — | **缺失** |
| Brief → Delegate → Return | — | — | **缺失**（且 THINKING.md 禁止伪造） |

底座已有的部分（视口、手势、历史 undo/redo、scene 几何、连线）**不重写**——只在其上加节点种类、导入、委派。

---

## 4. 差距（要补什么才能对上 Huabu）

1. **节点只有文本。** Huabu 的 node 是想法/PDF/网站/图片/视频/文件。→ 给 `BoardCard` 加 **`kind`**（`idea | note | file | link | web | pdf | image | video | source`），不同 kind 有不同渲染与操作（图片缩略、网页 favicon+标题、PDF 首页、视频封面、文件元信息）。
2. **没有"引入任何东西"。** → 导入/摄入：拖文件到画板成节点；粘贴 URL 成 `web/link` 节点（抓标题/摘要）；从 Thylas 的 files/notes 一键拖入（`ref` 升级为真引用）。
3. **没有"排布成时间/方向"。** → 时间轴/泳道布局预设（sections 已是区域；补"按时间排列 / 按方向排列"的一键整理）。
4. **没有"委派→回归"循环。** 这是 Huabu 的灵魂，也是**唯一必须诚实**的部分（THINKING.md：no decorative multi-agent, no WAM）。→ 见 §5-D 的诚实切法。

---

## 5. 计划（分阶段，逐项标注）

### A. 节点与摄入（P0，最贴 Huabu 的"Externalize / Bring in"）
- **A1 [P]** `BoardCard.kind` + 每 kind 的渲染卡面（沿用 `scene.ts` 高度估算 `heightOf`）。纯前端，不动存储形状之外的字段。
- **A2 [P]** 拖拽/粘贴摄入：拖本地文件 → `file/pdf/image/video` 节点；粘贴 URL → `web/link` 节点（标题+摘要，本地抓取可先 mock，标 `[Q]` 是否联网抓取）。
- **A3 [P]** 从 Thylas 内部引入：把 files/notes 拖进画板 → 真引用卡（`ref` 指向 id，点击打开）。复用现有 artifacts 引用。

### B. 排布与上下文（P0/P1，"Arrange / Connect"增强）
- **B1 [P]** 一键排布：按时间 / 按方向 / 按 section 整理卡片（`gestures.ts` 已有对齐分布，扩成布局预设）。
- **B2 [P]** 边语义升级：给 `BoardEdge` 加类型（依赖/引用/因果/反对），连线即"可读上下文"。
- **B3 [P]** 上下文打包：把选中的一组节点+边导出成"可读简报"（Markdown），作为喂给智能体的 brief 输入。

### C. 本地改良工作流（P0 起，并行，见 §2）
- **C1 [P]** 国产模型接线：provider 列表补 Qwen/豆包/GLM/文心/MiniMax（`server/config.ts` 现有 deepseek/kimi/openai/anthropic/openrouter）。
- **C2 [P]** 本土输入源适配：微信公众号/知乎/小红书/B站/语雀/腾讯文档 的链接解析（标题+摘要+封面）。
- **C3 [P]** 中文 UI：Space→画布、node→素材卡、brief→指令、delegate→委派；中文 IME 友好。
- **C4 [P]** 合规层：内容安全审查（生成/导入内容）、境内存储、水印/实名钩子、PIPL 声明。
- **C5 [Q]** 是否做微信/飞书/钉钉回流（分享/导入）——生态依赖，单独决策。

### D. 委派与回归（P1，必须诚实，THINKING.md 红线）
Huabu 的"agents run in parallel and return to the Space"在 Thylas 里**不能假装成真多智能体**。诚实切法：
- **D1 [P]** "指令卡"（brief card）：把 B3 的上下文简报做成画板上的一个节点，可"提交给 Coworker / Chat"。
- **D2 [P]** 结果回流为节点：把 ChatCore / Processes（`live` 字段已占位）的产出作为新卡落回画板，带 `live` 状态。**产出真实可追溯，不伪造成功。**
- **D3 [Deferred]** 真并行多智能体编排、A2A 通道、跨卡自动推理——归 WAM/运行时，不在画板内实现（THINKING.md：no WAM, no decorative multi-agent）。
- **D4 [Q]** 委派的目标实体：Coworker？Process/Run？还是本地脚本？待产品定。

### E. 收敛
- **E1 [P]** 本土模板库（公文/教研/论文/小红书…）作为预置 section+卡。
- **E2 [P]** 导出：把画板导出为 Markdown / 图片 /（本土）Word/PDF，形成"可交付工作"。

---

## 6. 建议落地顺序

| 序 | 单元 | 依赖 | 价值 |
| --- | --- | --- | --- |
| 1 | A1 节点 kind + 渲染 | — | Huabu 观感的地基 |
| 2 | A2/A3 摄入（拖文件/贴链接/内部引用） | A1 | "Bring in anything" |
| 3 | C3 中文 UI 命名 | — | 本土可读性 |
| 4 | B1 一键排布 + B2 边语义 | — | "Arrange/Connect" |
| 5 | D1/D2 指令卡 + 结果回流（诚实） | B3 | "Delegate/Return" 的可信版 |
| 6 | C1 国产模型 + C2 本土源 | A2 | 本土差异点 |
| 7 | B3 简报导出 + E2 产出导出 | — | "work that ships" |
| 8 | C4 合规 + E1 模板 | C1/C2 | 本土落地前提 |

---

## 7. 边界与不做（守住 THINKING.md）

- **不重写**现有画板底座（viewport/gestures/history/scene 已测）。
- **不伪造智能体**：D 段委派必须产出真实、可追溯结果；不假装并行多智能体运行时（[Deferred]，归 WAM）。
- **不改无关架构**：只在 `Board`/`BoardCard`/`BoardEdge` 与摄入层加字段/动作。
- **合规优先**：本土源抓取与生成内容先过内容安全，再落卡。
- **[Q] 待定**：联网抓取的边界、委派目标实体、微信/飞书集成深度、是否要真·无限多人实时协作（现为本地 prototype）。
