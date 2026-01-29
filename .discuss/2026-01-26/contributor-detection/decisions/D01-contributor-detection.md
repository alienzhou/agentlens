# D01: Contributor Detection Mechanism

> Status: Confirmed | Round: R1 | Date: 2026-01-26

## Core Idea

Git author is unreliable (all are human commits), true judgment basis is similarity matching between code content and Agent generation records.

## Determination Process

```
┌─────────────────────────────────────────────┐
│ Step 1: Get Git blame (line-level precision)│
│         → Get commit info for each line     │
├─────────────────────────────────────────────┤
│ Step 2: For hunks involved in commit        │
│         → Similarity match with collected   │
│           Agent generation records          │
├─────────────────────────────────────────────┤
│ Step 3: Decision logic                      │
│         ├─ Similarity >= 90%  → "AI Generated"              │
│         ├─ Similarity 70-90% → "AI Generated (Human Modified)" │
│         ├─ Similarity < 70%  → "Human Contribution"         │
│         └─ No matching record → "Human Contribution"        │
└─────────────────────────────────────────────┘
```

## Decision Summary

| Decision Item | Choice | Notes |
|---------------|--------|-------|
| Matching Granularity | **Hunk Level** | Aligns with Git diff, balances precision and performance |
| Similarity Algorithm | **Edit Distance (Levenshtein)** | Simple and reliable, can be upgraded later |
| Threshold Configuration | **Configurable**, set fixed defaults in code | 90% (Pure AI) / 70% (AI+Modified) |
| Boundary Display | Distinguish "Pure AI" and "AI+Human Modified" | Provide users with clear contributor information |

## Technical Implementation Memo

```typescript
// config/similarity.ts
export const SIMILARITY_CONFIG = {
  THRESHOLD_PURE_AI: 0.90,        // >= 90% determined as pure AI generation
  THRESHOLD_AI_MODIFIED: 0.70,    // 70-90% determined as AI generation but human modified
  MATCHING_GRANULARITY: 'hunk' as const,
  ALGORITHM: 'levenshtein' as const,
};
```

## Git Blame Mechanism Analysis (Archive)

Git blame is **line-level tracing**, core logic:
- For each line in file, trace back from current commit to history
- Find "the commit that last modified this line"
- Return that commit's author, time, hash

**Key Point**: Git blame **does not do similarity matching**, it is exact matching:
- Line content identical → maintain attribution
- Line content changes (even 1 character) → New commit gets attribution

This is why we need to add similarity matching layer on top of Git blame.

---

*Related: [outline.md](../outline.md) | [D02-interaction-floating-window.md](D02-interaction-floating-window.md)*
