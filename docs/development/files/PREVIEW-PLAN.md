# 文件预览 — PDF / CSV / MD 实施计划

**Date:** 2026-11-15 · 状态：**已实施（P0–P4）**，记录见 §10 · 范围：`/w/:wsId/files/:fileId` 详情页的预览区

---

## 1. 审计：现在为什么"没有预览"

| 项 | 现状 | 证据 |
| --- | --- | --- |
| 数据模型 | `FileItem` 只有 `id / wsId / folderId / name / kind / size / updated / source / usedBy`——**没有字节、没有 mime、没有 url** | `data/types.ts:45-55` |
| 预览区 | 一张 metadata sheet，明写 `No file bytes are stored in this build.` / `No preview in this build.` | `Files.tsx:388-397` |
| 涉及的种子 | `eval-log.csv`、`tokens-per-run.csv`、`protocol-v3.pdf`、`wu-2025.pdf`、`notes-on-baseline.md`（还有其它工作区的文件） | `data/mock.ts:54+` |
| 可用依赖 | **没有** PDF / CSV 库；`react-markdown` 也没有 | `package.json` |
| 可复用 | `parseMarkdown()` + `MarkdownBody`：自写、安全（无 `dangerouslySetInnerHTML`、无 HTML 节点） | `pages/chat/Markdown.tsx` |
| e2e 约束 | `Files.tsx` 里**禁止出现 `setNotice`**（"点击后道歉"已被全局禁掉）；文件表格有列宽/字号断言 | `ui-checks.mjs:1276` |

结论：预览不是"画个框"，是**先得让文件有内容**。这一条决定了下面第一个决策。

---

## 2. 关键决策（需要拍板）

### D1 · 字节从哪来

| 方案 | 做法 | 代价 |
| --- | --- | --- |
| **A（建议）内置样例** | `public/samples/` 放三个真实文件；`FileItem.preview` 指过去；标题下标 `sample file` | 零后端改动，真渲染；代价是"样例"而非用户真实文件 |
| B 用户上传 | 先做上传（当前 Upload 明确禁用），再把 blob 交给预览 | 需要存储、类型校验、权限，是本计划 2–3 倍的工作量 |
| C 只做"假渲染" | MD/CSV 用内联字符串，PDF 画一张假页面 | PDF 是假的，等于骗人 |

**建议 A**：先把预览这件事做对、做真，上传另起一轮。所有预览标题下都标 `sample file — bundled with the prototype`，不假称是用户数据。

### D2 · PDF 怎么渲染

| 方案 | 好处 | 代价 |
| --- | --- | --- |
| **原生 viewer（建议）** | 零依赖、真分页、真缩放、文本可选 | 样式不可控；Chrome 外移动端可能直接下载；无法抽取文本 |
| pdfjs-dist | 完全可控、可做页码/文本层 | +~1MB 依赖 + worker 配置，首屏和构建都变重 |

**建议原生**：`<iframe src="/samples/protocol-v3.pdf#toolbar=0&navpanes=0">`，右上给"在新标签打开"。用 `navigator.pdfViewerEnabled` 判断，不支持时降级成"下载 / 新标签"卡片，而不是空白 iframe。要精细控制再单开一轮上 pdfjs。

### D3 · CSV 渲染上限

前 **200 行 × 40 列**，超出显示 `showing 200 of 1,284 rows`。不做虚拟滚动（3 万字符内一次渲染没有感知）。

### D4 · MD 复用聊天渲染器

同一套 `parseMarkdown`，保证"助手回答里的 markdown"和"文件预览的 markdown"长得一样。不做 GFM 扩展（表格已支持；脚注、图片仍按源码显示）。

---

## 3. 数据模型（向后兼容）

```ts
// data/types.ts
export type FilePreview =
  | { kind: 'pdf'; url: string }
  | { kind: 'csv'; url: string }
  | { kind: 'md'; url: string };

export type FileItem = {
  /* …既有字段… */
  preview?: FilePreview;   // 缺省 = 保持现在的 metadata sheet
};
```

