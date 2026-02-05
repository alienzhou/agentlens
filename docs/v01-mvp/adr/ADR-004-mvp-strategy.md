# ADR-004: MVP Strategy

**Status**: ✅ Decided (2026-01-04)  
**Related**: [ADR Index](./index.md)

---

## Context

Agent Blame adopts 4-layer architecture (Tool Layer/Data Layer/Product Core Layer/Product Delivery Layer), need to determine MVP implementation strategy and priorities.

---

## Decision Content

Adopt **Phased Strategy**:
- **Phase 0**: Tool Layer (2-3 weeks) - Data collection and fusion capabilities
- **Phase 1**: Data Layer Validation (2-3 weeks) - CLI tool validates data value
- **Phase 2**: Product Core Layer (4-6 weeks) - Protocol parsing and rendering
- **Phase 3**: Product Delivery Layer (Future) - IDE plugin and integration

---

## Alternatives

1. **Direct Product Development**: Skip Tool Layer, directly develop product features
2. **Full Stack Parallel**: Develop all four layers simultaneously
3. **Minimum Viable**: Only do basic functionality validation

---

## Decision Rationale

1. **Risk Control**: Validate data model effectiveness first, avoid building product on wrong foundation
2. **Quick Feedback**: CLI tool can quickly validate core assumptions
3. **Progressive Development**: Each phase has clear validation goals
4. **Resource Optimization**: Avoid investing too many resources in uncertain features

---

## Impact

**Positive Impact**:
- Reduce project risk
- Quickly get user feedback
- Progressively validate core assumptions

**Negative Impact**:
- Extended product feature delivery time
- Need additional CLI tool development

---

## Related Decisions

- Related to all other ADRs: Affects overall implementation strategy and priorities
