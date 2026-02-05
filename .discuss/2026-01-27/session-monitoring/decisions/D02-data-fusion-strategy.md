# Data Fusion Strategy: On-demand, Hook Priority

**Decision Time**: #R3  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement
agent-blame has two data sources:
- **Hook Data**: Real-time, structured, captured via Agent hooks (file edits, TODOs, session events)
- **Session Data**: Complete context, parsed from Agent session files (conversations, tool calls)

Need to determine how to combine these two data sources.

### Constraints
- Hook data is real-time but limited in context
- Session data is rich but may lag behind or require parsing
- Display layer needs unified data structure

---

## 🎯 Objective

Define a fusion strategy that:
1. Provides rich context for code review
2. Maintains good performance
3. Has clear conflict resolution rules

---

## ✅ Final Decision

### 1. Fusion Timing: On-demand (Lazy)

```
User requests display
        │
        ▼
┌───────────────────┐
│  Load Hook Data   │ ← Primary data source
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Lookup Session by │ ← sessionId as key
│    sessionId      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Enrich with      │ ← Supplement missing fields
│  Session Data     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Return Unified   │
│      Data         │
└───────────────────┘
```

**Rationale**: 
- Avoids upfront performance cost
- Session file may not exist yet when Hook fires
- Flexible - can adjust enrichment logic later

### 2. Session Data Supplements

To be determined iteratively. Initial candidates:
- `userPrompt` ← from `conversations[qaIndex].userMessage`
- `agentResponse` ← from `conversations[qaIndex].agentResponse`
- `toolCalls` ← correlate with file changes by `filePath`
- Full conversation history for "trace back" feature

**Approach**: Build first version, see what's meaningful, iterate.

### 3. Conflict Resolution: Hook Priority

| Field | Hook Data | Session Data | Resolution |
|-------|-----------|--------------|------------|
| timestamp | ✓ | ✓ | **Hook wins** |
| sessionId | ✓ | ✓ | Should match |
| filePath | ✓ | ✓ | **Hook wins** |
| userPrompt | Maybe | ✓ | Session supplements |
| agentResponse | Maybe | ✓ | Session supplements |

**Rule**: When both sources have the same field, Hook data takes precedence. Session data is used to supplement missing fields.

---

## 📊 Solution Comparison

| Solution | Description | Advantages | Disadvantages | Decision |
|----------|-------------|------------|---------------|----------|
| A. Real-time fusion | Fuse immediately when Hook fires | Always up-to-date | Performance overhead, Session may not exist | ❌ |
| B. On-demand fusion | Fuse when displaying | Lazy evaluation, flexible | May need multiple reads | ✅ |
| C. Periodic sync | Background sync job | Balanced | Complex, overkill for MVP | ❌ |

---

## ❌ Rejected Solutions

### Solution A. Real-time fusion
- **Rejection Reason**: Session file may not be written when Hook fires; performance overhead
- **Reconsideration**: If latency becomes an issue, could pre-fetch session data

### Solution C. Periodic sync
- **Rejection Reason**: Adds complexity, not needed for MVP
- **Reconsideration**: May be useful for large-scale deployments with analytics needs

---

## 🔗 Related Links

- [D01 - Adapter Architecture](./D01-adapter-architecture.md)
