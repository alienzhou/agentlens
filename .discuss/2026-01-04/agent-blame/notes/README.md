# Agent Blame Technical Solution Overview

**Project Name**: **Agent Blame**  
**Date**: 2026-01-04  
**Status**: Design completed, ready for implementation

---

## Project Positioning

**Agent Blame** is a Code Review tool designed for Vibe Coding era, solving the problem that traditional review methods cannot effectively review AI-generated code.

**Core Philosophy**: The essence of Review is not "checking code," but "establishing understanding and trust in code."

---

## Core Problem

Using "industrial-era human review rituals" to review "post-industrial era machine-synthesized code," there are 6 structural problems:

1. **Object Changed**: From "human thinking" to "results from unknown systems"
2. **Scale Imbalance**: Generation is parallel, review is serial
3. **Trust Failure**: From "trust person + check code" to "only check code remains"
4. **Focus Shift**: From "text level" to "system semantic level"
5. **Cognitive Burden Transformation**: From "evaluation" to "reverse engineering + interrogation + explosion prevention"
6. **Unclear Boundaries**: Human and Agent review division undefined

---

## Solution

### Product Architecture (4 Layers)

```
┌─────────────────────────────────────────────┐
│  Layer 4: Product Delivery Layer                     │
│  ├─ GitLens Integration | Standalone Panel | IDE Plugin | Terminal Tool            │
├─────────────────────────────────────────────┤
│  Layer 3: Product Core Layer                       │
│  ├─ Protocol Parser | Rendering Engine | Interaction Logic | State Management              │
├─────────────────────────────────────────────┤
│  Layer 2: Data Layer                               │
│  ├─ SessionSource | ReviewUnit | Todo                       │
├─────────────────────────────────────────────┤
│  Layer 1: Tool Layer                                 │
│  ├─ Hook + Skill Dual-Track | Git Integration | Post-processing                  │
└─────────────────────────────────────────────┘
```

### Core Mechanisms

1. **Agent Review Protocol v0.3**: 4-layer protocol structure (WHAT/WHY/HOW TO VERIFY/IMPACT)
2. **Hook + Skill Dual-Track**: Passive collection of execution trace + active generation of protocol content
3. **ReviewUnit Concept**: Multi-Hunk combination + annotations + TODO association
4. **TODO Bidirectional Index**: Support click to locate to conversation

---

## Decision Documents

| Document | Content | Status |
|----------|---------|--------|
| [D01-agent-review-protocol.md](../decisions/D01-agent-review-protocol.md) | Protocol structure, required/optional fields, complete example | ✅ Confirmed |
| [D02-data-acquisition-strategy.md](../decisions/D02-data-acquisition-strategy.md) | Hook + Skill Dual-Track, adapter layer design | ✅ Confirmed |
| [D03-skill-rule-collaboration.md](../decisions/D03-skill-rule-collaboration.md) | Rule location, trigger method, Skill granularity, version management | ✅ Confirmed |
| [D04-mvp-strategy.md](../decisions/D04-mvp-strategy.md) | Phased strategy, data model, terminal output format | ✅ Confirmed |

---

## MVP Strategy

### Phase 0: Tool Layer (2-3 weeks)

- [ ] Implement agent-blame-core Skill
- [ ] Define data model TypeScript types
- [ ] Implement Hook Core + first Adapter
- [ ] Implement data fusion logic
- [ ] Implement terminal output

### Phase 1: Data Layer Validation (2-3 weeks)

- [ ] Terminal tool: `agent-blame diff --annotated`
- [ ] Verify if data model is correct
- [ ] Verify if data is helpful for Review

### Phase 2: Product Core Layer (4-6 weeks)

- [ ] Protocol parser
- [ ] Rendering engine
- [ ] Interaction logic

### Phase 3: Product Delivery Layer (Future)

- [ ] VS Code plugin
- [ ] GitLens integration
- [ ] CLI improvement

---

## Issues to Resolve

| Issue | Status | Explanation |
|-------|--------|-------------|
| Q3: Trust Metrics | 🏸️ Deferred | MVP phase focuses on "understanding", trust measurement needs data accumulation |
| Q8: Open Source Strategy | ❓ To Confirm | Whether Product Delivery Layer should be open sourced? |

---

## Technology Selection

| Component | Selection | Reason |
|----------|-----------|--------|
| Git Integration | simple-git | Structured data, cross-platform compatible |
| Skill Format | Agent Skills Protocol | Standardized, community compatible |
| Storage Format | JSON | Simple, easy to debug |
| Terminal Output | Custom format | Quick validation |

---

## Related Links

- **Agent Skills Protocol**: https://agentskills.io/specification
- **Discussion Outline**: [outline.md](../outline.md)

---

**Last Updated**: 2026-01-04
