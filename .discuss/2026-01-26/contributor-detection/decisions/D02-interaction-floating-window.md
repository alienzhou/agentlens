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

1. **Product Diversity**: Different Agent products like Cursor, Claude Code, Windsurf have different jump methods
2. **MVP Focus**: MVP phase should focus on core features (collection + display), interaction optimization deferred
3. **User Empowerment**: Provide sufficient context information for users to decide how to trace back

---

*Related: [outline.md](../outline.md) | [D01-contributor-detection.md](D01-contributor-detection.md)*
