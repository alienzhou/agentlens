# Releasing Guide

Quick reference for publishing AgentLens packages.

## Packages to Publish

| Package | Target | Command |
|---------|--------|---------|
| `@vibe-x/agentlens-cli` | npm | `npm publish` |
| `agentlens` (VSCode) | VS Code Marketplace | `vsce publish` |

> **Note**: `core` and `hook` packages are bundled into CLI and VSCode extension. No separate publishing required.

---

## Prerequisites

### npm (for CLI)

```bash
# Login to npm
npm login

# Verify @vibe-x org access
npm whoami
npm org ls vibe-x
```

### VS Code Marketplace (for Extension)

1. Create publisher at https://marketplace.visualstudio.com/manage
2. Generate Personal Access Token (PAT) at https://dev.azure.com
   - Scopes: `Marketplace > Manage`
3. Login with vsce:
   ```bash
   npm install -g @vscode/vsce
   vsce login vibe-x-ai
   ```

---

## Release CLI

```bash
# 1. Build
pnpm build

# 2. Test locally
cd packages/cli
node dist/index.js --version
node dist/index.js --help

# 3. Publish
npm publish --access public
```

---

## Release VSCode Extension

```bash
# 1. Build
pnpm build

# 2. Package
cd packages/vscode
vsce package

# 3. Test locally (optional)
# Install .vsix via: Extensions > ... > Install from VSIX

# 4. Publish
vsce publish
```

---

## Version Bump

Before releasing, update version in:

- `packages/cli/package.json`
- `packages/vscode/package.json`
- Root `package.json` (optional)
- `CHANGELOG.md`

```bash
# Example: bump to 0.2.0
pnpm -r exec -- npm version 0.2.0 --no-git-tag-version
```

---

## Pre-release Checklist

- [ ] All tests pass: `pnpm test`
- [ ] Build succeeds: `pnpm build`
- [ ] CLI works: `agentlens --version`
- [ ] VSCode extension loads without errors
- [ ] CHANGELOG.md updated
- [ ] README screenshots accessible (commit pushed)
- [ ] Version numbers consistent

---

## Troubleshooting

### npm publish fails with 403

```bash
# Check org membership
npm org ls vibe-x

# Ensure publishConfig in package.json
"publishConfig": { "access": "public" }
```

### vsce publish fails

```bash
# Re-login
vsce logout vibe-x-ai
vsce login vibe-x-ai

# Check PAT expiration and scopes
```

### Extension icon not showing

Ensure `icon.png` exists at `packages/vscode/resources/icon.png` (PNG format, 128x128 recommended).
