# D01: Logo Design - GitLens-style with Hexagon Nodes

**Status**: Confirmed  
**Date**: 2026-02-19

## Decision

Adopt **GitLens-inspired commit graph with hexagon nodes** as the AgentLens logo.

## Visual Description

```
    ⬡
    │
    ⬡
    │
    ⬡
```

- Vertical line (commit graph backbone)
- 3 hexagon nodes along the line
- Single color (`currentColor`) for VSCode theme compatibility

## Rationale

1. **GitLens kinship**: AgentLens does "Agent blame" like GitLens does "Git blame" — visual relationship is appropriate
2. **Clear differentiation**: Hexagons instead of circles immediately signals "AI/tech" aesthetic
3. **Simplicity**: Clean silhouette works at 24px Activity Bar size
4. **Recognition**: Users familiar with GitLens will understand the concept immediately

## Rejected Alternatives

- **Magnifying glass**: Too generic, doesn't convey attribution
- **Eye/Lens**: Doesn't relate to multi-agent collaboration
- **C3 Nodes orbiting code**: Less recognizable than commit graph style
- **Mixed shapes**: Too complex at small sizes
- **Fork/branch**: Loses "commit history" linear feel
- **Star nodes**: Too "magical", not technical enough

## Implementation

- File: `packages/vscode/resources/icon.svg`
- Uses `currentColor` for automatic theme adaptation
- 24x24 viewBox with 3 vertically aligned hexagon nodes
