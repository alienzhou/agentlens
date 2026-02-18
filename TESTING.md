# AgentLens Testing Guide

This document describes the testing strategy, test structure, and verification procedures for the AgentLens project.

## Prerequisites

Ensure the following are installed:
- Node.js >= 22.15.1
- pnpm >= 9.5.0
- Git repository environment

---

## Test Overview

AgentLens uses [Vitest](https://vitest.dev/) as the testing framework with comprehensive coverage across all packages.

### Test Statistics

| Category | Files | Test Cases | Description |
|----------|-------|------------|-------------|
| **Core - Storage** | 2 | 48 | Sharded storage, cleanup manager |
| **Core - Detection** | 3 | 51 | Contributor detection, filtering, Levenshtein |
| **Core - Performance** | 1 | 23 | Performance tracking and analysis |
| **Core - Report** | 1 | 34 | Report generation and validation |
| **Core - Integration** | 1 | 12 | End-to-end workflow tests |
| **VSCode** | 1 | 10 | Contributor service tests |
| **Total** | **9** | **167+** | |

---

## Running Tests

### Quick Start

```bash
# Run all tests once
pnpm test:run

# Run tests in watch mode (for development)
pnpm test

# Generate coverage report
pnpm test:coverage
```

### Package-Specific Tests

```bash
# Run core package tests only
pnpm --filter @agentlens/core test

# Run VSCode extension tests
pnpm --filter agentlens test
```

---

## Test Structure

### Core Package Tests

```
packages/core/tests/
├── storage/
│   ├── file-storage-sharded.test.ts   # Sharded storage read/write (22 tests)
│   └── cleanup-manager.test.ts        # Auto cleanup mechanism (26 tests)
├── detection/
│   └── contributor-detector-filtering.test.ts  # 4-level filtering (22 tests)
├── performance/
│   └── performance-tracker.test.ts    # Performance metrics (23 tests)
├── report/
│   └── report-service.test.ts         # Report generation (34 tests)
├── integration.test.ts                # End-to-end tests (12 tests)
├── contributor-detector.test.ts       # Basic detection (7 tests)
└── levenshtein-matcher.test.ts        # Similarity matching (11 tests)
```

### VSCode Extension Tests

```
packages/vscode/tests/
├── contributor-service.test.ts        # Line contributor detection (10 tests)
└── __mocks__/
    └── vscode.ts                      # VSCode API mocks
```

---

## Test Categories

### 1. Sharded Storage Tests (`file-storage-sharded.test.ts`)

Tests date-based sharded storage for code changes and prompts.

**Covered scenarios:**
- Directory structure creation
- Date-based sharded file writing
- RecordId auto-generation
- Multi-day shard reading
- Time window filtering
- Concurrent write handling
- Invalid JSON line handling
- Edge cases (empty content, timezone)

### 2. Cleanup Manager Tests (`cleanup-manager.test.ts`)

Tests automatic cleanup of old data files.

**Covered scenarios:**
- Default/custom configuration
- Retention period enforcement
- Multi-directory cleanup (changes + prompts)
- Boundary date handling
- Cleanup scheduling
- Statistics reporting
- Error handling

### 3. 4-Level Filtering Tests (`contributor-detector-filtering.test.ts`)

Tests the optimized filtering strategy.

**Covered scenarios:**
- Level 1: File path filtering
- Level 2: Time window filtering
- Level 3: Content length filtering
- Level 4: Levenshtein similarity
- Progressive candidate reduction
- Performance tracking integration
- Configuration options

### 4. Performance Tracker Tests (`performance-tracker.test.ts`)

Tests performance monitoring and analysis.

**Covered scenarios:**
- Metrics initialization
- Data loading tracking
- Filter step recording
- Levenshtein call tracking
- Bottleneck analysis
- Warning thresholds
- Log entry conversion

### 5. Report Service Tests (`report-service.test.ts`)

Tests issue report generation.

**Covered scenarios:**
- Report ID generation
- Timestamp formatting
- Complete report structure
- Developer mode debug info
- Serialization/deserialization
- Validation logic
- Edge cases (unicode, special chars)

### 6. Integration Tests (`integration.test.ts`)

Tests complete workflow from storage to detection to reporting.

**Covered scenarios:**
- Complete workflow: Storage → Detection → Report
- Large dataset handling (100+ records)
- 4-level filtering effectiveness
- Cleanup integration
- Multi-session handling
- Prompt tracking
- Performance benchmarks (100 records < 50ms, 500 records < 150ms)
- Error handling (corrupted data, missing directories)

---

## Manual Testing

### Step 1: Build Project

```bash
cd /path/to/agentlens
pnpm build
```

**Verification Point:** No compilation errors, all packages built successfully

### Step 2: Link CLI to Global

```bash
cd packages/cli
pnpm link --global

# Verify installation
agentlens --version
```

**Expected Output:** `0.1.0`

### Step 3: Initialize Target Project

```bash
cd $YOUR_PROJECT_DIR
agentlens config --init
ls -la .agentlens/
```

**Expected Directory Structure:**
```
.agentlens/
├── config/
├── data/
│   ├── hooks/
│   │   ├── changes/
│   │   ├── prompts/
│   │   ├── logs/
│   │   └── reports/
│   ├── sessions/
│   └── review-units/
└── todos.json
```

### Step 4: Connect to AI Agent

```bash
# Connect to Claude Code
agentlens hook connect claude-code

# Check connection status
agentlens hook status

# View injected configuration
cat ~/.claude/settings.json
```

**Expected Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "agentlens hook posttooluse --agent claude-code"
      }]
    }]
  }
}
```

### Step 5: Test Data Collection

1. Open Claude Code and perform file edit operations
2. Check collected data:

```bash
# View code change shards
ls -la .agentlens/data/hooks/changes/

