# ADR-007: MVP Interaction Strategy

**Status**: ✅ Decided (2026-01-26)  
**Related**: [ADR Index](./index.md)

---

## Context

Different Agent products (Cursor, Claude Code, Windsurf, etc.) have different jump methods, need to determine interaction approach for MVP phase.

---

## Decision Content

MVP phase adopts **floating window display + command hints** approach:

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

| Decision Item | Choice | Notes |
|---------------|--------|-------|
| MVP Jump | **Do Not Implement Direct Jump** | Different product jump methods not unified |
| Interaction Method | **Floating Window Display Info + Command Hints** | Provide users with enough info to jump manually |
| Command Template System | **Implement After MVP** | Currently focus on core features |

---

## Alternatives

1. **Direct Jump Implementation**: Support jump for each Agent product
2. **Only Display Info**: No command hints provided
3. **Plugin System**: Let community implement jump plugins for each Agent

---

## Decision Rationale

1. **Product Diversity**: Different Agent products have very different jump methods
2. **MVP Focus**: MVP phase should focus on core features (collection + display)
3. **User Empowerment**: Provide sufficient context information, let users decide how to trace

---

## Impact

**Positive Impact**:
- Reduce MVP development complexity
- Maintain flexibility for different Agent products
- Users still get enough context information

**Negative Impact**:
- User experience not as seamless as direct jump
- Users need to manually execute jump commands
