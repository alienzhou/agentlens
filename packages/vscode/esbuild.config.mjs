import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: [
    'vscode', // VSCode API is provided at runtime
  ],
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  // Resolve workspace dependencies
  mainFields: ['module', 'main'],
  resolveExtensions: ['.ts', '.js', '.json'],
};

async function build() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build complete');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