# View session data
ls -la .agentlens/data/sessions/

# Use CLI to view diff
agentlens diff --annotated
```

### Step 6: Test VS Code Extension

1. Open VS Code in a project with AgentLens data
2. Hover over a line to see contributor info
3. Enable Developer Mode: Settings → `agentLens.developerMode`
4. Test Report Issue by clicking "🐛 Report Issue" in hover

### Step 7: Cleanup (After Testing)

```bash
cd packages/cli
pnpm unlink --global

# Verify uninstallation
agentlens --version  # Should report command not found
```

---

## Verification Checklist

| Category | Verification Point | Status |
|----------|-------------------|--------|
| **Build** | No compilation errors | ⬜ |
| **Tests** | All 167 tests pass | ⬜ |
| **CLI** | `agentlens --version` returns `0.1.0` | ⬜ |
| **Init** | `.agentlens/` directory created | ⬜ |
| **Hook** | Claude Code hook configured | ⬜ |
| **Collection** | Data shards created by date | ⬜ |
| **Detection** | Contributor detection works | ⬜ |
| **VSCode** | Hover shows blame info | ⬜ |
| **Report** | Report Issue generates JSON | ⬜ |
| **Cleanup** | Old files auto-cleaned | ⬜ |

---

## Performance Benchmarks

The integration tests verify these performance targets:

| Dataset Size | Target | Measured |
|--------------|--------|----------|
| 100 records | < 50ms | ✅ |
| 500 records | < 150ms | ✅ |
| 1000 records | < 500ms | ✅ |

To run performance tests:

```bash
pnpm test:run -- --grep "Performance"
```

---

## Troubleshooting

### Issue 1: `agentlens: command not found`

**Solution:** Ensure `pnpm link --global` has been executed, and the pnpm global bin is in PATH.

### Issue 2: Tests Fail with Module Resolution Errors

**Solution:**
```bash
pnpm clean
pnpm install
pnpm build
pnpm test:run
```

### Issue 3: VSCode Mock Errors

**Solution:** Ensure the VSCode mock is properly configured in `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    vscode: path.resolve(__dirname, 'packages/vscode/tests/__mocks__/vscode.ts'),
  },
}
```

### Issue 4: Performance Tests Timing Out

**Solution:** Check if running on a slow machine. Increase timeouts if needed:
```typescript
it('should process 500 records under 150ms', async () => {
  // ...
}, { timeout: 10000 });
```

---

## Contributing Tests

When adding new features, please:

1. Add unit tests for new functionality
2. Update integration tests if workflow changes
3. Maintain test coverage above 80%
4. Follow existing test patterns and naming conventions

---

## Related Documentation

- [README.md](./README.md) - Project overview
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [CHANGELOG.md](./CHANGELOG.md) - Version history
