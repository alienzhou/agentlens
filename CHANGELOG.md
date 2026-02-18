# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-18

### Added

#### Core Features
- **Contributor Detection**: Identify AI vs. human code contributions using hunk-level similarity matching
- **4-Level Filtering Optimization**: File path → Time window → Content length → Levenshtein matching
- **Performance Monitoring**: Real-time tracking with bottleneck analysis and warning thresholds
- **Sharded Storage**: Date-based JSONL files for efficient data management
- **Auto Cleanup**: Configurable retention policy with automatic old file removal
- **Report Issue**: One-click issue reporting with rich context and user feedback

#### Packages
- **@agent-blame/core**: Core library with detection, storage, performance tracking, and report generation
- **@agent-blame/hook**: Agent adapters for Cursor and Claude Code
- **@agent-blame/cli**: Command-line interface for project initialization and management
- **@agent-blame/vscode**: VS Code extension with line blame, hover info, and developer mode

#### VS Code Extension
- Line-level contributor blame annotations
- Hover information with session context and prompts
- Developer mode with detailed debug information
- Report Issue button for feedback collection
- Configurable matching parameters

#### CLI Commands
- `agent-blame config --init`: Initialize project
- `agent-blame hook connect <agent>`: Connect to AI agent
- `agent-blame hook status`: Check connection status
- `agent-blame diff --annotated`: View annotated diff
- `agent-blame review`: Start review session
- `agent-blame todos`: Manage TODOs

#### Testing
- 167+ test cases across 9 test files
- Unit tests for storage, detection, performance, and reports
- Integration tests for complete workflows
- Performance benchmarks (100 records < 50ms, 500 records < 150ms)

### Configuration Options

```json
{
  "agentBlame.matching.timeWindowDays": 3,
  "agentBlame.matching.lengthTolerance": 0.5,
  "agentBlame.autoCleanup.enabled": true,
  "agentBlame.autoCleanup.retentionDays": 7,
  "agentBlame.developerMode": false
}
```

### Performance Targets

| Dataset Size | Target | Status |
|--------------|--------|--------|
| 100 records | < 50ms | ✅ |
| 500 records | < 150ms | ✅ |
| 1000 records | < 500ms | ✅ |

### Technical Details

- **RecordId Format**: `{timestamp}-{8-char-nanoid}`
- **Storage Structure**: Date-sharded JSONL files under `.agent-blame/data/hooks/`
- **Similarity Thresholds**:
  - ≥ 90%: AI Generated
  - 70-90%: AI Generated (Human Modified)
  - < 70%: Human Contribution

### Dependencies

- Node.js >= 22.15.1
- pnpm >= 9.5.0
- VS Code >= 1.85.0 (for extension)

---

## [Unreleased]

### Planned
- GitLens integration
- VS Code Marketplace release
- Additional agent adapters (Gemini, OpenCode)
- Skill system for protocol content generation
