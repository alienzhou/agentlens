# D03: Output Format - GitLens Style

**Decision Time**: R3  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement
Determine the specific format for inline blame display at the end of lines.

---

## 🎯 Objective

Choose a clear display format with appropriate information density.

---

## 📊 Solution Comparison

| Solution | Example | Pros | Cons | Decision |
|----------|---------|------|------|----------|
| A. GitLens style | `John Doe, 3 days ago • fix: update config` | Complete information, familiar | Slightly long | ✅ |
| B. Simplified | `John Doe, 3d ago` | Concise | Missing commit message | ❌ |
| C. Author only | `John Doe` | Simplest | Insufficient information | ❌ |

---

## ✅ Final Decision

### Chosen Format
```
{author}, {relative_time} • {commit_message}
```

### Examples
```
John Doe, 3 days ago • fix: update config
You, 2 hours ago • feat: add blame view
Not Committed Yet                           // uncommitted lines
```

### Styling
- Color: Light gray (`#6c6c6c` or use ThemeColor)
- Position: End of line, 3em spacing
- Font: Inherit editor font

---

## 🔄 Change Log

| Round | Date | Changes | Reason |
|-------|------|---------|--------|
| R3 | 2026-01-27 | Initial decision | User chose GitLens style |
