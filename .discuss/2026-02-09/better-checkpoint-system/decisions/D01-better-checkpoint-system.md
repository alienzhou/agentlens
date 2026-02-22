# D01: Better Checkpoint System - Git-Based AI Code Version Management

**Decision ID**: D01  
**Decision Date**: 2026-02-09  
**Status**: ✅ Confirmed  
**Participants**: zhouhongxuan, CodeFlicker

---

## 1. Background and Problem

### 1.1 Problem Statement

Current mainstream Coding Agent products (Cursor, Claude Code, OpenCode, Antigravity, etc.) have serious design flaws in their **Checkpoint and Accept/Reject functionality**, resulting in poor user experience.

### 1.2 Seven Core Problems with Existing Products

| # | Problem | Description |
|---|------|------|
| 1 | **Disconnected from Git** | After accept/reject, additional Git operations are still required |
| 2 | **No Version Management** | Checkpoint and accept/reject lack basic version management |
| 3 | **Only Rollback, No Redo** | Missing Redo capability |
| 4 | **Coarse Granularity** | Only block-level accept, cannot operate on single lines precisely |
| 5 | **Parallelization Issues** | Rollback behavior is unpredictable after parallel changes |
| 6 | **Lack of Advanced Operations** | Git's cherry-pick and other fine-grained operations not utilized |
| 7 | **Insufficient Non-Developer Support** | Basic Git operations can be provided via IDE UI but are underutilized |

### 1.3 Core Insight

> **Instead of building another Checkpoint system outside of Git, just use Git as the underlying engine.**

Git is already the most familiar version management tool for programmers, and Agents are better at Git than most programmers. Reinventing the wheel is not only wasteful but also increases users' cognitive burden.

---

## 2. Solution

### 2.1 Core Philosophy

**Use Git directly as the underlying engine**, mapping existing Checkpoint/Accept/Reject concepts to Git operations through cognitive restructuring:

| Agent Product Concept | Git Equivalent |
|---------------|-----------|
| Accept change | `git add` (staging) |
| Reject change | `git checkout` / `git reset` |
| Checkpoint | `git commit` / `git stash` |
| Rollback | `git reset` / `git revert` |
| Fine-grained operations | `git add -p`, cherry-pick, interactive rebase |

### 2.2 Product Form

**Don't build a standalone product**, instead integrate within existing IDE (VS Code):
- Reuse VS Code Source Control UI (no additional Review UI development)
- Reuse VS Code's native line-level staging capability
- Extend comment and smart commit features through VS Code extension

### 2.3 Overall Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Agent generates code                                        │
│          (collect session/task info via agent-blame hook)            │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: User Review (VS Code Source Control + AgentBlame)           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Diff View + Blame info                                        │  │
│  │  Each line shows: which Agent modified, why, which task        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  User Actions:                                                        │
│  ├─ ✅ Stage (Accept)    → git add (supports line-level)             │
│  ├─ ❌ Reset (Reject)    → git reset / checkout                      │
│  └─ 💬 Comment (Feedback) → Add comment via Comment Controller       │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
           ┌───────────────┐           ┌───────────────┐
           │  Step 3:       │           │  Step 4:      │
           │  Agent Revise  │           │  Smart Commit │
           │  (per comments)│           │  (auto split) │
           └───────┬───────┘           └───────────────┘
                   │
                   └──────────▶ Back to Step 2
