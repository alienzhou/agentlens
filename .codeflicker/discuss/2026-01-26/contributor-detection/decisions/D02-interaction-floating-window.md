# D02: Interaction Design - Floating Window Solution

> Status: Confirmed | Round: R1 | Date: 2026-01-26

## Core Idea

Different Agent products have different jump methods, MVP phase won't implement direct jump, use floating window to display command hints.

## Floating Window Design

```
Click on AI-generated code line → Pop up floating window
┌─────────────────────────────────────┐
│ 📍 Source: Cursor Session #abc123   │
│ 📝 Conversation: Round #3           │
│ 🎯 TODO: Implement login verification│
│                                     │
│ 💡 Jump Commands:                   │
│ Cursor: Ctrl+K → @history abc...    │
│ Claude: /goto conversation abc...   │
└─────────────────────────────────────┘
```

## Decision Summary

| Decision Item | Choice | Notes |
|---------------|--------|-------|
| MVP Jump | **Do Not Implement Direct Jump** | Different product jump methods not unified |
| Interaction Method | **Floating Window Display Info + Command Hints** | Provide users with enough info to jump manually |
| Command Template System | **Implement After MVP** | Currently focus on core features |

## Rationale

1. **Product Diversity**: Cursor, Claude Code, Windsurf 等不同 Agent 产品的跳转方式各不相同
2. **MVP Focus**: 在 MVP 阶段应聚焦核心功能（采集 + 展示），交互优化后置
3. **User Empowerment**: 通过提供足够的上下文信息，让用户自行决定如何追溯

---

*Related: [outline.md](../outline.md) | [D01-contributor-detection.md](D01-contributor-detection.md)*
