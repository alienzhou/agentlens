import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline';
import { SUPPORTED_AGENTS, AGENT_CONFIGS, FileStorage } from '@vibe-review/core';
import { CursorAdapter, ClaudeAdapter } from '@vibe-review/hook';
import type { AgentAdapter } from '@vibe-review/hook';
import { getHookCore } from '@vibe-review/hook';
import type {
  ClaudePostToolUseInput,
  ClaudeSessionStartInput,
  ClaudeSessionEndInput,
} from '@vibe-review/hook';

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
 * Cursor postToolUse input
 */
interface CursorPostToolUseInput extends Partial<CursorHookInputBase> {
  tool_name: string;
  tool_input?: {
    file_path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    command?: string;
    [key: string]: unknown;
  };
  tool_output?: string;
  tool_use_id?: string;
  cwd?: string;
  duration?: number;
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
  .description('Connect Vibe Review to an AI Agent')
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
  .description('Disconnect Vibe Review from an AI Agent')
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
      reject(new Error(`Failed to read stdin: ${err.message}`));
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

  // Record code change event
  hookCore.onCodeChange(
    agent as 'cursor' | 'claude-code',
    input.session_id,
    filePath,
    input.tool_input.old_string ?? '',
    input.tool_input.new_string ?? input.tool_input.content ?? '',
    calculateLines(input.tool_input.new_string ?? input.tool_input.content ?? ''),
    calculateLines(input.tool_input.old_string ?? '')
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
async function handleSessionEnd(input: ClaudeSessionEndInput, agent: string): Promise<void> {
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
  const cwd = (input as CursorHookInputBase).workspace_roots?.[0] ?? process.cwd();
  const storage = new FileStorage(cwd);

  // Record code change event
  const sessionId = (input as CursorHookInputBase).conversation_id ?? `cursor_${Date.now()}`;

  for (const edit of input.edits ?? []) {
    hookCore.onCodeChange(
      agent as 'cursor' | 'claude-code',
      sessionId,
      input.file_path,
      edit.old_string ?? '',
      edit.new_string ?? '',
      calculateLines(edit.new_string ?? ''),
      calculateLines(edit.old_string ?? '')
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
 * Handle Cursor postToolUse event (similar to Claude Code)
 */
async function handleCursorPostToolUse(input: CursorPostToolUseInput, agent: string): Promise<void> {
  const hookCore = getHookCore();

  const cwd = input.workspace_roots?.[0] ?? input.cwd ?? process.cwd();
  const storage = new FileStorage(cwd);

  // Extract file path
  const filePath = input.tool_input?.file_path;

  if (!filePath) {
    return;
  }

  const sessionId = input.conversation_id ?? `cursor_${Date.now()}`;

  // Record code change event
  hookCore.onCodeChange(
    agent as 'cursor' | 'claude-code',
    sessionId,
    filePath,
    input.tool_input?.old_string ?? '',
    input.tool_input?.new_string ?? input.tool_input?.content ?? '',
    calculateLines(input.tool_input?.new_string ?? input.tool_input?.content ?? ''),
      calculateLines(input.tool_input?.old_string ?? '')
    );

    // Store to local
    await storage.appendCodeChange({
    sessionId,
    agent,
    timestamp: Date.now(),
    toolName: input.tool_name,
    filePath,
    oldContent: input.tool_input?.old_string,
    newContent: input.tool_input?.new_string ?? input.tool_input?.content,
    success: true,
  });
}

/**
 * Handle Cursor sessionStart event
 */
async function handleCursorSessionStart(input: CursorSessionStartInput, agent: string): Promise<void> {
  const hookCore = getHookCore();

  const cwd = input.workspace_roots?.[0] ?? process.cwd();
  const storage = new FileStorage(cwd);

  // Record session start
  hookCore.onSessionStart(agent as 'cursor' | 'claude-code', input.session_id ?? input.conversation_id);

  // Store session info
  await storage.saveHookSession({
    sessionId: input.session_id ?? input.conversation_id,
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
async function handleCursorSessionEnd(input: CursorSessionEndInput, agent: string): Promise<void> {
  const hookCore = getHookCore();

  const cwd = input.workspace_roots?.[0] ?? process.cwd();
  const storage = new FileStorage(cwd);

  const sessionId = input.session_id ?? input.conversation_id;

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
async function handleCursorStop(input: CursorStopInput, agent: string): Promise<void> {
  const hookCore = getHookCore();

  const cwd = input.workspace_roots?.[0] ?? process.cwd();
  const storage = new FileStorage(cwd);

  const sessionId = input.conversation_id ?? `cursor_${Date.now()}`;

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
 * Calculate number of lines in text
 */
function calculateLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').length;
}
