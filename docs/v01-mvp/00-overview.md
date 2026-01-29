# Agent Blame v0.1 (MVP) - Project Overview

**Project Name**: Agent Blame  
**Version**: v0.1 (MVP)  
**Project Type**: Code Review Tool  
**Development Stage**: Design Completed, Ready for Implementation  
**Last Updated**: 2026-01-27

---

## Project Introduction

**Agent Blame** is a Code Review tool redesigned for the Vibe Coding era, aimed at addressing the fundamental issues where traditional review methods cannot effectively review AI-generated code.

### Core Philosophy
The essence of Review is not "checking code," but "establishing understanding and trust in code."

### Core Problems
Using "industrial-era human review rituals" to review "post-industrial era machine-synthesized code" presents 6 structural problems:

1. **Object Changed**: From "human thinking" to "results from unknown systems"
2. **Scale Imbalance**: Generation is parallel, review is serial
3. **Trust Failure**: From "trust the person + check code" to "only check code remains"
4. **Focus Shift**: From "text level" to "system semantic level"
5. **Cognitive Burden Transformation**: From "evaluation" to "reverse engineering + interrogation + explosion prevention"
6. **Unclear Boundaries**: Division of review responsibilities between humans and agents is undefined

---

## MVP Scope

### What's Included (MVP)
- **Dual-Track Data Collection**: Hook capture + Session file monitoring
- **Contributor Detection**: Hunk-level Levenshtein matching (90%/70% thresholds)
- **VS Code Plugin**: Agent detection, connection, Blame view display
- **CLI Tool**: Basic diff and review commands

### What's Deferred (Post-MVP)
- **Skill System**: Protocol content generation (WHAT/WHY/HOW TO VERIFY/IMPACT)
- **Standalone Panel**: Web-based review dashboard
- **Direct Jump**: Navigation to Agent conversations

---

## Technical Architecture

4-layer architecture design:
```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Product Delivery                                    │
│  ├─ VS Code Plugin | CLI Tool                                 │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Product Core                                       │
│  ├─ Protocol Parser | Rendering Engine | State Mgmt          │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Data Layer                                        │
│  ├─ SessionSource | ReviewUnit | Todo                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Tool Layer                                        │
│  ├─ Hook + Session Monitoring | Git Integration | Data Fusion│
└─────────────────────────────────────────────────────────────┘
```

---

## Documentation Navigation

### 📋 Pre-Phase Documents
- **[01-requirements.md](./01-requirements.md)** - Requirements Analysis  
  Problem background, user scenarios, functional requirements, and constraints

### 🎯 Architecture Decision Records
- **[adr/index.md](./adr/index.md)** - ADR Index  
  - [ADR-001](./adr/ADR-001-protocol.md) - Agent Review Protocol Design
  - [ADR-002](./adr/ADR-002-data-acquisition.md) - Data Acquisition Strategy
  - [ADR-003](./adr/ADR-003-skill-rule.md) - Skill and Rule Collaboration
  - [ADR-004](./adr/ADR-004-mvp-strategy.md) - MVP Strategy
  - [ADR-005](./adr/ADR-005-open-source.md) - Open Source Strategy
  - [ADR-006](./adr/ADR-006-contributor-detection.md) - Contributor Detection
  - [ADR-007](./adr/ADR-007-interaction.md) - MVP Interaction Strategy
  - [ADR-008](./adr/ADR-008-todo-definition.md) - Todo Item Definition

### 🏗️ Architecture Design
- **[architecture/index.md](./architecture/index.md)** - Architecture Overview
  - [01-layer-tool.md](./architecture/01-layer-tool.md) - Tool Layer
  - [02-layer-data.md](./architecture/02-layer-data.md) - Data Layer
  - [03-layer-product-core.md](./architecture/03-layer-product-core.md) - Product Core Layer
  - [04-layer-delivery.md](./architecture/04-layer-delivery.md) - Product Delivery Layer
  - [05-core-mechanisms.md](./architecture/05-core-mechanisms.md) - Core Mechanisms
  - [06-nfr.md](./architecture/06-nfr.md) - Non-Functional Requirements

### 🔧 Development Phase Documents
- **[04-task-list.md](./04-task-list.md)** - Task List
- **[05-verification.md](./05-verification.md)** - Verification Checklist
- **[06-backlog.md](./06-backlog.md)** - Backlog List

---

## Development Roadmap

### Phase 0: Tool Layer (2-3 weeks)
- Implement Hook system and adapters
- Implement Session file monitoring
- Implement Contributor Detection
- Define data model TypeScript types
- Implement Data Fusion Engine
- Implement terminal output for CLI

### Phase 1: Data Layer Validation (2-3 weeks)
- Develop CLI tool (diff, review commands)
- Validate data model with real projects
- Collect feedback on data usefulness

### Phase 2: Product Core Layer (4-6 weeks)
- Develop VS Code plugin
- Implement Agent detection and connection
- Implement Blame view display
- Add floating window interaction

### Phase 3: Product Delivery Layer (Future)
- GitLens integration
- Standalone panel
- Skill system (protocol generation)

---

## Quick Links

| Resource | Link |
|----------|------|
| Repository | [GitHub](https://github.com/alienzhou/agent-blame) |
| Original Discussion | [.codeflicker/discuss/](../../.codeflicker/discuss/) |
| MIT License | [LICENSE](../../LICENSE) |

---

*This is the MVP version documentation. Future versions will have separate directories (v0.2, v1.0, etc.).*
