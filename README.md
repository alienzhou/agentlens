# Agent Lens

> Code Review tool redesigned for the Vibe Coding era

[![CI](https://github.com/alienzhou/agentlens/actions/workflows/ci.yml/badge.svg)](https://github.com/alienzhou/agentlens/actions)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/vibe-x-ai.agentlens?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=vibe-x-ai.agentlens)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Beta](https://img.shields.io/badge/Status-Beta-blue.svg)](https://github.com/alienzhou/agentlens)

## 📋 Overview

Agent Lens is a Code Review tool designed specifically for the era of AI-assisted coding. It addresses the fundamental challenge of reviewing AI-generated code by providing:

- **Dual-Track Data Collection**: Captures both Hook events and session files from AI Agents
- **Contributor Detection**: Identifies whether code was written by AI or humans using hunk-level similarity matching
- **VS Code Sidebar Integration**: View connected agents and recent AI activity directly in VS Code
- **GitLens-Style Blame**: Displays contributor information inline when hovering over code
- **Multi-Agent Support**: Works with Cursor, Claude Code, and other AI coding assistants
- **Performance Optimized**: 4-level filtering for efficient matching on large datasets

## ✨ Key Features

### 🎯 Contributor Detection
- **4-Level Filtering**: File path → Time window → Content length → Levenshtein matching
- **High Performance**: 100 records < 50ms, 500 records < 150ms
- **Configurable Thresholds**: Customize AI/Human detection sensitivity

### 📊 Performance Monitoring
- **Real-time Tracking**: Monitor matching performance with detailed metrics
- **Bottleneck Analysis**: Automatic detection of performance issues
- **Developer Mode**: Enhanced debugging information in VS Code

### 🗂️ Smart Storage
- **Date-based Sharding**: Efficient JSONL files organized by date
- **Auto Cleanup**: Configurable retention policy (default: 7 days)
- **Prompt Tracking**: Link code changes to their triggering prompts

### 🐛 Report Issue
- **One-Click Reporting**: Report matching issues directly from VS Code
- **Rich Context**: Includes candidates, performance metrics, and debug info
- **User Feedback**: Collect expected results for improvement

## 🎯 Problem & Solution

### The Problem

In the Vibe Coding era:
- AI Agents generate large amounts of code quickly
- Traditional code review focuses on "human thinking process"
- Reviewing AI-generated code requires understanding the Agent's task breakdown and decision-making
- Git history shows human authors even for AI-generated code

### The Solution

Agent Lens provides:
1. **Agent Traceability**: Track which AI Agent generated which code
2. **Session Context**: Link code changes to the original conversation and task breakdown
3. **Contributor Classification**: Automatically detect AI vs. human contributions
4. **TODO Integration**: Connect code with the Agent's task breakdown

## 🏗️ Architecture

Agent Lens uses a 4-layer architecture:

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: Product Delivery                         │
│  (CLI Tool, VS Code Extension, GitLens Integration)│
├─────────────────────────────────────────────────────┤
│  Layer 3: Product Core                             │
│  (Protocol Parsing, Rendering, State Management)   │
├─────────────────────────────────────────────────────┤
│  Layer 2: Data Layer                               │
│  (ReviewUnit, SessionSource, Todo Models)          │
├─────────────────────────────────────────────────────┤
│  Layer 1: Tool Layer                               │
│  (Hook System, Session Monitoring, Git Integration)│
└─────────────────────────────────────────────────────┘
```

### Data Storage Structure

```
.agentlens/data/hooks/
├── changes/                    # Code change records (sharded by date)
│   ├── 2026-02-10.jsonl
│   ├── 2026-02-11.jsonl
│   └── 2026-02-12.jsonl
├── prompts/                    # User prompts (sharded by date)
│   ├── 2026-02-10.jsonl
│   └── 2026-02-11.jsonl
├── logs/
│   └── performance.jsonl       # Performance metrics
├── reports/                    # Issue reports
│   └── 2026-02-12/
│       └── report-{id}.json
└── sessions.json               # Session metadata
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 22.15.1
- pnpm >= 9.5.0
- Git repository

### Installation

```bash
# Clone the repository
git clone https://github.com/alienzhou/agentlens.git
cd agentlens

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Basic Usage

#### 1. Initialize Agent Lens in Your Project

```bash
cd your-project
agentlens config --init
```

This creates a `.agentlens/` directory with:
- `data/sessions/` - Session data
- `data/hooks/` - Hook captured data (sharded by date)
- `data/todos.json` - TODO items
- `config/` - Configuration files

#### 2. Connect to an AI Agent

```bash
# Connect to Cursor
agentlens hook connect cursor

# Connect to Claude Code
agentlens hook connect claude-code

# Check connection status
agentlens hook status
```

#### 3. View Annotated Diff

```bash
# Show working tree changes with contributor info
agentlens diff --annotated

# Show staged changes
agentlens diff --staged

# Output to markdown
agentlens diff --format markdown -o report.md
```

#### 4. Start a Review Session

```bash
# Interactive review session
agentlens review

# Filter by session
agentlens review --session abc123

# Export to file
agentlens review --format markdown -o review-report.md
```

#### 5. Manage TODOs

```bash
# List all TODOs
agentlens todos

# Filter by status
agentlens todos --status pending

# Output as JSON
agentlens todos --format json
```

## 📦 Packages

This monorepo contains:

| Package | Description | Status |
|---------|-------------|--------|
| **@agentlens/core** | Core data models, Git integration, contributor detection, performance tracking | ✅ Stable |
| **@agentlens/hook** | Agent hook adapters (Cursor, Claude Code) | ✅ Stable |
| **@agentlens/cli** | Command-line interface | ✅ Stable |
| **agentlens** (VSCode) | VS Code extension with blame annotations | ✅ Beta |

## 🔍 How It Works

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

**Classification Thresholds**:
- ≥ 90% similarity → **AI Generated**
- 70-90% similarity → **AI Generated (Human Modified)**
- < 70% similarity → **Human Contribution**

### VS Code Extension Features

- **Sidebar - Connected Agents**: View all detected AI agents and their connection status
- **Sidebar - Recent Activity**: Browse recent AI-generated code changes with quick file navigation
- **Line Blame**: Hover over any line to see contributor info (AI or Human)
- **Developer Mode**: Enable `agentLens.developerMode` for detailed debug info
- **Report Issue**: Click "🐛 Report Issue" to report matching problems
- **Auto Cleanup**: Automatic cleanup of old data files

### Configuration (VS Code)

```json
{
  "agentLens.matching.timeWindowDays": 3,
  "agentLens.matching.lengthTolerance": 0.5,
  "agentLens.autoCleanup.enabled": true,
  "agentLens.autoCleanup.retentionDays": 7,
  "agentLens.developerMode": false
}
```

## 🛠️ Development

### Project Structure

```
agentlens/
├── packages/
│   ├── core/          # Core library (detection, storage, performance)
│   ├── hook/          # Hook system (agent adapters)
│   ├── cli/           # CLI tool
│   └── vscode/        # VS Code extension
├── docs/              # Documentation
│   └── v01-mvp/       # MVP documentation
├── .github/           # CI/CD workflows
└── vitest.config.ts   # Test configuration
```

### Available Scripts

```bash
# Development
pnpm dev              # Watch mode for all packages
pnpm build            # Build all packages
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Generate coverage report

# Code Quality
pnpm lint             # Lint all packages
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code with Prettier
pnpm format:check     # Check code formatting
pnpm typecheck        # Type check all packages

# Cleanup
pnpm clean            # Remove build artifacts and node_modules
```

### Running Tests

```bash
# Run all tests (9 test files, 167+ test cases)
pnpm test:run

# Run tests for specific package
pnpm --filter @agentlens/core test

# Generate coverage report
pnpm test:coverage
```

### Test Coverage

| Test Category | Files | Test Cases |
|---------------|-------|------------|
| Sharded Storage | 1 | 22 |
| Cleanup Manager | 1 | 26 |
| 4-Level Filtering | 1 | 22 |
| Performance Tracker | 1 | 23 |
| Report Service | 1 | 34 |
| Integration Tests | 1 | 12 |
| Legacy Tests | 3 | 28 |
| **Total** | **9** | **167** |

## 📚 Documentation

- [Project Overview](./docs/v01-mvp/00-overview.md)
- [Requirements Analysis](./docs/v01-mvp/01-requirements.md)
- [Architecture Design](./docs/v01-mvp/architecture/index.md)
- [Task List](./docs/v01-mvp/04-task-list.md)
- [Verification Checklist](./docs/v01-mvp/05-verification.md)
- [ADR Index](./docs/v01-mvp/adr/index.md)

## 🗺️ Roadmap

- [x] **Phase 0**: Project infrastructure and tool layer
- [x] **Phase 1**: Data layer validation (CLI tool)
- [x] **Phase 2**: Product core layer (VS Code extension)
- [x] **Performance Optimization**: 4-level filtering, sharded storage
- [x] **Report Issue**: One-click issue reporting with rich context
- [ ] **Phase 3**: Product delivery layer (GitLens integration)
- [ ] **Marketplace Release**: Publish to VS Code Marketplace

See [docs/v01-mvp/04-task-list.md](./docs/v01-mvp/04-task-list.md) for detailed task breakdown.

## 📦 Installation

### VS Code Extension

Install from VS Code Marketplace:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Agent Lens"
4. Click Install

Or install via command line:
```bash
code --install-extension vibe-x-ai.agentlens
```

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the Vibe Coding movement
- Built with [simple-git](https://github.com/steveukx/git-js) for Git operations
- Uses [Commander.js](https://github.com/tj/commander.js) for CLI
- Styled with [chalk](https://github.com/chalk/chalk) for terminal output
- File watching with [chokidar](https://github.com/paulmillr/chokidar)
- Similarity matching with [fast-levenshtein](https://github.com/hiddentao/fast-levenshtein)

## 📧 Contact

- Author: [alienzhou](https://github.com/alienzhou)
- Repository: [agentlens](https://github.com/alienzhou/agentlens)
- Issues: [GitHub Issues](https://github.com/alienzhou/agentlens/issues)
- VS Code Marketplace: [Agent Lens](https://marketplace.visualstudio.com/items?itemName=vibe-x-ai.agentlens)
- Documentation: [docs/](./docs/)

---

**Note**: This is Beta version (v0.1). Core features including contributor detection, performance monitoring, and VS Code integration are functional. The Skill system for protocol content generation will be available in future versions.
