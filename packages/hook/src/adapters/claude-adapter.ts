import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentType } from '@agentlens/core';
import { AGENT_CONFIGS } from '@agentlens/core';
import type { HookCore } from '../core/hook-core.js';
import type {
  AgentAdapterConfig,
  AgentDetectionResult,
  ParsedSession,
} from './adapter-interface.js';
import { BaseAgentAdapter } from './adapter-interface.js';

const execAsync = promisify(exec);

/**
 * Agent Lens hook identifier registered in Claude Code
 */
const AGENT_LENS_HOOK_MARKER = 'agentlens hook';

/**
 * Claude Code adapter for integrating with Claude Code (Anthropic's CLI)
 * Based on official hooks documentation: https://docs.anthropic.com/en/docs/claude-code/hooks
 */
export class ClaudeAdapter extends BaseAgentAdapter {
  readonly agentType: AgentType = 'claude-code';
  readonly config: AgentAdapterConfig;

  constructor() {
    super();
    const claudeConfig = AGENT_CONFIGS['claude-code'];
    this.config = {
      name: claudeConfig.name,
      configDir: claudeConfig.configDir,
      configFile: claudeConfig.configFile,
      hooks: { ...claudeConfig.hooks },
    };
  }

  async detect(): Promise<AgentDetectionResult> {
    let directoryExists = false;
    let whichExists = false;
    let claudePath: string | undefined;

    // Check config directory
    try {
      await fs.access(this.getConfigDirPath());
      directoryExists = true;
    } catch {
      // Directory doesn't exist
    }

    // Check 'which claude' command
    try {
      const { stdout } = await execAsync('which claude');
      if (stdout.trim()) {
        whichExists = true;
        claudePath = stdout.trim();
      }
    } catch {
      // Command not found
    }

    if (directoryExists && whichExists) {
      return {
        detected: true,
        method: 'both',
        path: claudePath,
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
        path: claudePath,
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
      const config = JSON.parse(content) as ClaudeSettingsConfig;

      // Check if agent-lens hook config exists
      if (!config.hooks) return false;

      // Check if any hook event contains agent-lens command
      const hookEvents = ['PostToolUse', 'UserPromptSubmit', 'SessionStart', 'SessionEnd'] as const;
      for (const eventName of hookEvents) {
        const eventHooks = config.hooks[eventName];
        if (Array.isArray(eventHooks)) {
          for (const matcher of eventHooks) {
            if (Array.isArray(matcher.hooks)) {
              for (const hook of matcher.hooks) {
                if (hook.command && hook.command.includes(AGENT_LENS_HOOK_MARKER)) {
                  return true;
                }
              }
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
    let config: ClaudeSettingsConfig = {};

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content) as ClaudeSettingsConfig;
    } catch {
      // File doesn't exist, use default
    }

    // Initialize hooks object
    config.hooks = config.hooks ?? {};

    // Add PostToolUse hook (file change capture)
    config.hooks.PostToolUse = this.mergeHookMatchers(
      config.hooks.PostToolUse,
      this.createPostToolUseConfig()
    );

    // Add UserPromptSubmit hook (capture user prompts)
    config.hooks.UserPromptSubmit = this.mergeHookMatchers(
      config.hooks.UserPromptSubmit,
      this.createUserPromptSubmitConfig()
    );

    // Add SessionStart hook (session start)
    config.hooks.SessionStart = this.mergeHookMatchers(
      config.hooks.SessionStart,
      this.createSessionStartConfig()
    );

    // Add SessionEnd hook (session end)
    config.hooks.SessionEnd = this.mergeHookMatchers(
      config.hooks.SessionEnd,
      this.createSessionEndConfig()
    );

    // Write config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log(`Claude adapter connected. HookCore has ${String(hookCore.getActiveSessions().length)} active sessions.`);
  }

  async disconnect(): Promise<void> {
    const configPath = this.getConfigFilePath();

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as ClaudeSettingsConfig;

      if (config.hooks) {
        // Remove hooks containing agent-lens command
        const hookEvents = ['PostToolUse', 'UserPromptSubmit', 'SessionStart', 'SessionEnd'] as const;
        for (const eventName of hookEvents) {
          const eventHooks = config.hooks[eventName];
          if (Array.isArray(eventHooks)) {
            config.hooks[eventName] = eventHooks.filter((matcher) => {
              if (Array.isArray(matcher.hooks)) {
                matcher.hooks = matcher.hooks.filter(
                  (hook) => !(hook.command && hook.command.includes(AGENT_LENS_HOOK_MARKER))
                );
                return matcher.hooks.length > 0;
              }
              return true;
            });
            // If no hooks left for this event, delete the entire event
            const remainingHooks = config.hooks[eventName];
            if (remainingHooks.length === 0) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete config.hooks[eventName];
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

  /**
   * Merge hook matchers to avoid duplicate additions
   */
  private mergeHookMatchers(
    existing: ClaudeHookMatcher[] | undefined,
    newMatcher: ClaudeHookMatcher
  ): ClaudeHookMatcher[] {
    const matchers = existing ?? [];

    // Check if agent-lens hook with same matcher already exists
    const existingIndex = matchers.findIndex((m) => {
      if (m.matcher !== newMatcher.matcher) return false;
      if (!Array.isArray(m.hooks)) return false;
      return m.hooks.some(
        (h) => h.command && h.command.includes(AGENT_LENS_HOOK_MARKER)
      );
    });

    if (existingIndex >= 0) {
      // Update existing matcher
      matchers[existingIndex] = newMatcher;
    } else {
      // Add new matcher
      matchers.push(newMatcher);
    }

    return matchers;
  }

  /**
   * Create PostToolUse hook configuration
   * Captures usage of Edit, Write, MultiEdit tools
   */
  private createPostToolUseConfig(): ClaudeHookMatcher {
    return {
      matcher: 'Edit|Write|MultiEdit',
      hooks: [
        {
          type: 'command',
          command: 'agentlens hook posttooluse --agent claude-code',
        },
      ],
    };
  }

  /**
   * Create UserPromptSubmit hook configuration
   * Captures user prompts before Claude processes them
   */
  private createUserPromptSubmitConfig(): ClaudeHookMatcher {
    return {
      hooks: [
        {
          type: 'command',
          command: 'agentlens hook userpromptsubmit --agent claude-code',
        },
      ],
    };
  }

  /**
   * Create SessionStart hook configuration
   */
  private createSessionStartConfig(): ClaudeHookMatcher {
    return {
      hooks: [
        {
          type: 'command',
          command: 'agentlens hook sessionstart --agent claude-code',
        },
      ],
    };
  }

  /**
   * Create SessionEnd hook configuration
   */
  private createSessionEndConfig(): ClaudeHookMatcher {
    return {
      hooks: [
        {
          type: 'command',
          command: 'agentlens hook sessionend --agent claude-code',
        },
      ],
    };
  }

  getSessionFilePath(): string | null {
    // Claude Code stores sessions in .claude directory
    return path.join(this.getConfigDirPath(), 'projects');
  }

  parseSessionFile(content: string): ParsedSession | null {
    try {
      // Claude uses JSONL format for session files
      const lines = content.trim().split('\n');
      const messages: ClaudeMessage[] = [];

      for (const line of lines) {
        if (line.trim()) {
          messages.push(JSON.parse(line) as ClaudeMessage);
        }
      }

      // Extract conversations from messages
      const conversations: ParsedSession['conversations'] = [];
      let currentUserMessage = '';
      let conversationIndex = 0;

      for (const msg of messages) {
        if (msg.type === 'user') {
          currentUserMessage = msg.content ?? '';
        } else if (msg.type === 'assistant' && currentUserMessage) {
          conversationIndex++;
          conversations.push({
            index: conversationIndex,
            userMessage: currentUserMessage,
            agentResponse: msg.content ?? '',
            timestamp: msg.timestamp ?? Date.now(),
          });
          currentUserMessage = '';
        }
      }

      // Extract todos from tool calls
      const todos: ParsedSession['todos'] = [];
      const toolCalls: ParsedSession['toolCalls'] = [];

      for (const msg of messages) {
        if (msg.type === 'tool_use') {
          toolCalls.push({
            tool: msg.tool ?? 'unknown',
            arguments: msg.arguments ?? {},
            result: msg.result,
            timestamp: msg.timestamp ?? Date.now(),
            filePath: msg.filePath,
          });

          // Check if this is a todo-related tool
          if (msg.tool === 'write_todo' || msg.tool === 'TodoWrite') {
            const todoArgs = msg.arguments as { id?: string; content?: string; status?: string } | undefined;
            if (todoArgs?.content) {
              const statusValue = todoArgs.status;
              todos.push({
                id: todoArgs.id ?? `todo_${String(todos.length + 1)}`,
                content: todoArgs.content,
                status: (statusValue ?? 'pending') as 'pending' | 'in_progress' | 'completed',
                createdAt: msg.timestamp ?? Date.now(),
              });
            }
          }
        }
      }

      return {
        sessionId: `claude_${String(Date.now())}`,
        conversations,
        todos,
        toolCalls,
        startedAt: messages[0]?.timestamp ?? Date.now(),
        endedAt: messages[messages.length - 1]?.timestamp,
      };
    } catch {
      return null;
    }
  }
}

// ==================== Type Definitions ====================

/**
 * Claude Code settings.json configuration structure
 * Reference: https://docs.anthropic.com/en/docs/claude-code/hooks
 */
interface ClaudeSettingsConfig {
  hooks?: {
    PreToolUse?: ClaudeHookMatcher[];
    PostToolUse?: ClaudeHookMatcher[];
    UserPromptSubmit?: ClaudeHookMatcher[];
    SessionStart?: ClaudeHookMatcher[];
    SessionEnd?: ClaudeHookMatcher[];
    Stop?: ClaudeHookMatcher[];
    Notification?: ClaudeHookMatcher[];
    [key: string]: ClaudeHookMatcher[] | undefined;
  };
  [key: string]: unknown;
}

/**
 * Hook matcher configuration
 */
interface ClaudeHookMatcher {
  /** Tool name matcher (supports regex), e.g. "Edit|Write|MultiEdit" */
  matcher?: string;
  /** List of hooks to execute */
  hooks: ClaudeHookCommand[];
}

/**
 * Hook command configuration
 */
interface ClaudeHookCommand {
  /** Hook type, currently only "command" is supported */
  type: 'command';
  /** Command to execute */
  command: string;
  /** Timeout in seconds */
  timeout?: number;
}

/**
 * Claude Code session message structure (parsed from JSONL file)
 */
interface ClaudeMessage {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  timestamp?: number;
  filePath?: string;
}

// ==================== Hook Input Types (received from stdin) ====================

/**
 * Claude Code Hook common input fields
 */
export interface ClaudeHookInputBase {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';
  hook_event_name: string;
}

/**
 * PostToolUse Hook input
 */
export interface ClaudePostToolUseInput extends ClaudeHookInputBase {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: {
    file_path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    command?: string;
    [key: string]: unknown;
  };
  tool_response: {
    filePath?: string;
    success?: boolean;
    [key: string]: unknown;
  };
  tool_use_id: string;
}

/**
 * SessionStart Hook input
 */
export interface ClaudeSessionStartInput extends ClaudeHookInputBase {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
  model?: string;
  agent_type?: string;
}

/**
 * SessionEnd Hook input
 */
export interface ClaudeSessionEndInput extends ClaudeHookInputBase {
  hook_event_name: 'SessionEnd';
  reason: 'clear' | 'logout' | 'prompt_input_exit' | 'other';
}

/**
 * UserPromptSubmit Hook input
 */
export interface ClaudeUserPromptSubmitInput extends ClaudeHookInputBase {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

/**
 * Union type of all Claude Code Hook inputs
 */
export type ClaudeHookInput = ClaudePostToolUseInput | ClaudeUserPromptSubmitInput | ClaudeSessionStartInput | ClaudeSessionEndInput;
