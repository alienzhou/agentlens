# ADR-009: Prompt Timestamp Matching for Code Changes

**Status**: ✅ Decided (2026-02-04)  
**Related**: [ADR Index](./index.md), [ADR-002: Data Acquisition](./ADR-002-data-acquisition.md)

---

## Context

When displaying AI-generated code in the Blame view, we need to show the user's original prompt (task description) that triggered the code change. This provides important context for code reviewers.

### Problem Identified

In the initial implementation, `userPrompt` was stored at the **session level** in `sessions.json`. This approach has a critical flaw:

- **Session** = One continuous conversation (e.g., Claude Code session)
- **Prompt** = Each individual user request within a session

When a user sends multiple prompts in the same session, each new prompt overwrites the previous one. This causes all code changes in that session to display only the **last** prompt, regardless of which prompt actually triggered them.

**Example**:
```
Session: abc123
├─ Prompt 1: "Add login form" (10:00:00)
│  └─ Edit: LoginForm.tsx (10:01:00)
├─ Prompt 2: "Add error handling" (10:05:00)
│  └─ Edit: ErrorHandler.tsx (10:06:00)
└─ Prompt 3: "Fix styles" (10:10:00)
   └─ Edit: styles.css (10:11:00)

With session-level storage:
- All 3 edits would show: "Fix styles" (WRONG!)

With timestamp matching:
- LoginForm.tsx shows: "Add login form" ✓
- ErrorHandler.tsx shows: "Add error handling" ✓
- styles.css shows: "Fix styles" ✓
```

---

## Decision Content

### Data Model Change

1. **New File**: `prompts.jsonl` stores individual prompt records with timestamps

```typescript
interface PromptRecord {
  sessionId: string;    // Links to session
  prompt: string;       // User's prompt text
  timestamp: number;    // When prompt was submitted
}
```

2. **Storage Format**: JSONL (one JSON object per line) for append-only writes

```jsonl
{"sessionId":"abc123","prompt":"Add login form","timestamp":1770203000000}
{"sessionId":"abc123","prompt":"Add error handling","timestamp":1770204000000}
{"sessionId":"abc123","prompt":"Fix styles","timestamp":1770205000000}
```

### Hook Handler Change

`UserPromptSubmit` hook now appends to `prompts.jsonl` instead of updating `sessions.json`:

```typescript
// Before (session-level, overwrites)
await storage.updateHookSession(sessionId, { userPrompt: prompt });

// After (timestamp-based, appends)
await storage.appendPrompt({ sessionId, prompt, timestamp: Date.now() });
```

### Prompt Matching Algorithm

When loading prompt for a code change:

```typescript
async getLatestPromptBefore(sessionId: string, changeTimestamp: number): Promise<string | undefined> {
  // Find all prompts for this session
  // Return the one with the largest timestamp <= changeTimestamp
}
```

**Logic**: A code change is triggered by the **most recent prompt before** that change occurred.

---

## Alternatives Considered

### 1. Session-Level Storage (Original Approach)

- **Pros**: Simple, low storage overhead
- **Cons**: Inaccurate when multiple prompts in one session
- **Rejected**: Accuracy is more important than simplicity

### 2. Tool-Use Level Association

Store prompt reference directly in each code change record in `changes.jsonl`.

- **Pros**: Direct association, no lookup needed
- **Cons**: Requires modifying `PostToolUse` hook to include current prompt
- **Rejected**: Claude Code's `PostToolUse` doesn't include the triggering prompt

### 3. Conversation ID (QA Index)

Use Claude Code's conversation round number if available.

- **Pros**: Native association
- **Cons**: Not all agents provide conversation ID; inconsistent across platforms
- **Rejected**: Cross-platform compatibility needed

---

## Decision Rationale

1. **Accuracy**: Timestamp matching provides the most accurate prompt-to-change association
2. **Simplicity**: Append-only `prompts.jsonl` is simple to implement and debug
3. **Performance**: Binary search on timestamps is O(log n), acceptable for typical session sizes
4. **Backward Compatibility**: Falls back to `sessions.json` for old data

---

## Impact

### Positive Impact

- Accurate prompt display for each code change
- Better code review experience with proper context
- Maintains full prompt history for debugging

### Negative Impact

- Slightly increased storage (one line per prompt)
- Minor lookup overhead during Blame display

### Migration

- **No breaking changes**: Old `sessions.json` data is still read as fallback
- **New data**: Uses `prompts.jsonl` automatically

---

## Implementation Details

### Files Changed

| File | Change |
|------|--------|
| `packages/core/src/storage/file-storage.ts` | Add `PromptRecord` type, `appendPrompt()`, `getLatestPromptBefore()` |
| `packages/cli/src/commands/hook.ts` | Modify `handleUserPromptSubmit()` to use `appendPrompt()` |
| `packages/vscode/src/blame/contributor-service.ts` | Modify `loadUserPromptForChange()` to use timestamp matching |

### Storage Structure Update

```
.agent-blame/
└── data/
    └── hooks/
        ├── sessions.json      # Session metadata (unchanged)
        ├── changes.jsonl      # Code change records (unchanged)
        └── prompts.jsonl      # NEW: Prompt records with timestamps
```

---

## Related Decisions

- [ADR-002: Data Acquisition Strategy](./ADR-002-data-acquisition.md): This decision extends the Hook track
- [ADR-006: Contributor Detection](./ADR-006-contributor-detection.md): Prompt data enhances Blame display
