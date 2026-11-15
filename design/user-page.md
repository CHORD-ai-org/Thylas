# User 页面 — Discord 式档案页

**Date:** 2026-11-15 · 范围：`/user` 页的视觉与结构 · 不改数据、不改路由语义

## 1. 参照

Discord 的 user settings 有两件事值得抄，与配色无关：

1. **一个带边界的设置面**：左分组导航 + 右内容区，两侧底色不同，整体是一张"面板"，不是一个漂浮的菜单。
2. **档案头**：banner 色带 → 头像压在色带下沿 → 名字 + 一行身份信息。

Thylas 现有 4 个 section（Identity / Preferences / My environment / Security）内容量都小，正是这套结构最划算的规模。

## 2. 结构

```
┌─ 档案卡 ─────────────────────────────┐
│ ███ banner 88px（中性色带）           │
│  (C)  Ceaser Zhao       [Initialize] │  ← 头像 76px，margin-top −38px
│       Member · Onda Lab · since 2026  │
└──────────────────────────────────────┘
┌─ 设置面 sheet ───────────────────────┐
│ Account        │ Identity            │
│  Identity      │  …rows…             │
│  Security      │                     │
│ App            │                     │
│  Preferences   │                     │
│  Environment   │                     │
└──────────────────────────────────────┘
```

| 项 | 值 |
| --- | --- |
| banner | 高 88px；`color-mix(in srgb, var(--ink) 7%, var(--bg-app))`，纯平，无渐变无图 |
| 头像 | 76px 圆，`border: 3px solid var(--bg-surface)`，`margin-top: -38px`（半个压在色带上） |
| 名字 | h1 = 显示名，500 20px/26，字距 −0.01em（原 "User" 标题删除） |
| 身份行 | `role · member since`，一行 caption |
| 唯一主操作 | `Initialize profile from public sources`，右边框按钮（不用实心主色，保持无彩色） |
| sheet | 单一边界 + 12px 圆角 + `overflow: hidden`；`208px | 1fr` |
| 导航列 | 底色 `color-mix(ink 3%, bg-app)` + 右 hairline；分组标签（Account / App）句式大小写 |
| 导航项 | 32px 高、8px 圆角；active = `--bg-surface` 填充（窄屏改 `--tint-sel`） |
| 内容区 | padding 22/26/30；行高 ≥ 56px，行间 hairline |

## 3. 删除的重复

原 Identity section 里有一整块"头像 + 名字 + 角色"卡片，与页头完全重复。现在只留一行：

```
Avatar        Avatars would live with the identity provider.        [Change avatar]
```

名字仍可在下方 `Edit display name` 修改，改完页头、rail、服务端一致（e2e 已锁）。

## 4. 响应式

`≤860px`：sheet 变单列，导航列转成横向一行（分组标签保留，active 用 `--tint-sel`），内容区 padding 收窄，档案头右侧操作换行。

## 5. 验证

- tsc 干净 · vitest 507/507 · build ✓ · e2e **333/333**（新增 2 条：档案头结构、sheet 分组与两列；原 h1 断言改为"页头 h1 = rail 显示名"）
- 截图：`design/reference/user-page/user-{warm,dark,light}.png`、`user-preferences.png`、`user-860.png`

## 6. 未做

- Profile 记录（六类已确认条目）仍未在页面上展示——它们仍在 `/user/profile` 向导的完成页里。要做"档案 = 页面主体"需要另起一轮（数据现成：`GET /api/profile/state`）。
- Discord 的"Log Out 在导航底部"没搬：Security 里已有 Sign out 行，再加一处就是重复。
