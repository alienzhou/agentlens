import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentType } from '@vibe-x/agentlens-core';
import { AGENT_CONFIGS } from '@vibe-x/agentlens-core';
import type { HookCore } from '../core/hook-core.js';
import type {
  AgentAdapterConfig,
  AgentDetectionResult,
  ParsedSession,
} from './adapter-interface.js';
import { BaseAgentAdapter } from './adapter-interface.js';

const execAsync = promisify(exec);

/**
 * Agent Lens identifier in configuration
 */
const AGENT_LENS_HOOK_MARKER = 'agentlens hook';

/**
 * Cursor adapter for integrating with Cursor AI IDE
 *
 * Uses Cursor native hooks configuration: ~/.cursor/hooks.json
 * Reference: https://cursor.com/cn/docs/agent/hooks
 *
 * Configuration format:
 * {
 *   "version": 1,
 *   "hooks": {
 *     "afterFileEdit": [{ "command": "..." }],
 *     "sessionStart": [{ "command": "..." }],
 *     "sessionEnd": [{ "command": "..." }]
 *   }
 * }
 */
export class CursorAdapter extends BaseAgentAdapter {
  readonly agentType: AgentType = 'cursor';
  readonly config: AgentAdapterConfig;

  constructor() {
    super();
    const cursorConfig = AGENT_CONFIGS.cursor;
    this.config = {
      name: cursorConfig.name,
      configDir: cursorConfig.configDir,
      configFile: 'hooks.json', // Use Cursor native hooks config file
      hooks: { ...cursorConfig.hooks },
    };
  }

  async detect(): Promise<AgentDetectionResult> {
    let directoryExists = false;
    let whichExists = false;
    let cursorPath: string | undefined;

    // Check config directory
    try {
      await fs.access(this.getConfigDirPath());
      directoryExists = true;
    } catch {
      // Directory doesn't exist
    }

    // Check 'which cursor' command
    try {
      const { stdout } = await execAsync('which cursor');
      if (stdout.trim()) {
        whichExists = true;
        cursorPath = stdout.trim();
      }
    } catch {
      // Command not found
    }

    if (directoryExists && whichExists) {
      return {
        detected: true,
        method: 'both',
        path: cursorPath,
      };
    } else if (directoryExists) {
      return {
        detected: true,
        method: 'directory',
        path: this.getConfigDirPath(),
      };
    } else if (whichExists) {
      return {
        detected: true,
        method: 'which',
        path: cursorPath,
      };
    }

    return {
      detected: false,
      method: 'none',
    };
  }

