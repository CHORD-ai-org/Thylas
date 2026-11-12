# ChatGPT UI — Simplified Design Guide (Light & Dark)

> 来源：github.com/ferrants/openai-style-guide-markdown（社区整理，2025-11）。
> 配色仅作结构参考——**Thylas 不采用其 teal accent 与灰阶，配色仍用自家 token**。

## 1. Overall Look

- **Style:** clean, minimal, calm.
- **Shape:** rounded corners (8–16px).
- **Grid:** 8px spacing system.
- **Layout:** Left sidebar (nav) · Main content (chat or page) · Optional right sidebar (citations/tools)

## 2. Color Basics（结构参考）

Accent：`#10A37F`（teal-green）——**Thylas 不用**。

| Role | Dark | Light |
| --- | --- | --- |
| Background | `#131316` | `#FFFFFF` |
| Surface / Panels | `#1E1E21` | `#F7F7F8` |
| Elevated surface | `#2A2A2E` | `#EDEDED` |
| Divider | `#2F2F33` | `#DADADA` |
| Text main | `#E8E8EB` | `#1C1C1C` |
| Text secondary | `#A3A3A8` | `#555555` |
| Link | `#5E8BE0` | `#2A7FE8` |

## 3. Typography

- **Font:** `Inter, system-ui, sans-serif` · Mono: `IBM Plex Mono, Menlo`
- **Sizes:** Body 15–16px · Small UI 13–14px · Headings 18–24px
- **Weights:** 400–600 · **Style:** No shadows, no caps, clear hierarchy.

## 4. Spacing & Layout

8px steps：`4 / 8 / 16 / 24 / 32`。Button padding `8px 16px`；Card `16–24px`；Modal `24px`。Margins generous.

## 5. Components

### Buttons
- Rounded 8px · Primary: accent bg + white text · Secondary: neutral · Hover: slightly brighter · Click: scale 0.97

### Inputs
- Rounded 8px · subtle gray bg · accent focus ring · smooth focus transition

### Cards / Panels
- Rounded 12px · subtle shadow · **No borders, just contrast**

## 6. Chat Area（关键规则）

- **No bubbles — 用 padding 和底色区分消息。**
- User messages = slightly lighter tone；AI messages = neutral background。
- Code blocks：rounded、scrollable、monospace。
- 操作图标（copy 等）hover 出现。

## 7. Motion

150–200ms ease-in-out。Hover 提亮；Modal fade+scale；Sidebar slide。

## 8. Light/Dark tips

| Element | Light | Dark |
| --- | --- | --- |
| Background | White | Near-black |
| Shadows | Very light | More visible |
| Text | Black | Light gray-white |
| Accent | 同一 accent | 同一 accent |

## Checklist

Inter 字体 · accent 只用于强调 · 8px 网格 · 圆角 8–16px · 轻阴影少边框 · 安静对比 · 短动效。
