import { Command } from 'commander';
import chalk from 'chalk';
import { GitIntegration, FileStorage } from '@agentlens/core';
import { TerminalDiffRenderer } from '../renderer/terminal-diff-renderer.js';

/**
 * diff command - Show annotated diff with contributor information
 */
export const diffCommand = new Command('diff')
  .description('Show annotated diff with AI/human contributor information')
  .option('-a, --annotated', 'Show annotated diff with contributor info', true)
  .option('-f, --format <format>', 'Output format: terminal, markdown, json', 'terminal')
  .option('-r, --ref <ref>', 'Git reference to diff against (default: working tree)')
  .option('--staged', 'Show staged changes only')
  .option('-o, --output <file>', 'Write output to file')
  .option('--no-color', 'Disable colored output')
  .action(async (options: DiffOptions) => {
    try {
      await executeDiff(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

interface DiffOptions {
  annotated: boolean;
  format: 'terminal' | 'markdown' | 'json';
  ref?: string;
  staged?: boolean;
  output?: string;
  color: boolean;
}

async function executeDiff(options: DiffOptions): Promise<void> {
  const cwd = process.cwd();
  const git = new GitIntegration(cwd);

  // Check if we're in a git repository
  const isRepo = await git.isGitRepository();
  if (!isRepo) {
    console.error(chalk.red('Error: Not a git repository'));
    process.exit(1);
  }

  // Get diff
  let diff;
  if (options.staged) {
    diff = await git.getStagedDiff();
    console.log(chalk.blue('Showing staged changes...'));
  } else if (options.ref) {
    diff = await git.getDiff(options.ref);
    console.log(chalk.blue(`Showing diff against ${options.ref}...`));
  } else {
    diff = await git.getDiff();
    console.log(chalk.blue('Showing working tree changes...'));
  }

  if (diff.files.length === 0) {
    console.log(chalk.yellow('No changes found.'));
    return;
  }

  // Load storage for contributor detection
  const storage = new FileStorage(cwd);
  const isInitialized = await storage.isInitialized();

  // Render based on format
  const renderer = new TerminalDiffRenderer({
    useColor: options.color,
    showContributor: options.annotated && isInitialized,
  });

  let output: string;

  switch (options.format) {
    case 'markdown':
      output = renderer.renderMarkdown(diff);
      break;
    case 'json':
      output = JSON.stringify(diff, null, 2);
      break;
    case 'terminal':
    default:
      output = renderer.render(diff);
      break;
  }

  // Output
  if (options.output) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(options.output, output, 'utf-8');
    console.log(chalk.green(`Output written to ${options.output}`));
  } else {
    console.log(output);
  }

  // Summary
  const summary = renderer.getSummary(diff);
  console.log();
  console.log(chalk.dim('─'.repeat(50)));
  console.log(
    chalk.cyan(`Files: ${String(summary.files)}`),
    chalk.green(`+${String(summary.additions)}`),
    chalk.red(`-${String(summary.deletions)}`)
  );

  if (summary.aiHunks > 0 || summary.humanHunks > 0) {
    console.log(
      chalk.magenta(`AI: ${String(summary.aiHunks)}`),
      chalk.blue(`Human: ${String(summary.humanHunks)}`),
      chalk.yellow(`AI+Modified: ${String(summary.aiModifiedHunks)}`)
    );
  }
}