  async isConnected(): Promise<boolean> {
    try {
      const configPath = this.getConfigFilePath();
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as CursorHooksConfig;

      // Check if agent-lens hook config exists
      if (Object.keys(config.hooks).length === 0) {
        return false;
      }

      // Check if any hook event contains agent-lens command
      const hookEvents = ['afterFileEdit', 'sessionStart', 'sessionEnd', 'postToolUse'] as const;
      for (const eventName of hookEvents) {
        const eventHooks = config.hooks[eventName];
        if (Array.isArray(eventHooks)) {
          for (const hook of eventHooks) {
            if (hook.command && hook.command.includes(AGENT_LENS_HOOK_MARKER)) {
              return true;
            }
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async connect(hookCore: HookCore): Promise<void> {
    const configDir = this.getConfigDirPath();
    const configPath = this.getConfigFilePath();

    // Ensure config directory exists
    await fs.mkdir(configDir, { recursive: true });

    // Read existing config or create new one
    let config: CursorHooksConfig = { version: 1, hooks: {} };

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(content) as Partial<CursorHooksConfig>;
      config = {
        version: parsedConfig.version ?? 1,
        hooks: parsedConfig.hooks ?? {},
      };
    } catch {
      // File doesn't exist, use default
    }

    // Add postToolUse hook (file change capture, corresponds to Claude Code's PostToolUse)
    config.hooks.postToolUse = this.mergeHooks(
      config.hooks.postToolUse,
      {
        command: 'agentlens hook posttooluse --agent cursor',
        matcher: 'Write', // In Cursor, Edit maps to Write
      }
    );

    // Add afterFileEdit hook (after file edit)
    config.hooks.afterFileEdit = this.mergeHooks(
      config.hooks.afterFileEdit,
      {
        command: 'agentlens hook afterfileedit --agent cursor',
      }
    );

    // Add sessionStart hook (session start)
    config.hooks.sessionStart = this.mergeHooks(
      config.hooks.sessionStart,
      {
        command: 'agentlens hook sessionstart --agent cursor',
      }
    );

    // Add sessionEnd hook (session end)
    config.hooks.sessionEnd = this.mergeHooks(
      config.hooks.sessionEnd,
      {
        command: 'agentlens hook sessionend --agent cursor',
      }
    );

    // Write config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log(`Cursor adapter connected. HookCore has ${String(hookCore.getActiveSessions().length)} active sessions.`);
  }

  async disconnect(): Promise<void> {
    const configPath = this.getConfigFilePath();

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as CursorHooksConfig;

      // Remove hooks containing agent-lens command
      const hookEvents = ['afterFileEdit', 'sessionStart', 'sessionEnd', 'postToolUse'] as const;
      if (Object.keys(config.hooks).length > 0) {
        for (const eventName of hookEvents) {
          const eventHooks = config.hooks[eventName];
          if (Array.isArray(eventHooks)) {
            const filteredHooks = eventHooks.filter(
              (hook) => !(hook.command && hook.command.includes(AGENT_LENS_HOOK_MARKER))
            );
            if (filteredHooks.length === 0) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete config.hooks[eventName];
            } else {
              config.hooks[eventName] = filteredHooks;
            }
          }
        }
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch {
      // Config file doesn't exist or is invalid
    }
  }

  getSessionFilePath(): string | null {
    // Possible locations for Cursor session files
    const possiblePaths = [
      path.join(this.getConfigDirPath(), 'projects'),
      path.join(this.getConfigDirPath(), 'User', 'globalStorage', 'sessions'),
    ];
    return possiblePaths[0] ?? null;
  }

  parseSessionFile(content: string): ParsedSession | null {
    try {
      const data = JSON.parse(content) as CursorSessionData;

      return {
        sessionId: data.id ?? `session_${String(Date.now())}`,
        conversations: (data.conversations ?? []).map((conv, index) => ({
          index: index + 1,
          userMessage: conv.user ?? '',
          agentResponse: conv.assistant ?? '',
          timestamp: conv.timestamp ?? Date.now(),
        })),
        todos: (data.todos ?? []).map((todo) => ({
          id: todo.id ?? `todo_${String(Date.now())}`,
          content: todo.content ?? '',
          status: todo.status ?? 'pending',
          createdAt: todo.createdAt ?? Date.now(),
        })),
        toolCalls: (data.toolCalls ?? []).map((call) => ({
          tool: call.tool ?? 'unknown',
          arguments: call.arguments ?? {},
          result: call.result,
          timestamp: call.timestamp ?? Date.now(),
          filePath: call.filePath,
        })),
        startedAt: data.startedAt ?? Date.now(),
        endedAt: data.endedAt,
      };
    } catch {
      return null;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Merge hooks to avoid duplicate additions
   */
  private mergeHooks(
    existing: CursorHookEntry[] | undefined,
    newHook: CursorHookEntry
  ): CursorHookEntry[] {
    const hooks = existing ?? [];

    // Check if agent-lens hook already exists
    const existingIndex = hooks.findIndex(
      (h) => h.command && h.command.includes(AGENT_LENS_HOOK_MARKER)
    );

    if (existingIndex >= 0) {
      // Update existing hook
      hooks[existingIndex] = newHook;
    } else {
      // Add new hook
      hooks.push(newHook);
    }

    return hooks;
  }
}

// ==================== Type Definitions ====================

/**
 * Cursor hooks.json configuration structure
 * Reference: https://cursor.com/cn/docs/agent/hooks
 */
interface CursorHooksConfig {
  version: number;
  hooks: {
    sessionStart?: CursorHookEntry[];
    sessionEnd?: CursorHookEntry[];
    preToolUse?: CursorHookEntry[];
    postToolUse?: CursorHookEntry[];
    afterFileEdit?: CursorHookEntry[];
    beforeShellExecution?: CursorHookEntry[];
    afterShellExecution?: CursorHookEntry[];
    stop?: CursorHookEntry[];
    [key: string]: CursorHookEntry[] | undefined;
  };
}

/**
 * Cursor hook entry
 */
interface CursorHookEntry {
  /** Command to execute */
  command: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Matcher (regex pattern) */
  matcher?: string;
}

/**
 * Cursor session data structure
 */
interface CursorSessionData {
  id?: string;
  conversations?: Array<{
    user?: string;
    assistant?: string;
    timestamp?: number;
  }>;
  todos?: Array<{
    id?: string;
    content?: string;
    status?: 'pending' | 'in_progress' | 'completed';
    createdAt?: number;
  }>;
  toolCalls?: Array<{
    tool?: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
    timestamp?: number;
    filePath?: string;
  }>;
  startedAt?: number;
  endedAt?: number;
}
