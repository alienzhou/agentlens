# Agent Guidelines

You are an expert TypeScript developer for a VSCode extension that tracks AI code contributions.

## Commands

```bash
# Build
pnpm build                    # Build all packages
pnpm --filter agentlens build  # Build VSCode extension only

# Test
pnpm test:run                 # Run all tests
pnpm test                     # Watch mode

# Lint & Format
pnpm lint                     # Check linting
pnpm format                   # Format code
```

## Project Structure

```
packages/
├── core/     # Data models, Git integration, similarity detection
├── hook/     # Agent adapters (Cursor, Claude), session monitoring
├── cli/      # CLI commands, terminal renderer
└── vscode/   # VSCode extension - blame view, hover provider
```

Key files:
- `packages/core/src/constants.ts` - Shared constants, similarity thresholds
- `packages/vscode/src/blame/contributor-service.ts` - AI vs Human detection
- `packages/vscode/src/blame/blame-service.ts` - Git blame integration
- `packages/vscode/src/utils/logger.ts` - Structured logging

## Code Style

**Imports:**
```typescript
// ✅ Good
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SomeType } from './local-file.js';  // .js extension required

// ❌ Bad
import fs from 'fs';
import { SomeType } from './local-file';
```

**Path handling:**
```typescript
// ✅ Good - use path module
path.basename(filePath)
path.join(dir, 'sub', 'file.ts')
path.relative(baseDir, filePath)

// ❌ Bad - string operations
filePath.split('/').pop()
`${dir}/sub/file.ts`
```

**Logging:**
```typescript
import { createModuleLogger } from '../utils/logger.js';
const log = createModuleLogger('module-name');

log.debug('Details', { key: value });
log.info('Event', { context });
log.error('Failed', error, { context });
```

**Language:**
- Code and documentation: English (comments, variables, logs, docs)
- Agent conversation output: Follow user's language

## Testing

- Tests location: `packages/*/tests/`
- VSCode mock: `packages/vscode/tests/__mocks__/vscode.ts`
- Run before commit: `pnpm test:run`

## Boundaries

✅ **Always do:**
- Use `path` module for file paths
- Add `.js` extension to local imports
- Run `pnpm build` after changes to verify
- Include context in log messages

⚠️ **Ask first:**
- Adding new dependencies
- Modifying `package.json`
- Changing core interfaces in `packages/core/`

🚫 **Never do:**
- Use string operations for file paths (`split('/')`, template literals)
- Commit secrets or API keys
- Modify `node_modules/` or `dist/`
- Remove failing tests
