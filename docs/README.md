# Vibe Review Documentation

This directory contains versioned documentation for the Vibe Review project.

## Current Versions

| Version | Status | Description |
|---------|--------|-------------|
| [v01-mvp](./v01-mvp/) | 🚧 In Development | MVP version - data collection and Blame display |

## Version Roadmap

| Version | Planned Features |
|---------|-----------------|
| v01-mvp | Hook + Session monitoring, Contributor detection, VS Code plugin, CLI |
| v02-understand | Skill system, Protocol generation |
| v10-review | Full product with GitLens integration, Standalone panel |

## Documentation Structure

Each version directory contains:

```
v{version}/
├── 00-overview.md           # Version overview
├── 01-requirements.md       # Requirements analysis
├── adr/                     # Architecture Decision Records
│   ├── index.md
│   ├── ADR-001-xxx.md
│   └── ...
├── architecture/            # Architecture design (split by layer)
│   ├── index.md
│   ├── 01-layer-tool.md
│   ├── 02-layer-data.md
│   └── ...
├── 04-task-list.md          # Development tasks
├── 05-verification.md       # Verification checklist
└── 06-backlog.md            # Future backlog
```

## Related Resources

- [Original Discussion](./../.codeflicker/discuss/) - Technical discussions and decision process
- [Repository](https://github.com/alienzhou/vibe-review)
