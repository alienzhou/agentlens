import { Command } from 'commander';
import chalk from 'chalk';
import { FileStorage } from '@vibe-review/core';

/**
 * config command - Configure Vibe Review settings
 */
export const configCommand = new Command('config')
  .description('Configure Vibe Review settings')
  .option('--init', 'Initialize Vibe Review in the current project')
  .option('--show', 'Show current configuration')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options: ConfigOptions) => {
    try {
      await executeConfig(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

interface ConfigOptions {
  init?: boolean;
  show?: boolean;
  set?: string;
  reset?: boolean;
}

async function executeConfig(options: ConfigOptions): Promise<void> {
  const cwd = process.cwd();
  const storage = new FileStorage(cwd);

  if (options.init) {
    await initializeProject(storage);
    return;
  }

  if (options.reset) {
    await resetProject(storage);
    return;
  }

  if (options.set) {
    setConfig(options.set);
    return;
  }

  // Default: show configuration
  await showConfig(storage);
}

async function initializeProject(storage: FileStorage): Promise<void> {
  const isInitialized = await storage.isInitialized();

  if (isInitialized) {
    console.log(chalk.yellow('Vibe Review is already initialized in this project.'));
    const stats = await storage.getStats();
    console.log(chalk.dim(`  Sessions: ${String(stats.sessionsCount)}`));
    console.log(chalk.dim(`  Review Units: ${String(stats.reviewUnitsCount)}`));
    console.log(chalk.dim(`  TODOs: ${String(stats.todosCount)}`));
    return;
  }

  console.log(chalk.blue('Initializing Vibe Review...'));

  await storage.initialize();

  console.log(chalk.green('✓ Vibe Review initialized successfully!'));
  console.log();
  console.log(chalk.dim('Created .vibe-review/ directory with:'));
  console.log(chalk.dim('  - data/sessions/    (session data)'));
  console.log(chalk.dim('  - data/review-units/ (review unit data)'));
  console.log(chalk.dim('  - data/todos.json    (todo items)'));
  console.log(chalk.dim('  - config/           (configuration)'));
  console.log();
  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.dim('  1. Connect an AI Agent: vibe-review hook connect cursor'));
  console.log(chalk.dim('  2. Use your Agent normally'));
  console.log(chalk.dim('  3. View changes: vibe-review diff --annotated'));
}

async function resetProject(storage: FileStorage): Promise<void> {
  const isInitialized = await storage.isInitialized();

  if (!isInitialized) {
    console.log(chalk.yellow('Vibe Review is not initialized in this project.'));
    return;
  }

  console.log(chalk.yellow('⚠️  Warning: This will delete all Vibe Review data!'));
  console.log(chalk.dim('  - All session data'));
  console.log(chalk.dim('  - All review units'));
  console.log(chalk.dim('  - All TODOs'));
  console.log(chalk.dim('  - All configuration'));
  console.log();

  // In a real implementation, we'd prompt for confirmation
  // For now, we'll require an explicit flag

  console.log(chalk.red('This action requires manual confirmation.'));
  console.log(chalk.dim('To reset, delete the .vibe-review/ directory manually.'));
}

function setConfig(keyValue: string): void {
  const [key, ...valueParts] = keyValue.split('=');
  const value = valueParts.join('=');

  if (!key || !value) {
    console.log(chalk.red('Invalid format. Use --set key=value'));
    return;
  }

  console.log(chalk.blue(`Setting ${key} = ${value}`));
  console.log(chalk.yellow('Note: Configuration persistence is not yet implemented.'));
  console.log(chalk.dim('This will be available in a future version.'));
}

async function showConfig(storage: FileStorage): Promise<void> {
  console.log(chalk.blue.bold('📋 Vibe Review Configuration'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log();

  const isInitialized = await storage.isInitialized();

  console.log(chalk.white('Status:'));
  console.log(`  Initialized: ${isInitialized ? chalk.green('Yes') : chalk.yellow('No')}`);

  if (isInitialized) {
    const stats = await storage.getStats();
    console.log();
    console.log(chalk.white('Data:'));
    console.log(`  Sessions: ${chalk.cyan(stats.sessionsCount.toString())}`);
    console.log(`  Review Units: ${chalk.cyan(stats.reviewUnitsCount.toString())}`);
    console.log(`  TODOs: ${chalk.cyan(stats.todosCount.toString())}`);
  }

  console.log();
  console.log(chalk.white('Paths:'));
  console.log(`  Project Root: ${chalk.dim(process.cwd())}`);
  console.log(`  Data Directory: ${chalk.dim('.vibe-review/')}`);

  if (!isInitialized) {
    console.log();
    console.log(chalk.yellow('Run "vibe-review config --init" to initialize.'));
  }
}
