import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { diffLines } from 'diff';
import { SUPPORTED_AGENTS, AGENT_CONFIGS, FileStorage } from '@agent-blame/core';
import { CursorAdapter, ClaudeAdapter } from '@vibe-x/agent-blame';
import type { AgentAdapter } from '@vibe-x/agent-blame';
import { getHookCore } from '@vibe-x/agent-blame';
import type {
  ClaudePostToolUseInput,
  ClaudeSessionStartInput,
  ClaudeSessionEndInput,
} from '@vibe-x/agent-blame';

// ==================== Cursor Hook Type Definitions ====================

/**
 * Cursor Hook common input fields
 * Reference: https://cursor.com/cn/docs/agent/hooks
 */
interface CursorHookInputBase {
  conversation_id: string;
  generation_id: string;
  model: string;
  hook_event_name: string;
  cursor_version: string;
  workspace_roots: string[];
  user_email?: string | null;
  transcript_path?: string | null;
}

/**
 * Cursor afterFileEdit input
 */
interface CursorAfterFileEditInput extends Partial<CursorHookInputBase> {
  file_path: string;
  edits?: Array<{
    old_string?: string;
    new_string?: string;
  }>;
}

/**
 * Cursor sessionStart input
 */
interface CursorSessionStartInput extends Partial<CursorHookInputBase> {
  session_id?: string;
  is_background_agent?: boolean;
  composer_mode?: 'agent' | 'ask' | 'edit';
}

/**
 * Cursor sessionEnd input
 */
interface CursorSessionEndInput extends Partial<CursorHookInputBase> {
  session_id?: string;
  reason?: 'completed' | 'aborted' | 'error' | 'window_close' | 'user_close';
  duration_ms?: number;
  is_background_agent?: boolean;
  final_status?: string;
  error_message?: string;
}

/**
 * Cursor stop input
 */
interface CursorStopInput extends Partial<CursorHookInputBase> {
  status: 'completed' | 'aborted' | 'error';
  loop_count?: number;
}

/**
 * hook command - Manage Agent hooks
 */
export const hookCommand = new Command('hook').description('Manage AI Agent hooks for data collection');

// ==================== User Commands ====================

/**
 * hook connect - Connect to an Agent
 */
