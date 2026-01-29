# D03: MVP Scope Definition

## Decision

MVP version focuses on core functionality, with the following scope limits:

### Supported Agents

- ✅ Claude Code
- ⏸️ Cursor (expand later)
- ⏸️ Other Agents (expand later)

### Feature Scope

| Feature                                     | MVP | Later |
| ------------------------------------------- | --- | ----- |
| Committed code - git blame display          | ✅  | -     |
| Uncommitted code - AI/Human detection       | ✅  | -     |
| Hover info display                          | ✅  | -     |
| Hover interactive (click to navigate, etc.) | ❌  | ✅    |
| Committed code - AI session association     | ❌  | ✅    |

### Simplified Decisions

1. **Committed code does not associate AI session**: Directly use git blame info, no tracing whether AI generated
2. **No interactive features**: MVP only displays info, no click navigation to commit/session details

## Rationale

- Validate core value first (AI contribution detection)
- Reduce implementation complexity
- Rapid iteration, collect feedback

## Status

✅ Confirmed
