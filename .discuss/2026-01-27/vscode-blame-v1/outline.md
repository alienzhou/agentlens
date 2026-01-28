# VS Code Blame V1 Implementation Plan

> Status: Complete | Date: 2026-01-27

## 🎯 Goal

Implement basic Git Blame view to lay the foundation for future AI contributor information display.

## ✅ Confirmed

| ID | Decision | Document |
|----|----------|----------|
| D01 | MVP Scope: Clean Files + Inline Blame | [→ D01](./decisions/D01-mvp-scope.md) |
| D02 | Technical Approach: Full File Blame + Cache | [→ D02](./decisions/D02-tech-approach.md) |
| D03 | Output Format: GitLens Style | [→ D03](./decisions/D03-output-format.md) |
| D04 | File Structure: Simplified Two-File Architecture | [→ D04](./decisions/D04-file-structure.md) |

## 📋 Implementation Summary

### V1 Scope
- ✅ Clean files (saved)
- ✅ Inline blame (end of current line)
- ❌ Dirty files (V2)
- ❌ Hover details (V2)

### Output Format
```
{author}, {relative_time} • {commit_message}
Example: John Doe, 3 days ago • fix: update config
```

### File Structure
```
packages/vscode/src/
├── extension.ts
└── blame/
    ├── blame-service.ts   # Git blame execution + cache
    └── line-blame.ts      # Decorator + cursor listener
```

### Technical Highlights
- Full file blame + Map cache
- 250ms debounce
- `git blame --root --incremental`

## ⏸️ Deferred (V2)

- [ ] Dirty file support (`--contents` stdin)
- [ ] Hover details
- [ ] Status bar display
- [ ] Gutter decoration

## 📁 Archive

| Topic | Conclusion | Details |
|-------|------------|---------|
| GitLens Architecture Research | 4-layer architecture, full file cache strategy | [→ notes](./notes/gitlens-architecture.md) |