hookCommand
  .command('connect <agent>')
  .description('Connect Agent Blame to an AI Agent')
  .action(async (agent: string) => {
    try {
      await connectAgent(agent);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * hook disconnect - Disconnect from an Agent
 */
hookCommand
  .command('disconnect <agent>')
  .description('Disconnect Agent Blame from an AI Agent')
  .action(async (agent: string) => {
    try {
      await disconnectAgent(agent);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * hook status - Show connection status
 */
hookCommand
  .command('status')
  .description('Show Agent connection status')
  .action(async () => {
    try {
      await showStatus();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * hook list - List supported Agents
 */
hookCommand
  .command('list')
  .description('List supported AI Agents')
  .action(() => {
    console.log(chalk.blue.bold('Supported AI Agents'));
    console.log(chalk.dim('-'.repeat(50)));
    console.log();

    for (const agent of SUPPORTED_AGENTS) {
      const config = AGENT_CONFIGS[agent];
      console.log(chalk.cyan(`  ${config.name}`));
      console.log(chalk.dim(`    ID: ${agent}`));
      console.log(chalk.dim(`    Config: ~/${config.configDir}/${config.configFile}`));
      console.log();
    }
  });

// ==================== Claude Code Hook Event Handlers (Internal Commands) ====================

/**
 * hook posttooluse - Handle PostToolUse hook event from Claude Code
 * Triggered when Claude Code executes Edit/Write/MultiEdit tools
 */
hookCommand
  .command('posttooluse')
  .description('Handle PostToolUse hook event (internal, called by Claude Code)')
  .option('--agent <agent>', 'Agent type', 'claude-code')
  .action(async (options: { agent: string }) => {
    try {
      const input = await readStdinJson<ClaudePostToolUseInput>();
      await handlePostToolUse(input, options.agent);
      process.exit(0);
    } catch (error) {
      // Error output to stderr, Claude Code will see it
      console.error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * hook sessionstart - Handle SessionStart hook event
 * Supports both Claude Code and Cursor
 */
hookCommand
  .command('sessionstart')
  .description('Handle SessionStart hook event (internal)')
  .option('--agent <agent>', 'Agent type', 'claude-code')
  .action(async (options: { agent: string }) => {
    try {
      if (options.agent === 'cursor') {
        const input = await readStdinJson<CursorSessionStartInput>();
        await handleCursorSessionStart(input, options.agent);
      } else {
        const input = await readStdinJson<ClaudeSessionStartInput>();
        await handleSessionStart(input, options.agent);
      }
      process.exit(0);
    } catch (error) {
      console.error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * hook sessionend - Handle SessionEnd hook event
 * Supports both Claude Code and Cursor
 */
hookCommand
  .command('sessionend')
  .description('Handle SessionEnd hook event (internal)')
  .option('--agent <agent>', 'Agent type', 'claude-code')
  .action(async (options: { agent: string }) => {
    try {
      if (options.agent === 'cursor') {
        const input = await readStdinJson<CursorSessionEndInput>();
        await handleCursorSessionEnd(input, options.agent);
      } else {
        const input = await readStdinJson<ClaudeSessionEndInput>();
        await handleSessionEnd(input, options.agent);
      }
      process.exit(0);
    } catch (error) {
      console.error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ==================== Cursor Hook Event Handlers ====================

/**
 * hook afterfileedit - Handle afterFileEdit hook event from Cursor
 * Triggered when Cursor Agent edits a file
 */
hookCommand
  .command('afterfileedit')
  .description('Handle afterFileEdit hook event (called by Cursor)')
  .option('--agent <agent>', 'Agent type', 'cursor')
  .action(async (options: { agent: string }) => {
    try {
      const input = await readStdinJson<CursorAfterFileEditInput>();
      await handleCursorAfterFileEdit(input, options.agent);
      process.exit(0);
    } catch (error) {
      console.error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * hook stop - Handle stop hook event from Cursor
 */
hookCommand
  .command('stop')
  .description('Handle stop hook event (called by Cursor)')
  .option('--agent <agent>', 'Agent type', 'cursor')
  .action(async (options: { agent: string }) => {
    try {
      const input = await readStdinJson<CursorStopInput>();
      await handleCursorStop(input, options.agent);
      process.exit(0);
    } catch (error) {
      console.error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ==================== Utility Functions ====================

/**
 * Read JSON data from stdin
 */
async function readStdinJson<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    // If stdin is TTY (terminal), no piped input
    if (process.stdin.isTTY) {
      reject(new Error('No input received from stdin. This command should be called by Claude Code hook system.'));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    let data = '';

    rl.on('line', (line) => {
      data += line;
    });

    rl.on('close', () => {
      if (!data.trim()) {
        reject(new Error('Empty input received from stdin'));
        return;
      }

      try {
        const parsed = JSON.parse(data) as T;
        resolve(parsed);
      } catch {
        reject(new Error(`Invalid JSON input: ${data.substring(0, 100)}...`));
      }
    });

    rl.on('error', (err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      reject(new Error(`Failed to read stdin: ${errorMessage}`));
    });

    // Set timeout to avoid infinite waiting
    setTimeout(() => {
      rl.close();
      if (!data.trim()) {
        reject(new Error('Timeout waiting for stdin input'));
      }
    }, 5000);
  });
}

function getAdapter(agent: string): AgentAdapter | null {
  switch (agent.toLowerCase()) {
    case 'cursor':
    case 'cursor-cli':
      return new CursorAdapter();
    case 'claude':
    case 'claude-code':
      return new ClaudeAdapter();
    default:
      return null;
  }
}

// ==================== User Command Implementations ====================

async function connectAgent(agent: string): Promise<void> {
  const adapter = getAdapter(agent);

  if (!adapter) {
    console.log(chalk.red(`Unknown agent: ${agent}`));
    console.log(chalk.dim('Supported agents: ' + SUPPORTED_AGENTS.join(', ')));
    return;
  }

  console.log(chalk.blue(`Connecting to ${adapter.config.name}...`));

  // Detect if Agent is installed
  const detection = await adapter.detect();

  if (!detection.detected) {
    console.log(chalk.yellow(`${adapter.config.name} not detected on this system.`));
    console.log(chalk.dim('Creating configuration directory anyway...'));
  } else {
    console.log(chalk.green(`[OK] ${adapter.config.name} detected (${detection.method})`));
    if (detection.path) {
      console.log(chalk.dim(`  Path: ${detection.path}`));
    }
  }

  // Check if already connected
  const isConnected = await adapter.isConnected();
  if (isConnected) {
    console.log(chalk.yellow(`Already connected to ${adapter.config.name}.`));
    return;
  }

  // Connect
  const hookCore = getHookCore();
  await adapter.connect(hookCore);

  console.log(chalk.green(`[OK] Connected to ${adapter.config.name}`));
  console.log(chalk.dim(`  Hook config written to ~/${adapter.config.configDir}/${adapter.config.configFile}`));
}

async function disconnectAgent(agent: string): Promise<void> {
  const adapter = getAdapter(agent);

  if (!adapter) {
    console.log(chalk.red(`Unknown agent: ${agent}`));
    return;
  }

  console.log(chalk.blue(`Disconnecting from ${adapter.config.name}...`));

  const isConnected = await adapter.isConnected();
  if (!isConnected) {
    console.log(chalk.yellow(`Not connected to ${adapter.config.name}.`));
    return;
  }

  await adapter.disconnect();

  console.log(chalk.green(`[OK] Disconnected from ${adapter.config.name}`));
}

async function showStatus(): Promise<void> {
  console.log(chalk.blue.bold('Agent Connection Status'));
  console.log(chalk.dim('-'.repeat(50)));
  console.log();

  const adapters: AgentAdapter[] = [new CursorAdapter(), new ClaudeAdapter()];

  for (const adapter of adapters) {
    const detection = await adapter.detect();
    const isConnected = await adapter.isConnected();

    let statusIcon: string;
    let statusText: string;

    if (isConnected) {
      statusIcon = '[*]';
      statusText = chalk.green('Connected');
    } else if (detection.detected) {
      statusIcon = '[~]';
      statusText = chalk.yellow('Detected (not connected)');
    } else {
      statusIcon = '[ ]';
      statusText = chalk.dim('Not detected');
    }

    console.log(`${statusIcon} ${chalk.cyan(adapter.config.name)}`);
    console.log(chalk.dim(`   Status: ${statusText}`));

    if (detection.detected && detection.path) {
      console.log(chalk.dim(`   Path: ${detection.path}`));
    }

    console.log();
  }
}

// ==================== Claude Code Hook Handler Implementations ====================

/**
 * Handle PostToolUse event (after file edit)
 */
async function handlePostToolUse(input: ClaudePostToolUseInput, agent: string): Promise<void> {
  const hookCore = getHookCore();
  const storage = new FileStorage(input.cwd);

  // Extract file path
  const filePath = input.tool_input.file_path ?? input.tool_response.filePath;

  if (!filePath) {
    // No file path, skip
    return;
  }

  const absolutePath = getAbsolutePath(filePath, input.cwd);
  const newContent = input.tool_input.new_string ?? input.tool_input.content ?? '';
  
  // For Write tool, old_string is not provided, so we need to read the old content from file
  // Note: This is called AFTER the tool execution, so the file already contains new content
  // We can only get oldContent for Edit tool which provides old_string
  let oldContent = input.tool_input.old_string ?? '';
  
  // For Write tool (content provided but no old_string), the file was overwritten
  // We cannot recover the old content after the fact, so we leave oldContent empty
  // This means Write tool creates will show all lines as "added"
  // This is a known limitation - only true "edits" can accurately track changes
  
  const { addedLines, removedLines } = calculateLineChanges(oldContent, newContent);

  // Record code change event
  hookCore.onCodeChange(
    input.session_id,
    filePath,
    absolutePath,
    newContent,
    addedLines,
    removedLines,
    oldContent
  );

  // Store to local
  await storage.appendCodeChange({
    sessionId: input.session_id,
    agent,
    timestamp: Date.now(),
    toolName: input.tool_name,
    filePath,
    oldContent: input.tool_input.old_string,
    newContent: input.tool_input.new_string ?? input.tool_input.content,
    success: input.tool_response.success ?? true,
  });
}

/**
 * Handle SessionStart event
 */
async function handleSessionStart(input: ClaudeSessionStartInput, agent: string): Promise<void> {
  const hookCore = getHookCore();
  const storage = new FileStorage(input.cwd);

  // Record session start
  hookCore.onSessionStart(agent as 'cursor' | 'claude-code', input.session_id);

  // Store session info
  await storage.saveHookSession({
    sessionId: input.session_id,
    agent,
    startedAt: Date.now(),
    source: input.source,
    model: input.model,
    transcriptPath: input.transcript_path,
    cwd: input.cwd,
  });
}

/**
 * Handle SessionEnd event
 */
async function handleSessionEnd(input: ClaudeSessionEndInput, _agent: string): Promise<void> {
  const hookCore = getHookCore();
  const storage = new FileStorage(input.cwd);

  // Record session end
  hookCore.onSessionEnd(input.session_id);

  // Update session status
  await storage.updateHookSession(input.session_id, {
    endedAt: Date.now(),
    endReason: input.reason,
  });
}

// ==================== Cursor Hook Handler Implementations ====================

/**
 * Handle Cursor afterFileEdit event
 */
async function handleCursorAfterFileEdit(input: CursorAfterFileEditInput, agent: string): Promise<void> {
  const hookCore = getHookCore();

  // Get working directory (Cursor common field)
  const workspaceRoots = (input as CursorHookInputBase).workspace_roots;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const cwd = (workspaceRoots && workspaceRoots.length > 0 && workspaceRoots[0]) || process.cwd();
  const storage = new FileStorage(cwd);

  // Record code change event
  const conversationId = input.conversation_id;
  const sessionId = conversationId ?? `cursor_${String(Date.now())}`;
  const absolutePath = getAbsolutePath(input.file_path, cwd);

  for (const edit of input.edits ?? []) {
    const oldContent = edit.old_string ?? '';
    const newContent = edit.new_string ?? '';
    const { addedLines, removedLines } = calculateLineChanges(oldContent, newContent);

    hookCore.onCodeChange(
      sessionId,
      input.file_path,
      absolutePath,
      newContent,
      addedLines,
      removedLines,
      oldContent
    );

    // Store to local
    await storage.appendCodeChange({
      sessionId,
      agent,
      timestamp: Date.now(),
      toolName: 'afterFileEdit',
      filePath: input.file_path,
      oldContent: edit.old_string,
      newContent: edit.new_string,
      success: true,
    });
  }
}

/**
 * Handle Cursor sessionStart event
 */
async function handleCursorSessionStart(input: CursorSessionStartInput, agent: string): Promise<void> {
  const hookCore = getHookCore();

  const cwd = input.workspace_roots?.[0] ?? process.cwd();
  const storage = new FileStorage(cwd);

  // Record session start
  const sessionId = input.session_id ?? input.conversation_id ?? `cursor_${String(Date.now())}`;
  hookCore.onSessionStart(agent as 'cursor' | 'claude-code', sessionId);

  // Store session info
  await storage.saveHookSession({
    sessionId,
    agent,
    startedAt: Date.now(),
    source: 'startup',
    model: input.model,
    cwd,
  });
}

/**
 * Handle Cursor sessionEnd event
 */
async function handleCursorSessionEnd(input: CursorSessionEndInput, _agent: string): Promise<void> {
  const hookCore = getHookCore();

  const cwd = input.workspace_roots?.[0] ?? process.cwd();
  const storage = new FileStorage(cwd);

  const sessionId = input.session_id ?? input.conversation_id;
  if (!sessionId) {
    return; // No session ID, skip
  }

  // Record session end
  hookCore.onSessionEnd(sessionId);

  // Update session status
  await storage.updateHookSession(sessionId, {
    endedAt: Date.now(),
    endReason: input.reason,
  });
}

/**
 * Handle Cursor stop event
 */
async function handleCursorStop(input: CursorStopInput, _agent: string): Promise<void> {
  const hookCore = getHookCore();

  const cwd = input.workspace_roots?.[0] ?? process.cwd();
  const storage = new FileStorage(cwd);

  const sessionId = input.conversation_id ?? `cursor_${String(Date.now())}`;

  // If status is error or aborted, record session end
  if (input.status === 'error' || input.status === 'aborted') {
    hookCore.onSessionEnd(sessionId);

    await storage.updateHookSession(sessionId, {
      endedAt: Date.now(),
      endReason: input.status,
    });
  }
}

// ==================== Helper Functions ====================

/**
 * Calculate added and removed lines using diff algorithm
 * Uses jsdiff library for accurate line-by-line comparison
 * 
 * Handles edge cases:
 * - Empty content
 * - Different line endings (\n, \r\n, \r)
 * - Trailing newlines
 * - Preserves empty lines that are meaningful (not just trailing)
 */
function calculateLineChanges(oldContent: string, newContent: string): {
  addedLines: string[];
  removedLines: string[];
} {
  if (!oldContent && !newContent) {
    return { addedLines: [], removedLines: [] };
  }

  const changes = diffLines(oldContent || '', newContent || '');
  const addedLines: string[] = [];
  const removedLines: string[] = [];

  for (const change of changes) {
    if (change.added) {
      // Split by newline, preserving all lines including empty ones
      const lines = change.value.split(/\r?\n/);
      // Remove trailing empty line if content doesn't end with newline
      // (split always creates an extra empty element when content ends with newline)
      if (lines.length > 0 && lines[lines.length - 1] === '' && !change.value.endsWith('\n') && !change.value.endsWith('\r\n')) {
        lines.pop();
      }
      // Filter out only truly empty trailing lines, preserve meaningful empty lines
      addedLines.push(...lines);
    } else if (change.removed) {
      const lines = change.value.split(/\r?\n/);
      // Same handling for removed lines
      if (lines.length > 0 && lines[lines.length - 1] === '' && !change.value.endsWith('\n') && !change.value.endsWith('\r\n')) {
        lines.pop();
      }
      removedLines.push(...lines);
    }
  }

  return { addedLines, removedLines };
}

/**
 * Calculate absolute path from relative path and cwd
 * Handles edge cases like already absolute paths, empty paths, etc.
 */
function getAbsolutePath(filePath: string, cwd: string): string {
  if (!filePath) {
    return cwd;
  }
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  return path.normalize(path.join(cwd, filePath));
}