```

---

## 3. Technical Decisions

### 3.1 Comment System

| Decision Item | Decision | Rationale |
|-------|------|------|
| **Comment UI** | VS Code Comment Controller API | Native support, PR Review-like experience, displayable in diff view |
| **Comment Storage** | `.agent-blame/comments/` local files | Persistent, trackable status, easy prompt generation |
| **Comment Trigger** | Manual mode (click button to copy to clipboard) | Simple and feasible for MVP, upgradeable to auto later |

**Comment Storage Format**:
```json
{
  "id": "comment-abc123",
  "timestamp": "2026-02-09T16:30:00Z",
  "file": "src/utils/api.ts",
  "lineRange": { "start": 42, "end": 45 },
  "hunkContent": "+ const result = await fetch(url)\n+ if (!result.ok) throw new Error()",
  "comment": "Should add timeout handling here",
  "status": "pending",
  "sessionId": "session-xyz"
}
```

### 3.2 Smart Commit Split

| Decision Item | Decision | Rationale |
|-------|------|------|
| **Split Strategy** | Hybrid mode | Balance accuracy and robustness |
| **Priority** | Session info > Semantic analysis | Session info is more accurate |

**Hybrid Strategy**:
1. Prioritize using session info collected by agent-blame (changes in same session grouped together)
2. When session info is insufficient, use Agent semantic analysis (analyze code logic relevance)

### 3.3 Integration with AgentBlame

| agent-blame Existing Capabilities | This Solution Reuse/New |
|---------------------|----------------|
| Hook System (Cursor/Claude Code) | ✅ Reuse |
| Contributor Detection | ✅ Reuse |
| VS Code Blame View | ✅ Reuse |
| CLI diff/review | ✅ Reuse |
| Comment UI | 🆕 New |
| Smart Commit Split | 🆕 New |

---

## 4. Problem Resolution Verification

| Original Problem | Solution | Verification Status |
|-------|---------|---------|
| 1. Disconnected from Git | Git is the only engine, no extra operations needed | ✅ |
| 2. No version management | Use Git commit/branch/tag directly | ✅ |
| 3. Only rollback, no redo | Git reflog / reset supports bidirectional | ✅ |
| 4. Only block-level | VS Code natively supports "Stage Selected Ranges" | ✅ |
| 5. Parallelization issues | Smart Commit splits by session | ✅ |
| 6. Lack of advanced operations | Agent uses Skills to call cherry-pick, etc. | ✅ |
| 7. Non-developer support | VS Code Source Control UI provides visualization | ✅ |

---

## 5. Tech Stack

| Component | Technology Choice |
|-----|---------|
| **IDE Integration** | VS Code Extension API |
| **Comment UI** | VS Code Comment Controller |
| **Data Collection** | agent-blame Hook System |
| **Agent Control** | Rules / AGENTS.md / Skills |
| **Deep Integration** | Claude Code Hooks |
| **Version Management** | Git (native) |

---

## 6. Next Steps

### Suggested MVP Scope

| Feature | Priority | Rationale |
|-----|--------|------|
| Comment UI (Comment Controller) | P0 | Core differentiating feature |
| Comment → Clipboard | P0 | Simple and feasible |
| AgentBlame Blame View Integration | P0 | Existing code available |
| Smart Commit Split | P1 | Valuable but complex |
| Auto-trigger Agent | P2 | Depends on Hooks, can be deferred |

### Suggested Project Structure

Recommend as an **extension module of agent-blame**:
```
agent-blame/
├── packages/
│   ├── core/           # Existing
│   ├── hook/           # Existing
│   ├── cli/            # Existing
│   ├── vscode/         # Existing, needs extension
│   └── checkpoint/     # 🆕 New: Smart Commit split logic
```

---

## 7. Decision Log

| Time | Decision Content |
|-----|---------|
| 2026-02-09 | Confirmed core philosophy: Git as underlying engine |
| 2026-02-09 | Confirmed accept/reject mapping: staging = accept, reset = reject |
| 2026-02-09 | Confirmed reuse VS Code Source Control UI |
| 2026-02-09 | Confirmed integration with AgentBlame |
| 2026-02-09 | Confirmed comment storage: `.agent-blame/comments/` |
| 2026-02-09 | Confirmed comment trigger: manual mode (click button to copy) |
| 2026-02-09 | Confirmed comment UI: VS Code Comment Controller API |
| 2026-02-09 | Confirmed smart commit strategy: hybrid mode (Session + Semantic) |

---

## 8. References

- [VS Code Comment Controller API](https://code.visualstudio.com/api/references/vscode-api#comments)
- [VS Code Source Control API](https://code.visualstudio.com/api/extension-guides/scm-provider)
- [agent-blame Repository](file:///Users/zhouhongxuan/program/works/vibe-x-ai/agent-blame)
- [GitLens Feature Reference](https://help.gitkraken.com/gitlens/gitlens-features/)

---

**Document Version**: v1.0  
**Last Updated**: 2026-02-09
