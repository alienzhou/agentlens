# ADR-005: Open Source Strategy

**Status**: ✅ Decided (2026-01-26)  
**Related**: [ADR Index](./index.md)

---

## Context

Vibe Review is positioned as an open standard and tool, needing to determine open source scope and license selection to promote community adoption.

---

## Decision Content

- **License**: MIT
- **Scope**: Full open source (all 4 layers)

| Layer | Description | Open Source |
|-------|-------------|-------------|
| Protocol Specification | Agent Review Protocol v0.3 | ✅ Yes |
| Tool Layer | Collection tools, CLI utilities | ✅ Yes |
| Product Core Layer | Core business logic, data processing | ✅ Yes |
| Product Delivery Layer | VSCode extension, UI components | ✅ Yes |

---

## Alternatives

1. **Partial Open Source**: Only open source protocol specification and tool layer
2. **Dual License**: Core open source, commercial license for enterprise features
3. **Delayed Decision**: Wait for community growth before deciding

---

## Decision Rationale

1. **Community Adoption**: MIT license is business-friendly, beneficial for ecosystem building
2. **Transparency**: Full open source allows community to audit and contribute
3. **Ecosystem Growth**: Encourages other Agent products to integrate with the protocol
4. **Early Stage**: Project is in early stage, community building is more important than commercial considerations

---

## Impact

**Positive Impact**:
- Accelerate community adoption
- Build ecosystem trust
- Attract more contributors

**Negative Impact**:
- Future commercial model may be limited
- Need to maintain complete codebase publicly
