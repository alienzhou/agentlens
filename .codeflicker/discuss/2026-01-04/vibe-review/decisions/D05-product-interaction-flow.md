# D05: Product Interaction Flow

**Decision Time**: R10  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

## Background

This decision documents the complete VS Code plugin interaction flow, including Agent detection, connection mechanism, data collection, and Blame view display.

---

## Product Form

**VS Code Plugin** - A plugin that integrates with various AI IDEs/Agents to collect AI-generated code information and display it in a GitLens-like Blame view.

---

## Complete Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. VS Code Plugin Startup                                              │
│     ↓                                                                   │
│  2. Auto-detect Local AI IDE Products (Hybrid Detection)                │
│     ┌───────────────────────────────────────────────────────────────┐   │
│     │  • Directory detection: ~/.cursor/, ~/.claude/, ~/.gemini/... │   │
│     │  • which command: which cursor, which claude...               │   │
│     └───────────────────────────────────────────────────────────────┘   │
│     ↓                                                                   │
│  3. Display Agent List                                                  │
│     ┌───────────────────────────────────────────────────────────────┐   │
│     │  ● Cursor        [Connected ✓]  [Disconnect]                  │   │
│     │  ● Claude Code   [Detected] [Connect]                         │   │
│     │  ● Gemini CLI    [Not Detected] [Connect] ← Still connectable │   │
│     │  ● OpenCode      [Not Detected] [Connect]                     │   │
│     └───────────────────────────────────────────────────────────────┘   │
│     ↓                                                                   │
│  4. User Clicks "Connect"                                               │
│     ┌───────────────────────────────────────────────────────────────┐   │
│     │  1. Directory doesn't exist → Create directory                │   │
│     │  2. Write Hook config to platform config file                 │   │
│     │  3. Copy Hook scripts to user directory                       │   │
│     │  4. Start Session file monitoring (if needed)                 │   │
│     └───────────────────────────────────────────────────────────────┘   │
│     ↓                                                                   │
│  5. Agent Executes Tasks - Dual-Track Data Collection                   │
│     ┌───────────────────────────────────────────────────────────────┐   │
│     │  Track 1: Hook Capture (File edits + TODOs)                   │   │
│     │  Track 2: Session File Monitoring (Operation history)        │   │
│     └───────────────────────────────────────────────────────────────┘   │
│     ↓                                                                   │
│  6. Store Locally (.vibe-review/data/)                                  │
│     ↓                                                                   │
│  7. Blame View Display                                                  │
│     ┌───────────────────────────────────────────────────────────────┐   │
│     │  Matching: Hunk-level Levenshtein (90% pure AI / 70% modified)│   │
│     │                                                               │   │
│     │  Display Content:                                             │   │
│     │  ┌─────────────────────────────────────────────────────────┐  │   │
│     │  │ 🤖 AI Generated (Claude Code)                           │  │   │
│     │  │ Session: abc123 | Round: 3                              │  │   │
│     │  │ TODOs: "Implement user login", "Add form validation"    │  │   │
│     │  └─────────────────────────────────────────────────────────┘  │   │
│     │                                                               │   │
│     │  ┌─────────────────────────────────────────────────────────┐  │   │
│     │  │ 👤 Human Contribution                                   │  │   │
│     │  │ Author: zhouhongxuan | 2026-01-27 02:30                 │  │   │
│     │  └─────────────────────────────────────────────────────────┘  │   │
│     └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Summary

| Decision Item | Choice | Notes |
|---------------|--------|-------|
| **Detection Strategy** | Hybrid Detection | Directory detection + `which` command |
| **Connection Status** | Check Hook Config | Check if our Hook config exists in platform config file |
| **Undetected Handling** | Create & Connect | Create directory if not exists, then write config |
| **Supported Agents** | Fixed List | Cursor / Cursor CLI / Claude Code / OpenCode / Gemini CLI |
| **Data Collection** | Dual-Track | Hook capture + Session file monitoring |
| **Matching Algorithm** | Levenshtein | Hunk-level, 90%/70% thresholds |
| **Blame Display** | Rich Content | Contributor type + Source Agent + Session info + TODOs |
| **Terminology** | "Connect" | Use "Connect" instead of "Install" for better semantics |

---

## Platform Configuration Details

### Detection Paths

| Platform | Config Directory | Config File |
|----------|------------------|-------------|
| Cursor | `~/.cursor/` | `~/.cursor/hooks.json` |
| Claude Code | `~/.claude/` | `~/.claude/settings.json` |
| Gemini CLI | `~/.gemini/` | TBD |
| OpenCode | TBD | TBD |

### Hook Events

| Platform | File Edit Hook | Stop Hook |
|----------|----------------|-----------|
| Cursor | `afterFileEdit` | `stop` |
| Claude Code | `PostToolUse` (matcher: `Edit\|Write\|MultiEdit`) | `Stop` |

---

## Blame Display Content

When code is identified as AI-generated:

1. **Contributor Type**: AI Generated / AI Generated (Human Modified) / Human Contribution
2. **Source Agent**: Which AI IDE generated this code (Cursor / Claude Code / etc.)
3. **Session Info**: Session ID and conversation round
4. **TODOs**: Related TODO items from the Agent's task breakdown

---

## Pending Items

- [ ] Session file paths and formats for each AI IDE (needs research)

---

## Related

- [D01-agent-review-protocol.md](./D01-agent-review-protocol.md) - Protocol design
- [D02-data-acquisition-strategy.md](./D02-data-acquisition-strategy.md) - Data collection strategy
- [D08 Contributor Detection](../../2026-01-26/contributor-detection/decisions/D01-contributor-detection.md) - Matching mechanism details
