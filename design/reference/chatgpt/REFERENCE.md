# ChatGPT UI 参考 — 收集记录

**Date:** 2026-11-12 · 用途：UI 重构的视觉参考（只抄形，不抄色——见 STYLE-GUIDE.md 顶部声明）。

## 已收集

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `gpt-real-01-conversation.png` | **真实对话页**（用户账号）：侧栏 + markdown 消息流 + 居中胶囊 composer | 用户提供截图 |
| `gpt-real-02-plugins.png` | **真实插件目录页**——GPT 版"目录/列表页"的官方实现，Connect/Artifacts 的直接对照物 | 用户提供截图 |
| `gpt-real-03-library.jpg` | **真实资料库页**——GPT 版"资产网格页"的官方实现，Artifact Library 的直接对照物 | 用户提供截图 |
| `bgr-composer-1..8.png` | BGR 评测的 composer/Tools 菜单特写（2025-05 改版） | BGR 文章页截取 |
| `STYLE-GUIDE.md` | 设计规格：颜色结构、Inter、8px 网格、组件规则、无气泡规则、动效 | 社区整理 |
| `gpt-reference-shots.mjs` | CDP 截图脚本（可复用） | — |

## 规格观察（来自三张真实截图）

### 1. 对话页（gpt-real-01）

- **侧栏 ≈230px**：顶部 logo + 搜索/折叠 icon；导航项 = icon + label，active 项深色高亮块（无左描边）；中部「项目」分组（标题 + 子项带计数）；底部账号块（头像+名+副标）+ 全宽长条 CTA。
- **主列**：极简头——左会话名 ▾，右两个 icon；内容单列居中 ≈680px。
- **Markdown 层级**：加粗行内强调；inline code = 深底圆角 mono chip；**规格表无双竖线**——只有横 hairline 行分隔（code chip | 说明文字）；并列概念用两列边框圆角卡（Subjects / Research Records）。
- **Composer**：底部居中胶囊；左 + 圆钮；placeholder「询问 ChatGPT」；右侧 思考 / 麦克风 / 蓝色圆形发送钮。
- **节奏**：大量留白；滚动到底出现小圆下箭头。

### 2. 插件目录页（gpt-real-02）—— Connect / 目录类页面的对照物

- 顶部左：**chips 切换**（插件 · 技能），active = 深底胶囊；右：设置 icon + 「添加 ▾」主按钮。
- 大标题「插件」+ 一行灰描述。
- 搜索条：主列全宽胶囊，icon 内嵌左。
- 区块模式：**小标题 + ›**（已安装 › / 热门 › / 新品推荐 ›），无卡片边框，仅留白分组。
- 已安装 = 一行圆角方 icon。
- 「公开」pill chip。
- 热门列表 = **两列行**：圆角方 icon（~40px）+ 粗名称 + 灰描述 + 右侧 + / … / 授权 icon。
- 全页零边框线——层级靠字号、底色差、留白。

### 3. 资料库网格页（gpt-real-03）—— Artifact Library 的对照物

- 头行：大标题「资料库」；右 icon 组 = 筛选 / 网格/列表视图切换 / 搜索胶囊 / 「新建 ▾」主按钮 / 排序。
- chips 行：推荐(active) / 收藏 / 文件夹 / 图像 / 全部。
- **Masonry 卡片网格**（≈4 列，圆角 ≈12px）：
  - 图片卡 = 封面直接铺满；
  - PDF 卡 = 浅底 + 居中大 PDF icon + 顶部小名称条；
  - 文本卡 = 深底 + 居中蓝色类型 icon + 顶部小名称条；
  - **卡片形态由内容类型自渲染**，无元数据徽章堆砌。
- 视图切换（网格/列表）在头行，随时换密度。

## 映射（修订版）

| ChatGPT 模式 | Thylas 对应 | 动作 |
| --- | --- | --- |
| 侧栏密度/分组/active 态 | Rail | 重排样式，结构保留 |
| 对话主列 + 胶囊 composer + 无气泡 | Chat / Coworker 会话 | ChatCore 重排 |
| 插件目录页 | **Connect 页** | 布局直接对标 |
| 资料库网格页 | **Artifact Library** | 保留列表为主，可加网格视图切换 |
| 空态大问句 | 全部空态 | 改写 |
| 无对照物页面（Compute / Coworker config / User） | — | 自研布局，复用上述组件词汇（胶囊搜索、区块+›、两列行、无框层级） |
| **Overview（用户指定：无对标，仿风格自研）** | Overview | 保留全部文案与结构（intent 输入 / Recently / Compute / Processes），视觉仿 GPT：居中大问句式 intent 输入（GPT 首页模式）、无框分组、chip 化 |
