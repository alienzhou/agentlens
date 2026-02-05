# Discussion: Contributor Detection Mechanism and Display Interaction

> Status: Confirmed | Round: R2 | Date: 2026-01-26

## 📌 Discussion Background

This discussion is based on [Agent Blame Main Discussion on 2026-01-04](../2026-01-04/agent-blame/outline.md), further refining **Contributor Detection Mechanism** and **Display Interaction Design**.

### Project Two-Part Overview

| Part | Description |
|------|-------------|
| 1. Collection Layer | Collect agent execution information: generated code, source session, conversation rounds, todo items |
| 2. Display Layer | Integrate collected data with Git, display in VSCode in GitLens-like manner, distinguish human/AI contribution |

---

## 🔵 Current Focus

(This round confirmed, no pending discussion focus)

---

## ✅ Confirmed Decisions

### R1 Decisions

| ID | Title | Summary | Document |
|----|-------|---------|----------|
| D1 | Contributor Detection Mechanism | Hunk-level matching, Levenshtein algorithm, 90%/70% thresholds | [D01-contributor-detection.md](decisions/D01-contributor-detection.md) |
| D2 | Interaction Design - Floating Window | MVP phase: floating window with command hints, no direct jump | [D02-interaction-floating-window.md](decisions/D02-interaction-floating-window.md) |

### R2 Decisions

| ID | Title | Summary | Document |
|----|-------|---------|----------|
| D3 | Open Source Strategy | MIT license, full open source (all 4 layers) | [D03-open-source-strategy.md](decisions/D03-open-source-strategy.md) |
| D4 | Todo Item Definition | Agent's task breakdown output | [D04-todo-definition.md](decisions/D04-todo-definition.md) |

---

## ⏪ To Discuss

(No pending issues)

---

## 📁 Archive

(Archived content moved to decision documents)

---

## 📄 Discussion Artifacts

```
.codeflicker/discuss/2026-01-26/contributor-detection/
├── outline.md                              ← This file (discussion outline)
├── meta.yaml                               ← Metadata and decision tracking
└── decisions/
    ├── D01-contributor-detection.md        ← Contributor detection mechanism
    ├── D02-interaction-floating-window.md  ← Floating window interaction design
    ├── D03-open-source-strategy.md         ← Open source strategy
    └── D04-todo-definition.md              ← Todo item definition
```

---

## 🔗 Related Discussions

- [Agent Blame Main Discussion (2026-01-04)](../2026-01-04/agent-blame/outline.md) - Overall project architecture, protocol design, MVP strategy, etc.
