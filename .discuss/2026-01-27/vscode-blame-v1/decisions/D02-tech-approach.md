# D02: Technical Approach - Full File Blame + Cache

**Decision Time**: R3  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement
Need to determine git blame data acquisition and caching strategy.

### Constraints
- Performance requirement: Fast response when cursor switches
- Code simplicity: Avoid complex architecture like GitLens

---

## 🎯 Objective

Choose appropriate blame data acquisition strategy, balancing performance and implementation complexity.

---

## 📊 Solution Comparison

| Solution | Description | Pros | Cons | Decision |
|----------|-------------|------|------|----------|
| A. Single line query | Execute `git blame -L line,line` on each cursor movement | Simple | Frequent command execution, poor performance | ❌ |
| B. Full file + cache | Get full file blame first, subsequent queries from cache | Good performance | Slightly slower on first access | ✅ |
| C. VS Code Git API | Use VS Code built-in Git API | Native | Limited API, doesn't support blame | ❌ |

### GitLens Approach
- `getBlameForLine()` defaults to calling `getBlame()` (full file)
- Results cached in `doc.state`
- Subsequent queries directly retrieve from `lines[editorLine]`

---

## ✅ Final Decision

### Chosen Solution
**Solution B: Full file blame + cache**

```typescript
// Cache structure
const blameCache = new Map<string, GitBlame>();  // filePath → blame result

// Retrieval logic
async function getBlameForLine(filePath: string, line: number) {
  let blame = blameCache.get(filePath);
  if (!blame) {
    blame = await executeGitBlame(filePath);
    blameCache.set(filePath, blame);
  }
  return blame.lines[line];
}
```

### Other Technical Decisions

| Item | Decision |
|------|----------|
| Git command | `git blame --root --incremental <file>` |
| Execution method | `child_process.execFile` |
| Debounce time | 250ms (reference GitLens) |
| Cache invalidation | Clear on file save |

### Decision Rationale
- Users frequently switch lines, full file cache avoids repeated git command execution
- GitLens has validated the effectiveness of this strategy
- Simple implementation, only need a Map for caching

---

## 🔄 Change Log

| Round | Date | Changes | Reason |
|-------|------|---------|--------|
| R3 | 2026-01-27 | Initial decision | Reference GitLens implementation |
