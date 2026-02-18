import { Command } from 'commander';
import chalk from 'chalk';
import { GitIntegration, FileStorage } from '@agentlens/core';
import { TerminalDiffRenderer } from '../renderer/terminal-diff-renderer.js';

/**
 * review command - Interactive code review workflow
 */
export const reviewCommand = new Command('review')
  .description('Start an interactive code review session')
  .option('-f, --format <format>', 'Output format: terminal, markdown', 'terminal')
  .option('--session <id>', 'Filter by session ID')
  .option('--since <date>', 'Show changes since date (e.g., "2024-01-01")')
  .option('-o, --output <file>', 'Write report to file')
  .action(async (options: ReviewOptions) => {
    try {
      await executeReview(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

interface ReviewOptions {
  format: 'terminal' | 'markdown';
  session?: string;
  since?: string;
  output?: string;
}

async function executeReview(options: ReviewOptions): Promise<void> {
  const cwd = process.cwd();
  const git = new GitIntegration(cwd);
  const storage = new FileStorage(cwd);

  // Check if we're in a git repository
  const isRepo = await git.isGitRepository();
  if (!isRepo) {
    console.error(chalk.red('Error: Not a git repository'));
    process.exit(1);
  }

  // Initialize storage if needed
  const isInitialized = await storage.isInitialized();
  if (!isInitialized) {
    console.log(chalk.yellow('Agent Lens not initialized in this project.'));
    console.log(chalk.dim('Run "agent-lens config --init" to initialize.'));
    console.log();
  }

  // Get review units
  let reviewUnits = await storage.listReviewUnits();

  // Filter by session if specified
  if (options.session) {
    const sessionFilter = options.session;
    reviewUnits = reviewUnits.filter(
      (unit) => unit.sessionSource.sessionId.includes(sessionFilter)
    );
  }

  // Filter by date if specified
  if (options.since) {
    const sinceDate = new Date(options.since).getTime();
    reviewUnits = reviewUnits.filter((unit) => unit.createdAt >= sinceDate);
  }

  console.log(chalk.blue.bold('📋 Agent Lens - Code Review Session'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log();

  if (reviewUnits.length === 0) {
    console.log(chalk.yellow('No review units found.'));
    console.log(chalk.dim('Changes need to be captured via Hook or Session monitoring first.'));
    console.log();

    // Fall back to showing current diff
    console.log(chalk.blue('Showing current working tree changes:'));
    const diff = await git.getDiff();

    if (diff.files.length === 0) {
      console.log(chalk.yellow('No uncommitted changes.'));
      return;
    }

    const renderer = new TerminalDiffRenderer({ useColor: true, showContributor: false });
    console.log(renderer.render(diff));
    return;
  }

  // Group review units by session
  const sessionGroups = new Map<string, typeof reviewUnits>();
  for (const unit of reviewUnits) {
    const sessionId = unit.sessionSource.sessionId;
    if (!sessionGroups.has(sessionId)) {
      sessionGroups.set(sessionId, []);
    }
    sessionGroups.get(sessionId)?.push(unit);
  }

  console.log(chalk.cyan(`Found ${String(reviewUnits.length)} review units across ${String(sessionGroups.size)} sessions`));
  console.log();

  // Display each session
  let output = '';

  for (const [sessionId, units] of sessionGroups) {
    const firstUnit = units[0];
    if (!firstUnit) continue;
    const agent = firstUnit.sessionSource.agent;

    output += `\n## Session: ${sessionId}\n`;
    output += `Agent: ${agent} | Units: ${String(units.length)}\n`;
    output += '─'.repeat(40) + '\n';

    if (options.format === 'terminal') {
      console.log(chalk.magenta.bold(`\n📍 Session: ${sessionId.substring(0, 8)}...`));
      console.log(chalk.dim(`   Agent: ${agent} | Units: ${String(units.length)}`));
    }

    for (const unit of units) {
      const filesChanged = new Set(unit.hunks.map((h) => h.filePath)).size;
      const totalAdditions = unit.hunks.reduce((sum, h) => sum + h.addedLines.length, 0);
      const totalDeletions = unit.hunks.reduce((sum, h) => sum + h.removedLines.length, 0);

      output += `\n### Review Unit: ${unit.id}\n`;
      output += `Files: ${String(filesChanged)} | +${String(totalAdditions)} -${String(totalDeletions)}\n`;

      if (unit.annotation.intent) {
        output += `Intent: ${unit.annotation.intent}\n`;
      }

      if (options.format === 'terminal') {
        console.log();
        console.log(chalk.white(`   ${chalk.bold('Unit:')} ${unit.id.substring(0, 16)}...`));
        console.log(
          chalk.dim('   ') +
            chalk.cyan(`Files: ${String(filesChanged)}`) +
            chalk.dim(' | ') +
            chalk.green(`+${String(totalAdditions)}`) +
            chalk.dim(' ') +
            chalk.red(`-${String(totalDeletions)}`)
        );

        if (unit.annotation.intent) {
          console.log(chalk.dim('   ') + chalk.yellow(`Intent: ${unit.annotation.intent}`));
        }
      }
    }
  }

  // Output to file if specified
  if (options.output) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(options.output, output, 'utf-8');
    console.log();
    console.log(chalk.green(`Report written to ${options.output}`));
  }

  // Summary
  console.log();
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.blue.bold('Summary:'));
  console.log(`  Sessions: ${String(sessionGroups.size)}`);
  console.log(`  Review Units: ${String(reviewUnits.length)}`);

  // Todos
  const todos = await storage.listTodos();
  const pendingTodos = todos.filter((t) => t.status === 'pending').length;
  const inProgressTodos = todos.filter((t) => t.status === 'in_progress').length;

  if (todos.length > 0) {
    console.log(
      `  TODOs: ${String(todos.length)} (${String(pendingTodos)} pending, ${String(inProgressTodos)} in progress)`
    );
  }
}
