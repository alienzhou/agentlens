# Adapter Layered Design: Separate Data Layer, Unified Presentation Layer

**Decision Time**: #R2  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement
agent-blame needs to support Session monitoring for multiple AI Agents (Claude Code, Cursor, and future Codex, Copilot, OpenCode, etc.). Different Agents have vastly different Session storage formats:

| Agent | Storage Format | Location |
|-------|----------|------|
| Claude Code | JSONL text file | `~/.claude/projects/**/*.jsonl` |
| Cursor | SQLite database | `~/Library/.../Cursor/.../state.vscdb` |
| Copilot VSCode | JSON file | `workspaceStorage/*/chatSessions/*.json` |

### Constraints
- Different Agents have significantly different data structures and parsing logic
- Need to support incremental updates (avoid full scans each time)
- Presentation layer should be transparent to users, with no different interactions based on Agent

---

## 🎯 Objective

Design an extensible architecture that can:
1. Easily add support for new Agents
2. Maintain a unified presentation layer experience
3. Allow each Adapter to evolve independently without affecting others

---

## 📊 Solution Comparison

| Solution | Description | Advantages | Disadvantages | Decision |
|------|------|------|------|------|
| A. Fully Separated | Both Adapter and presentation layer separated | Maximum flexibility | Inconsistent presentation, high maintenance cost | ❌ |
| B. Adapters Separated, Presentation Unified | Only data layer differentiated | Unified experience, easy to maintain | May lose Agent-specific information | ✅ |
| C. Fully Unified | Use same logic to handle all Agents | Simple | Cannot handle format differences | ❌ |

---

## ✅ Final Decision

### Chosen Solution
**Solution B: Adapter layer separated, presentation layer unified**

```
┌─────────────────────────────────────────────────┐
│              Presentation Layer (Unified)        │
│  - SessionList / SessionDetail / BlameView      │
│  - Unified Session data structure               │
└─────────────────────────────────────────────────┘
                        ▲
                        │ Unified Interface
┌─────────────────────────────────────────────────┐
│              SessionAdapter Interface            │
│  - watch(): Monitor Session changes             │
│  - parse(): Parse into unified Session structure│
│  - getSessionPath(): Get original Session path  │
└─────────────────────────────────────────────────┘
        ▲               ▲               ▲
        │               │               │
┌───────┴───────┐ ┌─────┴─────┐ ┌───────┴───────┐
│ ClaudeCode    │ │  Cursor   │ │   Copilot     │
│ Adapter       │ │  Adapter  │ │   Adapter     │
│ (JSONL)       │ │ (SQLite)  │ │   (JSON)      │
└───────────────┘ └───────────┘ └───────────────┘
```

### Decision Rationale
1. **Consistent User Experience**: Regardless of which Agent is used, the presentation and interaction methods are the same
2. **Easy to Extend**: Adding a new Agent only requires implementing the Adapter interface
3. **Separation of Concerns**: Each Adapter focuses on its own parsing logic
4. **Reference fast-resume**: That project also uses a similar architecture, which has been proven feasible

### Expected Outcome
- Unified Session data structure for the presentation layer to use
- Each Adapter can be developed and tested independently
- When adding Agent support in the future, existing code is not affected

---

## ❌ Rejected Solutions

### Solution A. Fully Separated
- **Rejection Reason**: Separating the presentation layer would lead to inconsistent user experience and high maintenance costs
- **Reconsideration**: If a certain Agent has very unique data (completely absent in other Agents), special handling can be considered

### Solution C. Fully Unified
- **Rejection Reason**: Cannot handle format differences between different Agents (JSONL vs SQLite vs JSON)
- **Reconsideration**: Not applicable

---

## 🔗 Related Links

- [fast-resume Analysis](../notes/fast-resume-analysis.md)
