# D04: Hover Content Definition

## Decision

Hover displays different information based on scenario:

### Scenario 1: Committed Code

```
┌─────────────────────────────────────────┐
│ Author Name, 3 days ago                 │
│ Commit message here...                  │
│ abc1234                                 │
└─────────────────────────────────────────┘
```

Fields:

- Author name
- Relative time
- Commit message
- Commit hash (short format)

### Scenario 2: Uncommitted Code - AI Generated

```
┌─────────────────────────────────────────┐
│ 🤖 Claude Code                          │
│ Session: abc123-def456                  │
│ Prompt: "Implement a sorting function"  │
└─────────────────────────────────────────┘
```

Fields:

- Agent name (e.g., Claude Code)
- Session ID
- User prompt (user's original request)

### Scenario 3: Uncommitted Code - Human Written

```
┌─────────────────────────────────────────┐
│ 👤 Human Edit                           │
│ Not committed yet                       │
└─────────────────────────────────────────┘
```

Fields:

- Marked as human edit

## Technical Implementation

- Use VSCode `MarkdownString`
- Support emoji icons to distinguish AI/Human
- MVP does not support interaction (e.g., click to navigate)

## Status

✅ Confirmed
