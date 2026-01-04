# Vibe Review Project Overview

**Project Name**: Vibe Review  
**Project Type**: Code Review Tool  
**Development Stage**: Design Completed, Ready for Implementation  
**Document Version**: v1.0  
**Last Updated**: 2026-01-04

---

## Project Introduction

**Vibe Review** is a Code Review tool redesigned for the Vibe Coding era, aimed at addressing the fundamental issues where traditional review methods cannot effectively review AI-generated code.

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

## Solution Overview

### Product Positioning
A combination of product features + tools + standard specifications, providing a complete Code Review solution for the AI era.

### Core Features
- **Agent Review Protocol v0.3**: 4-layer protocol structure (WHAT/WHY/HOW TO VERIFY/IMPACT)
- **Hook + Skill Dual-Track System**: Passive collection of execution chain + active generation of protocol content
- **ReviewUnit Concept**: Multi-hunk combination + annotations + TODO association
- **TODO Bidirectional Index**: Support click-to-navigate to conversations

### Technical Architecture
4-layer architecture design:
```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Product Delivery                                    │
│  ├─ GitLens Integration | Standalone Panel | IDE Plugin | CLI    │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Product Core                                       │
│  ├─ Protocol Parser | Rendering Engine | Interaction Logic | State Mgmt │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Data Layer                                        │
│  ├─ SessionSource | ReviewUnit | Todo                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Tool Layer                                        │
│  ├─ Hook + Skill Dual-Track | Git Integration | Post-processing│
└─────────────────────────────────────────────────────────────┘
```

---

## Documentation Navigation

This project follows Doc.Tech specification to organize technical documentation. Here is the complete documentation index:

### 📋 Pre-Phase Documents
- **[01-requirements-analysis.md](./01-requirements-analysis.md)** - Requirements Analysis  
  Problem background, user scenarios, functional requirements, and constraints

- **[02-adr.md](./02-adr.md)** - Architecture Decision Records  
  Detailed records and reasoning for 4 key architecture decisions

### 🏗️ Technical Design Documents
- **[03-architecture-design.md](./03-architecture-design.md)** - Architecture Design  
  Overall system architecture, core mechanisms, and technology selection

### 🔧 Implementation Phase Documents
- **[04-implementation-guide.md](./04-implementation-guide.md)** - Technical Implementation Manual  
  Directory structure, module division, key interfaces, and basic framework

- **[05-task-list.md](./05-task-list.md)** - Task List  
  Current version development tasks and temporary pending items

- **[06-verification-checklist.md](./06-verification-checklist.md)** - Verification Checklist  
  Checkpoints and risk items to focus on during acceptance

- **[07-backlog.md](./07-backlog.md)** - Backlog List  
  Features and optimizations not implemented in current version but may be implemented in the future

### 📄 Original Discussion Documents
Original discussion and decision process records are in the `discuss/` directory:
- `discuss/README.md` - Technical solution overview
- `discuss/outline.md` - Complete discussion outline
- `discuss/decisions/` - Detailed decision documents

---

## Development Roadmap

### Phase 0: Tool Layer (2-3 weeks)
- Implement vibe-review-core Skill
- Define data model TypeScript types
- Implement Hook Core + first Adapter
- Implement data fusion logic
- Implement terminal output

### Phase 1: Data Layer Validation (2-3 weeks)
- CLI tool: `vibe-review diff --annotated`
- Verify data model correctness
- Verify if data helps with Review

### Phase 2: Product Core Layer (4-6 weeks)
- Protocol parser
- Rendering engine
- Interaction logic

### Phase 3: Product Delivery Layer (Future)
- VS Code plugin
- GitLens integration
- CLI improvement

---

## Technology Selection

| Component | Selection | Reason |
|-----------|-----------|--------|
| Git Integration | simple-git | Structured data, cross-platform compatibility |
| Skill Format | Agent Skills Protocol | Standardization, community compatibility |
| Storage Format | JSON | Simple, easy to debug |
| Terminal Output | Custom format | Quick validation |

---

## Project Status

### Completed
- ✅ Core problem analysis and solution design
- ✅ Agent Review Protocol v0.3 definition
- ✅ Data acquisition strategy (Hook + Skill dual-track system)
- ✅ System architecture design
- ✅ MVP strategy formulation

### In Progress
- 🔄 Technical documentation organization (this document)

### Not Started
- ⏳ vibe-review-core Skill implementation
- ⏳ Hook Core and adapter development
- ⏳ Data model implementation

---

## Related Links

- **GitHub Repository**: https://github.com/alienzhou/vibe-review
- **Agent Skills Protocol**: https://agentskills.io/specification
- **Project README**: ../README.md

---

*This document follows the Doc.Tech specification, focusing on the organization and management of technical implementation.*
