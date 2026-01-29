import * as path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { FileStorage, DATA_DIR_NAME, DATA_SUBDIRS, DATA_FILES } from '@agent-blame/core';

/**
 * config command - Configure Agent Blame settings
 */
export const configCommand = new Command('config')
  .description('Configure Agent Blame settings')
  .option('--init', 'Initialize Agent Blame in the current project')
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
    console.log(chalk.yellow('Agent Blame is already initialized in this project.'));
    const stats = await storage.getStats();
    console.log(chalk.dim(`  Sessions: ${String(stats.sessionsCount)}`));
    console.log(chalk.dim(`  Review Units: ${String(stats.reviewUnitsCount)}`));
    console.log(chalk.dim(`  TODOs: ${String(stats.todosCount)}`));
    return;
  }

  console.log(chalk.blue('Initializing Agent Blame...'));

  await storage.initialize();

  console.log(chalk.green('✓ Agent Blame initialized successfully!'));
  console.log();
  console.log(chalk.dim(`Created ${DATA_DIR_NAME}${path.posix.sep} directory with:`));
  console.log(chalk.dim(`  - ${path.posix.join(DATA_SUBDIRS.DATA, DATA_SUBDIRS.SESSIONS)}${path.posix.sep}    (session data)`));
  console.log(chalk.dim(`  - ${path.posix.join(DATA_SUBDIRS.DATA, DATA_SUBDIRS.REVIEW_UNITS)}${path.posix.sep} (review unit data)`));
  console.log(chalk.dim(`  - ${path.posix.join(DATA_SUBDIRS.DATA, DATA_FILES.TODOS)}    (todo items)`));
  console.log(chalk.dim(`  - ${DATA_SUBDIRS.CONFIG}${path.posix.sep}           (configuration)`));
  console.log();
  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.dim('  1. Connect an AI Agent: agent-blame hook connect cursor'));
  console.log(chalk.dim('  2. Use your Agent normally'));
  console.log(chalk.dim('  3. View changes: agent-blame diff --annotated'));
}

async function resetProject(storage: FileStorage): Promise<void> {
  const isInitialized = await storage.isInitialized();

  if (!isInitialized) {
    console.log(chalk.yellow('Agent Blame is not initialized in this project.'));
    return;
  }

  console.log(chalk.yellow('⚠️  Warning: This will delete all Agent Blame data!'));
  console.log(chalk.dim('  - All session data'));
  console.log(chalk.dim('  - All review units'));
  console.log(chalk.dim('  - All TODOs'));
  console.log(chalk.dim('  - All configuration'));
  console.log();

  // In a real implementation, we'd prompt for confirmation
  // For now, we'll require an explicit flag

  console.log(chalk.red('This action requires manual confirmation.'));
  console.log(chalk.dim(`To reset, delete the ${DATA_DIR_NAME}${path.posix.sep} directory manually.`));
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
  console.log(chalk.blue.bold('📋 Agent Blame Configuration'));
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
  console.log(`  Data Directory: ${chalk.dim(`${DATA_DIR_NAME}${path.posix.sep}`)}`);

  if (!isInitialized) {
    console.log();
    console.log(chalk.yellow('Run "agent-blame config --init" to initialize.'));
  }
}
