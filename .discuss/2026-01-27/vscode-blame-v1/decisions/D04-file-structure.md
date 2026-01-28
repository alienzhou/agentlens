# D04: File Structure - Simplified Two-File Architecture

**Decision Time**: R3  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement
Determine the code organization for blame functionality in VS Code extension.

### Constraints
- Simple code, easy to maintain
- Clear responsibilities

---

## 🎯 Objective

Design a simplified but clear file structure.

---

## 📊 Solution Comparison

| Solution | File Count | Complexity | Decision |
|----------|------------|------------|----------|
| A. GitLens style (complete) | 8+ files | High | ❌ |
| B. Simplified two files | 2 files | Low | ✅ |
| C. Single file | 1 file | Lowest | ❌ (unclear responsibilities) |

---

## ✅ Final Decision

### File Structure
```
packages/vscode/src/
├── extension.ts           # Entry point, register commands and events
└── blame/
    ├── blame-service.ts   # Git blame execution + parsing + cache
    └── line-blame.ts      # Decorator + cursor listener
```

### Responsibility Division

| File | Responsibility |
|------|----------------|
| `blame-service.ts` | Execute `git blame`, parse output, manage cache |
| `line-blame.ts` | Listen to cursor changes, create/update decorators |
| `extension.ts` | Initialize, register with VS Code |

### Comparison with GitLens

| GitLens | vibe-review V1 |
|---------|----------------|
| `git.ts` + `blameParser.ts` | `blame-service.ts` |
| `lineTracker.ts` + `lineAnnotationController.ts` | `line-blame.ts` |
| `documentTracker.ts` | Not needed (simplified) |
| `annotations.ts` | Inline in `line-blame.ts` |

### Decision Rationale
- GitLens's complex architecture is to support many features
- V1 only needs inline blame, two files are sufficient
- Split further when needed later

---

## 🔄 Change Log

| Round | Date | Changes | Reason |
|-------|------|---------|--------|
| R3 | 2026-01-27 | Initial decision | User confirmation |
