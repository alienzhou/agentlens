# D01: VS Code Blame V1 MVP Scope

**Decision Time**: R3  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement
vibe-review needs to display code blame information in VS Code to lay the foundation for future AI contributor identification features.

### Constraints
- Need to be available quickly to validate core interactions
- Keep code simple, avoid over-engineering

---

## 🎯 Objective

Define the feature boundaries for V1 version to implement a minimum viable product.

---

## 📊 Solution Comparison

| Feature | V1 | V2 | Reason |
|---------|----|----|--------|
| Clean file support | ✅ | ✅ | Basic functionality |
| Dirty file support | ❌ | ✅ | Requires stdin handling, slightly complex |
| Inline blame | ✅ | ✅ | Core interaction |
| Hover details | ❌ | ✅ | Enhanced feature |
| Status bar | ❌ | ✅ | Enhanced feature |
| Gutter decoration | ❌ | ✅ | Enhanced feature |

---

## ✅ Final Decision

### V1 Scope
1. **Only support Clean files** (saved files)
2. **Only implement inline blame** (display at end of current line)
3. Exclude enhanced features like hover, status bar, gutter, etc.

### Decision Rationale
- Minimize implementation complexity
- Quickly validate core interaction experience
- Reserve expansion space for V2 features

### Expected Outcome
Users see blame information at the end of the line where the cursor is located in saved files.

---

## 🔄 Change Log

| Round | Date | Changes | Reason |
|-------|------|---------|--------|
| R3 | 2026-01-27 | Initial decision | User confirmation |
