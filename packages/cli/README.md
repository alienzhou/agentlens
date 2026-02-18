# @vibe-x/agentlens-cli

> Command-line interface for Agent Lens - Track and identify AI agent contributions in code

![Agent Lens](https://s17-def.ap4r.com/kos/s101/nlav112218/mengshou/agentlens.96a74eebe90f8cc4.png)

## Overview

Agent Lens CLI is a command-line tool that helps you track which code in your repository was written by AI agents (like Cursor, Claude Code) versus humans. It integrates with AI coding assistants via hooks to capture code changes in real-time.

**For a visual experience**, we recommend using the CLI together with the [Agent Lens VS Code Extension](https://marketplace.visualstudio.com/items?itemName=vibe-x-ai.agentlens), which provides GitLens-style inline blame annotations and a sidebar for browsing AI activity.

## Installation

```bash
# Install globally via npm
npm install -g @vibe-x/agentlens-cli

# Or use npx
npx @vibe-x/agentlens-cli --help
```

## Quick Start

```bash
# 1. Initialize Agent Lens in your project
cd your-project
agentlens config --init

# 2. Connect to an AI Agent
agentlens hook connect cursor     # For Cursor
agentlens hook connect claude-code  # For Claude Code

# 3. Use your AI Agent normally - changes are tracked automatically

# 4. View annotated diff with contributor information
agentlens diff --annotated
```

## Commands

### `agentlens config`

Configure Agent Lens settings in your project.

```bash
# Initialize Agent Lens in the current project
agentlens config --init

# Show current configuration
agentlens config --show

# Set a configuration value
agentlens config --set key=value

# Reset configuration to defaults
agentlens config --reset
```

**After initialization**, a `.agentlens/` directory is created with:
- `data/sessions/` - Session data from AI agents
- `data/hooks/` - Hook captured code changes (sharded by date)
- `data/todos.json` - TODO items from agent sessions
- `config/` - Configuration files

### `agentlens hook`

Manage AI Agent hooks for data collection.

```bash
# Connect to an AI Agent
agentlens hook connect <agent>    # cursor, claude-code

# Disconnect from an AI Agent
agentlens hook disconnect <agent>

# Show connection status for all agents
agentlens hook status

# List supported AI Agents
agentlens hook list
```

**Supported Agents:**
| Agent | ID | Config Location |
|-------|------|----------------|
| Cursor | `cursor` | `~/.cursor/hooks.json` |
| Claude Code | `claude-code` | `~/.claude/settings.json` |

**Note for Cursor users:** You need to enable "Third-party skills" in Cursor Settings for hooks to work.

### `agentlens diff`

Show annotated diff with AI/human contributor information.

```bash
# Show working tree changes with contributor info (default)
agentlens diff --annotated

# Show staged changes only
agentlens diff --staged

# Diff against a specific git reference
agentlens diff --ref HEAD~3

# Output formats
agentlens diff --format terminal   # Default, colored terminal output
agentlens diff --format markdown   # Markdown format
agentlens diff --format json       # JSON format

# Write output to file
agentlens diff --format markdown -o report.md

# Disable colored output
agentlens diff --no-color
```

**Options:**
| Option | Description |
|--------|-------------|
| `-a, --annotated` | Show annotated diff with contributor info (default: true) |
| `-f, --format <format>` | Output format: terminal, markdown, json |
| `-r, --ref <ref>` | Git reference to diff against |
| `--staged` | Show staged changes only |
| `-o, --output <file>` | Write output to file |
| `--no-color` | Disable colored output |

### `agentlens review`

Start an interactive code review session.

```bash
# Start review session
agentlens review

# Filter by session ID
agentlens review --session abc123

# Show changes since a specific date
agentlens review --since "2024-01-01"

# Export to markdown
agentlens review --format markdown -o review-report.md
```

**Options:**
| Option | Description |
|--------|-------------|
| `-f, --format <format>` | Output format: terminal, markdown |
| `--session <id>` | Filter by session ID |
| `--since <date>` | Show changes since date |
| `-o, --output <file>` | Write report to file |

### `agentlens todos`

Manage TODO items from Agent sessions.

```bash
# List all TODOs
agentlens todos

# Filter by status
agentlens todos --status pending
agentlens todos --status in_progress
agentlens todos --status completed

# Filter by session
agentlens todos --session abc123

# Output as JSON
agentlens todos --format json
```

**Options:**
| Option | Description |
|--------|-------------|
| `-l, --list` | List all TODOs (default) |
| `-s, --status <status>` | Filter by status: pending, in_progress, completed |
| `--session <id>` | Filter by session ID |
| `-f, --format <format>` | Output format: terminal, json |

## How It Works

### Hook System

Agent Lens uses a hook system to capture code changes from AI agents:

1. **For Cursor**: Uses the [Third-party Hooks](https://cursor.com/cn/docs/agent/hooks) feature
2. **For Claude Code**: Uses the [Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) feature

When you run `agentlens hook connect <agent>`, the CLI:
1. Detects if the agent is installed on your system
2. Creates/updates the agent's hook configuration file
3. Points the hooks to the `agentlens` CLI commands

### Data Storage

All captured data is stored in `.agentlens/data/hooks/`:

```
.agentlens/data/hooks/
├── changes/              # Code change records (sharded by date)
│   ├── 2024-01-10.jsonl
│   ├── 2024-01-11.jsonl
│   └── ...
├── prompts/              # User prompts (sharded by date)
│   └── 2024-01-10.jsonl
└── sessions.json         # Session metadata
```

### Contributor Detection

Agent Lens uses **4-level filtering with Levenshtein similarity matching** to determine code authorship:

```
Level 1: File Path Filter     (100 records → 30 records)
    ↓
Level 2: Time Window Filter   (30 records → 15 records)
    ↓
Level 3: Content Length Filter (15 records → 5 records)
    ↓
Level 4: Levenshtein Matching  (5 candidates → best match)
```

**Classification Thresholds:**
- ≥ 90% similarity → **AI Generated**
- 70-90% similarity → **AI Generated (Human Modified)**
- < 70% similarity → **Human Contribution**

## VS Code Extension

For the best experience, use the CLI together with the [Agent Lens VS Code Extension](https://marketplace.visualstudio.com/items?itemName=vibe-x-ai.agentlens).

![Agent Lens Inline Blame](https://v17-def.ap4r.com/kos/s101/nlav112218/mengshou/inline-blame.3916d683ae836108.png)

The extension provides:

- **GitLens-style inline blame** - Hover over any line to see if it was written by AI or human
- **Sidebar views** - Browse connected agents and recent AI-generated code changes
- **One-click issue reporting** - Report matching problems directly from VS Code
- **Auto cleanup** - Automatic cleanup of old data files

### Installation

```bash
# Install from VS Code Marketplace
code --install-extension vibe-x-ai.agentlens
```

Or search for "Agent Lens" in VS Code Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`).

**Note:** The VS Code extension works independently and does not require the CLI to be installed. Both tools can connect to AI agents directly.

## Requirements

- Node.js >= 22.15.1
- Git repository
- Supported AI Agent (Cursor or Claude Code)

## Related

- [Agent Lens](https://github.com/vibe-x-ai/agent-blame) - Main repository
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=vibe-x-ai.agentlens)

## License

MIT
