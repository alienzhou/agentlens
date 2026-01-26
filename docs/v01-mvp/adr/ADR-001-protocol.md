# ADR-001: Agent Review Protocol Design

**Status**: ✅ Decided (2026-01-04)  
**Related**: [ADR Index](./index.md)

---

## Context

In the Vibe Coding era, Agent-generated code lacks "author intent" transmission, causing Review to become "reverse engineering." We need a protocol for Agents to provide structured explanations when generating code.

---

## Decision Content

Adopt **4-layer protocol structure**:
- **WHAT layer**: Intent (intent), Changes (changes)
- **WHY layer**: Rationale (rationale)
- **HOW TO VERIFY layer**: Tests (tests), Edge Cases (edge cases)
- **IMPACT layer**: Impact (impact analysis)

---

## Alternatives

1. **3-layer structure**: WHAT/WHY/HOW TO VERIFY (without IMPACT)
2. **5-layer structure**: Add META layer as required field
3. **Free format**: No enforced structure, Agents freely express

---

## Decision Rationale

1. **IMPACT as independent layer**: Impact analysis is important enough to deserve separate attention, especially in complex systems
2. **Structured design**: Ensures completeness and consistency of information transmission
3. **Balanced complexity**: 4-layer structure balances completeness and usability

---

## Impact

**Positive Impact**:
- Provides complete code understanding framework
- Standardizes Agent output format
- Facilitates tool parsing and display

**Negative Impact**:
- Increases complexity of Agent-generated content
- Requires Agents to have impact analysis capabilities

---

## Related Decisions

- [ADR-002 (Data Acquisition Strategy)](./ADR-002-data-acquisition.md): Protocol content is generated through Skill
