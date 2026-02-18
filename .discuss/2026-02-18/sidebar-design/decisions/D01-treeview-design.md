# D01: Sidebar TreeView Design

**Status**: ✅ Confirmed  
**Decision Date**: 2026-02-18

## Decision

The sidebar will be implemented using VSCode native TreeView, containing two panels:

### 1. Connected Agents
- Display all supported agents (Claude Code, Cursor, Windsurf)
- Each agent shows: connection status, last activity time
- Support quick connect/disconnect actions

### 2. Recent Activity
- Based on `CodeChangeRecord` + `PromptRecord` data
- Each record displays:
  - Agent name + icon
  - File path (clickable to navigate)
  - Timestamp
  - Associated user prompt (truncated, expand on hover)

## Data Sources

| Data Type | Purpose |
|-----------|---------|
| `CodeChangeRecord` | File edit records |
| `HookSessionData` | Session information |
| `PromptRecord` | User intent |

## Technical Choice Rationale

Choosing TreeView over WebView:
- ✅ Native, lightweight, consistent with VSCode style
- ✅ Sufficient for list-based data display
- ✅ Faster development, lower maintenance cost

## Future Extensions

If complex visualizations are needed (e.g., contribution ratio charts), a separate WebView panel can be added.
