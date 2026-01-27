#!/usr/bin/env node
/**
 * Vibe Review CLI - Entry point
 */
import { program } from 'commander';
import { diffCommand } from './commands/diff.js';
import { reviewCommand } from './commands/review.js';
import { todosCommand } from './commands/todos.js';
import { configCommand } from './commands/config.js';
import { hookCommand } from './commands/hook.js';

// Package version (would be read from package.json in production)
const VERSION = '0.1.0';

program
  .name('vibe-review')
  .description('Code Review tool redesigned for the Vibe Coding era')
  .version(VERSION);

// Register commands
program.addCommand(diffCommand);
program.addCommand(reviewCommand);
program.addCommand(todosCommand);
program.addCommand(configCommand);
program.addCommand(hookCommand);

// Parse arguments
program.parse();
