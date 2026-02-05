# Discussion: Session Monitoring - Multi-Agent Session Monitoring Feature Design

> Status: Completed | Round: R3 | Date: 2026-01-27

## ✅ Confirmed Decisions

| ID | Decision | Document |
|----|----------|----------|
| D01 | Adapter Layered Design: Separate data layer, unified presentation layer | [→ D01](./decisions/D01-adapter-architecture.md) |
| D02 | Data Fusion Strategy: On-demand fusion, Hook priority | [→ D02](./decisions/D02-data-fusion-strategy.md) |

## ⏸️ Deferred

- [ ] Cursor Session detailed data structure research (SQLite schema)

## 📝 Implementation Notes

- Agent priority: Claude Code, Cursor first
- Monitoring strategy: Decide during implementation (chokidar + debounce recommended for file-based)
- Session Adapter implementation: Refer to fast-resume for Claude Code parsing logic

## 📊 Research Summary

### fast-resume Core Design

| Component | Description |
|------|------|
| **Adapter Interface** | `AgentAdapter` Protocol + `BaseSessionAdapter` abstract class |
| **Session Structure** | id, agent, title, directory, timestamp, content, message_count, mtime |
| **Incremental Updates** | Based on mtime comparison, only parse changed files |
| **Supported Agents** | Claude, Codex, Copilot CLI, Copilot VSCode, Crush, OpenCode, Vibe |

### Key Finding: Storage Format Differences

| Agent | Storage Location | Format | Monitoring Difficulty |
|-------|----------|------|----------|
| **Claude Code** | `~/.claude/projects/**/*.jsonl` | JSONL text | ⭐ Simple |
| **Cursor** | `~/Library/.../Cursor/.../state.vscdb` | SQLite | ⚠️ Needs research |
| **Copilot VSCode** | `workspaceStorage/*/chatSessions/*.json` | JSON | ⭐ Simple |

### fast-resume Currently Does Not Support Cursor

- **Cursor is not included** among fast-resume's 7 Adapters
- Cursor uses SQLite database storage, which differs significantly from other Agents
- Need to implement CursorSessionAdapter ourselves

## 🔬 Analysis

### Value of Session Data for agent-blame

| Existing Data (Hook) | Session Can Supplement |
|----------------|----------------|
| File paths, changed line numbers | Complete conversation context |
| Change timestamps | User's original prompt |
| TODO list | AI thinking process |
| - | Tool call sequence |
| - | Conversation round associations |

### Adapter Design Direction

```
SessionAdapters/
├── ClaudeCodeSessionAdapter
│   ├── Monitoring: chokidar file watching
│   ├── Parsing: JSONL line by line
│   └── Reference: fast-resume/claude.py
│
└── CursorSessionAdapter
    ├── Monitoring: SQLite file changes / polling
    ├── Parsing: SQL queries
    └── Reference: cursor-session-manager
```

## 📁 Archive

| Topic | Conclusion | Details |
|-------|------------|---------|
| fast-resume analysis | Valuable reference for Adapter design | [→ notes](./notes/fast-resume-analysis.md) |