- 只有 pdf / csv / md 的种子加 `preview`；`parquet / json / png / txt` 暂不加（json/txt 是后续的廉价扩展）。
- 不加 `mime`：`preview.kind` 已经决定渲染器，多一个字段只会多一处不一致。

---

## 4. 组件与文件

| 文件 | 职责 |
| --- | --- |
| `src/lib/csv.ts` | `parseCsv(text, { maxRows, maxCols })` → `{ header, rows, totalRows, truncatedRows, truncatedCols }`；纯函数 |
| `src/lib/csv.test.ts` | 引号内逗号 / 引号转义 / 引号内换行 / CRLF / 不规则行 / 空输入 / 超限截断 |
| `src/pages/files/PreviewPane.tsx` | 按 `file.preview.kind` 分派；统一三态 `loading / ready / failed`；失败时回落 metadata sheet（不空屏） |
| `src/pages/files/CsvPreview.tsx` | fetch → parse → 表格：sticky 表头、等宽数字右对齐、横向滚动、`showing x of y` |
| `src/pages/files/MarkdownPreview.tsx` | fetch → `MarkdownBody`，阅读宽 68ch |
| `src/pages/files/PdfPreview.tsx` | iframe + 新标签 + `pdfViewerEnabled` 降级 |
| `src/pages/files/preview.module.css` | 三种预览的版式（不动 `files.module.css` 里已断言的行高/列宽） |
| `public/samples/*` | `eval-log.csv`（含一行带逗号+引号的字段）、`notes-on-baseline.md`、`protocol-v3.pdf`（真·单页 PDF） |

`.md` 预览的标题层级要与站内一致（h1 20px、h2 15px、正文 13px/1.7），不要另造一套排版。

---

## 5. 状态与失败

| 状态 | 处理 |
| --- | --- |
| 加载中 | 骨架条（3 行），**不写"loading…"字样** |
| 成功 | 渲染 |
| fetch 失败 / 非 2xx | metadata sheet + 一行 `This preview could not be loaded.` + "在新标签打开"（文件本身仍可访问） |
| 文件无 `preview` | 保持现有 sheet，文案不动 |
| PDF 不支持内联 | 下载卡片（不空白） |

失败状态用 `PreviewPane` 局部 state，**不用 `setNotice`**（e2e 明令禁止）。

---

## 6. 安全

1. 三者都是不可信内容：MD 走既有 renderer（不注入 HTML）；CSV 只作为文本节点插入；PDF 只交给浏览器插件。
2. 不使用 `dangerouslySetInnerHTML`；不解析外部链接（MD 里的链接仍走既有白名单：仅 http(s) 与站内路由）。
3. PDF iframe 用同源静态资源；`sandbox` 会禁用 Chrome 内置 PDF 插件，因此**不加 sandbox**，改为固定同源路径 + 不给 `allow` 任何能力。
4. 预览区不暴露路径穿越：`url` 只来自数据常量，不接受 query 参数。

---

## 7. 阶段

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **P0** | 三个样例资源 + `FilePreview` 字段 + `PreviewPane` 分派与失败态 | 三类都能看到"框"，parquet 仍是原 sheet |
| **P1** | `parseCsv` + 单测 + `CsvPreview` | 引号/换行/CRLF 全过；200 行截断有说明 |
| **P2** | `MarkdownPreview`（复用 renderer） | 标题/列表/表格/代码块与聊天里一致 |
| **P3** | `PdfPreview` + 降级 | Chrome 真渲染；`pdfViewerEnabled=false` 走卡片 |
| **P4** | e2e + 截图 + 文档 | 全量绿；三类各一张截图 |

**e2e 计划（P4）**

