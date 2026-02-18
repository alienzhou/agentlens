import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  // CLI tool doesn't need type declarations
  dts: false,
  // Bundle workspace dependencies into the output
  noExternal: [
    '@vibe-x/agentlens-core',
    '@vibe-x/agentlens-hook',
  ],
  // Keep external npm dependencies as external
  external: [
    'chalk',
    'commander',
    'diff',
    'chokidar',
    'fast-levenshtein',
    'nanoid',
    'simple-git',
  ],
  // Minify for smaller bundle
  minify: false,
  // Tree shaking
  treeshake: true,
});
