# ADR-006: Contributor Detection Mechanism

**Status**: ✅ Decided (2026-01-26)  
**Related**: [ADR Index](./index.md)

---

## Context

Git author information is unreliable (all commits are from human accounts), need to establish a mechanism to distinguish whether code is AI-generated or human-written based on code content similarity matching.

---

## Decision Content

Use **Hunk-level similarity matching** to determine code contributor:

**Detection Process**:
```
Step 1: Get Git blame (line-level precision)
        → Get commit info for each line
Step 2: For hunks involved in commit
        → Similarity match with collected Agent generation records
Step 3: Decision logic
        ├─ Similarity >= 90%  → "AI Generated"
        ├─ Similarity 70-90% → "AI Generated (Human Modified)"
        ├─ Similarity < 70%  → "Human Contribution"
        └─ No matching record → "Human Contribution"
```

**Configuration**:

| Decision Item | Choice | Notes |
|---------------|--------|-------|
| Matching Granularity | **Hunk Level** | Aligns with Git diff, balances precision and performance |
| Similarity Algorithm | **Levenshtein Edit Distance** | Simple and reliable, can be upgraded later |
| Threshold Configuration | **Configurable**, set fixed defaults | 90% (Pure AI) / 70% (AI+Modified) |
| Boundary Display | Distinguish "Pure AI" and "AI+Human Modified" | Provide users with clear contributor info |

---

## Alternatives

1. **Line-Level Matching**: Higher precision but more complex, prone to noise interference
2. **File-Level Matching**: Simpler but too coarse-grained, can't distinguish partial modifications
3. **AST-Based Matching**: Semantic-level matching, higher complexity but more accurate

---

## Decision Rationale

1. **Git Alignment**: Hunk is the natural unit in Git diff
2. **Performance Balance**: Hunk-level is more efficient than line-level, more precise than file-level
3. **Simplicity**: Levenshtein algorithm is simple and reliable, easy to implement and debug
4. **Iterability**: Threshold configuration supports later adjustments and optimization

---

## Impact

**Positive Impact**:
- Clearly distinguish AI/human code contributions
- Provide accurate contribution statistics
- Help Review focus on appropriate content

**Negative Impact**:
- Similarity algorithm may have edge case errors
- Need to store Agent generation records for comparison