1. `f-eval-log` → `table` 行数 > 10，`thead` 的 computed `position` 是 `sticky`
2. 样例里那行带 `,` 与 `"` 的字段被还原成一个单元格（不是两列）
3. `f-baseline-md` → 有 `h1` 与列表；正文节点不含 `onclick` 属性
4. `f-protocol` → `iframe[title]` 存在且 `src` 指向 `/samples/protocol-v3.pdf`
5. `f-raw-runs`（parquet）→ 仍是原 metadata sheet，`No file bytes…` 字样还在
6. 预览容器不产生页面级横向滚动（`scrollWidth <= clientWidth`）

---

## 8. 风险

1. **样例被误读成真实数据**：标题下必须标 `sample file`，且不说"已同步"。
2. **PDF 内联依赖浏览器设置**：Chrome/Edge 可以，部分环境会直接下载——降级卡片必须做，否则一开就是白框。
3. **e2e 的行高/列宽断言**：文件表格不动，预览另开容器与 CSS 文件。
4. **CSV 方言**：只保证 RFC4180 常见子集；分隔符固定逗号，不做自动嗅探（写进文档）。
5. **大文件**：不做流式解析；`size` 字段本来就是虚构的，预览明说只显示前 200 行。

---

## 9. 待确认

1. **D1**：按 A（内置样例 + 明确标注）走，还是先做上传？
2. **D2**：PDF 用原生 viewer（建议），还是直接上 pdfjs？
3. 三个样例文件的内容要不要贴真实研究语境（评测日志、基线笔记、协议 PDF），还是用占位文本？

---

## 10. 实施记录（2026-11-15）

决策全部按建议执行：**D1 = A（内置样例）**、**D2 = 原生 viewer**、**D3 = 200×40**、**D4 = 复用 renderer**。

### 数据与资源

| 项 | 落地 |
| --- | --- |
| 样例文件 | `public/samples/`：`eval-log.csv`、`tokens-per-run.csv`、`field-map.csv`、`notes-on-baseline.md`、`onda-protocol.md`、`protocol-v3.pdf`、`wu-2025.pdf` |
| PDF 来源 | `scripts/make-sample-pdfs.mjs` 手写 PDF 1.4（catalog / pages / page / 两个 Type1 字体 / 一个内容流），逐对象计算 xref 偏移；**无依赖** |
| 数据 | `FilePreview` 联合类型 + `FileItem.preview?`；7 个种子加 preview，`parquet / json / png / txt` 保持无预览 |
| 标注 | 预览上方一条 `sample file` + `Open raw file`，不说"已同步" |

### 渲染

| 类型 | 做法 |
| --- | --- |
| CSV | `src/lib/csv.ts`：RFC4180 子集（引号、双写引号、引号内换行、CRLF）；`parseCsv` 返回 `header/rows/totalRows/truncated*`；表格 sticky 表头、数字列右对齐等宽、脚注 `N rows / showing x of y` |
| MD | 复用 `parseMarkdown` + `MarkdownBody`（无 HTML、无 `dangerouslySetInnerHTML`） |
| PDF | `<iframe>` 交浏览器插件，`#toolbar=0&navpanes=0&view=FitH`；`navigator.pdfViewerEnabled === false` 时降级为打开卡片 |

### 顺带修的一个老问题

`parseMarkdown` 把段落里的单换行渲染成 `<br>`，导致**手工换行的 markdown 文件被切成 60 字一行**。按 CommonMark 改为软换行（单换行 = 空格，行尾两空格或反斜杠才是硬断行）。聊天里同样受益。

### 验证

- tsc 干净 · vitest **542/542**（新增 `csv.test.ts` 14 条）· build ✓ · e2e **350/350**（新增 4 条：CSV 表格/sticky/引号字段、MD 渲染非源码、PDF iframe、无预览类型保持原 sheet）
- 截图：`design/reference/files/preview-{csv,md,pdf,none}.png`

### 已知边界

- 只渲染前 200 行 × 40 列，脚注写明；不做方言嗅探（分隔符固定逗号）；不做虚拟滚动。
- 预览是样例内容，不是用户上传；上传另起一轮（当前 Upload 仍明确禁用）。
- PDF 内联依赖浏览器：Chrome/Edge 可以，部分环境会下载 —— 降级卡片兜住。
