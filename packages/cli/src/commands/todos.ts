import { Command } from 'commander';
import chalk from 'chalk';
import { FileStorage, type Todo } from '@vibe-x/agentlens-core';

/**
 * todos command - Manage TODO items
 */
export const todosCommand = new Command('todos')
  .description('Manage TODO items from Agent sessions')
  .option('-l, --list', 'List all TODOs', true)
  .option('-s, --status <status>', 'Filter by status: pending, in_progress, completed')
  .option('--session <id>', 'Filter by session ID')
  .option('-f, --format <format>', 'Output format: terminal, json', 'terminal')
  .action(async (options: TodosOptions) => {
    try {
      await executeTodos(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

interface TodosOptions {
  list: boolean;
  status?: 'pending' | 'in_progress' | 'completed';
  session?: string;
  format: 'terminal' | 'json';
}

async function executeTodos(options: TodosOptions): Promise<void> {
  const cwd = process.cwd();
  const storage = new FileStorage(cwd);

  // Check if initialized
  const isInitialized = await storage.isInitialized();
  if (!isInitialized) {
    console.log(chalk.yellow('Agent Lens not initialized in this project.'));
    console.log(chalk.dim('Run "agent-lens config --init" to initialize.'));
    return;
  }

  // Get todos
  let todos: Todo[];

  if (options.status) {
    todos = await storage.listTodosByStatus(options.status);
  } else {
    todos = await storage.listTodos();
  }

  // Filter by session if specified
  if (options.session) {
    const sessionFilter = options.session;
    todos = todos.filter((todo) => todo.sessionSource.sessionId.includes(sessionFilter));
  }

  // Sort by creation date (newest first)
  todos.sort((a, b) => b.createdAt - a.createdAt);

  // Output based on format
  if (options.format === 'json') {
    console.log(JSON.stringify(todos, null, 2));
    return;
  }

  // Terminal format
  console.log(chalk.blue.bold('📋 Agent Lens - TODOs'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log();

  if (todos.length === 0) {
    console.log(chalk.yellow('No TODOs found.'));
    if (options.status) {
      console.log(chalk.dim(`Filtered by status: ${options.status}`));
    }
    return;
  }

  // Group by status
  const pending = todos.filter((t) => t.status === 'pending');
  const inProgress = todos.filter((t) => t.status === 'in_progress');
  const completed = todos.filter((t) => t.status === 'completed');

  // Display stats
  console.log(
    chalk.yellow(`⏳ Pending: ${String(pending.length)}`) +
      chalk.dim(' | ') +
      chalk.blue(`🔄 In Progress: ${String(inProgress.length)}`) +
      chalk.dim(' | ') +
      chalk.green(`✅ Completed: ${String(completed.length)}`)
  );
  console.log();

  // Display each todo
  const displayTodo = (todo: Todo, index: number) => {
    const statusIcon = getStatusIcon(todo.status);
    const priorityColor = getPriorityColor(todo.priority);

    console.log(chalk.white.bold(`${String(index + 1)}. ${statusIcon} ${todo.content}`));
    console.log(
      chalk.dim('   ') +
        priorityColor(`[${todo.priority}]`) +
        chalk.dim(' | ') +
        chalk.dim(`Agent: ${todo.sessionSource.agent}`) +
        chalk.dim(' | ') +
        chalk.dim(`Session: ${todo.sessionSource.sessionId.substring(0, 8)}...`)
    );

    if (todo.description) {
      console.log(chalk.dim(`   ${todo.description}`));
    }

    console.log();
  };

  // Show by section
  if (inProgress.length > 0 && !options.status) {
    console.log(chalk.blue.bold('🔄 In Progress'));
    console.log(chalk.dim('─'.repeat(30)));
    inProgress.forEach((todo, i) => { displayTodo(todo, i); });
  }

  if (pending.length > 0 && !options.status) {
    console.log(chalk.yellow.bold('⏳ Pending'));
    console.log(chalk.dim('─'.repeat(30)));
    pending.forEach((todo, i) => { displayTodo(todo, i); });
  }

  if (completed.length > 0 && !options.status) {
    console.log(chalk.green.bold('✅ Completed'));
    console.log(chalk.dim('─'.repeat(30)));
    completed.forEach((todo, i) => { displayTodo(todo, i); });
  }

  // If filtering by status, just show the filtered list
  if (options.status) {
    todos.forEach((todo, i) => { displayTodo(todo, i); });
  }
}

function getStatusIcon(status: Todo['status']): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'in_progress':
      return '🔄';
    case 'completed':
      return '✅';
  }
}

function getPriorityColor(priority: Todo['priority']) {
  switch (priority) {
    case 'high':
      return chalk.red;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.dim;
  }
}
