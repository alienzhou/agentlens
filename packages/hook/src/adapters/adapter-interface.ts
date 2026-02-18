import * as path from 'node:path';
import type { AgentType } from '@vibe-x/agentlens-core';
import type { HookCore } from '../core/hook-core.js';

/**
 * Agent adapter configuration
 */
export interface AgentAdapterConfig {
  /** Agent name for display */
  name: string;

  /** Configuration directory (relative to home) */
  configDir: string;

  /** Configuration file name */
  configFile: string;

  /** Hook names for different events */
  hooks: {
    fileEdit: string;
    stop: string;
  };
}

/**
 * Agent adapter interface
 *
 * Each AI Agent platform (Cursor, Claude, etc.) needs an adapter
 * to integrate with the Hook system.
 */
export interface AgentAdapter {
  /** Agent type identifier */
  readonly agentType: AgentType;

  /** Agent configuration */
  readonly config: AgentAdapterConfig;

  /**
   * Detect if the Agent is installed on the system
   */
  detect(): Promise<AgentDetectionResult>;

  /**
   * Check if the Hook is connected (config written)
   */
  isConnected(): Promise<boolean>;

  /**
   * Connect the Hook to the Agent
   * Writes hook configuration to the Agent's config file
   */
  connect(hookCore: HookCore): Promise<void>;

  /**
   * Disconnect the Hook from the Agent
   * Removes hook configuration from the Agent's config file
   */
  disconnect(): Promise<void>;

  /**
   * Get the session file path for this Agent
   */
  getSessionFilePath(): string | null;

  /**
   * Parse a session file for this Agent
   */
  parseSessionFile?(content: string): ParsedSession | null;
}

/**
 * Agent detection result
 */
export interface AgentDetectionResult {
  /** Whether the Agent was detected */
  detected: boolean;

  /** Detection method used */
  method: 'directory' | 'which' | 'both' | 'none';

  /** Path to the Agent installation (if found) */
  path?: string;

  /** Agent version (if detectable) */
  version?: string;

  /** Error message (if detection failed) */
  error?: string;
}

/**
 * Parsed session data
 */
export interface ParsedSession {
  /** Session ID */
  sessionId: string;

  /** Conversation rounds */
  conversations: ParsedConversation[];

  /** Todos extracted from the session */
  todos: ParsedTodo[];

  /** Tool calls made during the session */
  toolCalls: ParsedToolCall[];

  /** Session start timestamp */
  startedAt: number;

  /** Session end timestamp (if ended) */
  endedAt?: number;
}

/**
 * Parsed conversation data
 */
export interface ParsedConversation {
  /** Conversation index (1-indexed) */
  index: number;

  /** User message */
  userMessage: string;

  /** Agent response */
  agentResponse: string;

  /** Timestamp */
  timestamp: number;
}

/**
 * Parsed todo data
 */
export interface ParsedTodo {
  /** Todo ID */
  id: string;

  /** Todo content */
  content: string;

  /** Todo status */
  status: 'pending' | 'in_progress' | 'completed';

  /** Creation timestamp */
  createdAt: number;
}

/**
 * Parsed tool call data
 */
export interface ParsedToolCall {
  /** Tool name */
  tool: string;

  /** Tool arguments */
  arguments: Record<string, unknown>;

  /** Result (if available) */
  result?: unknown;

  /** Timestamp */
  timestamp: number;

  /** Related file (if applicable) */
  filePath?: string;
}

/**
 * Base class for Agent adapters with common functionality
 */
export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract readonly agentType: AgentType;
  abstract readonly config: AgentAdapterConfig;

  protected homeDir: string;

  constructor() {
    this.homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
  }

  abstract detect(): Promise<AgentDetectionResult>;
  abstract isConnected(): Promise<boolean>;
  abstract connect(hookCore: HookCore): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getSessionFilePath(): string | null;

  /**
   * Get the full path to the config directory
   */
  protected getConfigDirPath(): string {
    return path.join(this.homeDir, this.config.configDir);
  }

  /**
   * Get the full path to the config file
   */
  protected getConfigFilePath(): string {
    return path.join(this.getConfigDirPath(), this.config.configFile);
  }
}
