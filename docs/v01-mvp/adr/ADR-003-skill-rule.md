# ADR-003: Skill and Rule Collaboration Approach

**Status**: ✅ Decided (2026-01-04), Deferred to Post-MVP (2026-01-27)  
**Related**: [ADR Index](./index.md)

---

## Context

In the Hook + Skill dual-track system, need to define Skill trigger methods, storage locations, granularity design, and version management strategies.

> **Note**: This ADR describes the Skill system design for **Post-MVP** phase.
> MVP focuses on passive data collection (Hook + Session monitoring).
> Skill implementation will be revisited after MVP validation.

---

## Decision Content

- **Rule Location**: Declared in AGENTS.md + independent file defining details
- **Trigger Method**: Agent autonomous invocation (not forced trigger)
- **Skill Granularity**: Core Skills (required) + Optional Skills
- **Version Management**: Rule and Skill synchronous upgrade

---

## Alternatives

1. **Centralized Management**: All Rules and Skills defined in AGENTS.md
2. **Forced Trigger**: System forces Agent to call Skill
3. **Single Skill**: Only one large, comprehensive Skill
4. **Independent Versioning**: Rule and Skill independent version management

---

## Decision Rationale

1. **Separation of Concerns**: AGENTS.md responsible for declaration, independent files responsible for implementation details
2. **Agent Autonomy**: Maintains Agent's autonomous decision-making capability, improving adaptability
3. **Progressive Adoption**: Core + Optional design supports progressive feature adoption
4. **Consistency Assurance**: Synchronous version management ensures Rule and Skill consistency

---

## Impact

**Positive Impact**:
- Clear responsibility separation
- Better Agent compatibility
- Support for progressive feature extension

**Negative Impact**:
- Need to maintain multiple files
- Complexity of version synchronization

---

## Related Decisions

- [ADR-002 (Data Acquisition Strategy)](./ADR-002-data-acquisition.md): Skill is Post-MVP component of dual-track system
- [ADR-004 (MVP Strategy)](./ADR-004-mvp-strategy.md): Skill deferred to Post-MVP
