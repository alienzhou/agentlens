import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import type { AgentAdapter, ParsedSession } from '../adapters/adapter-interface.js';

/**
 * Session file change event
 */
export interface SessionChangeEvent {
  /** Type of change */
  type: 'created' | 'modified' | 'deleted';

  /** File path */
  filePath: string;

  /** Parsed session data (if available) */
  session?: ParsedSession;

  /** Timestamp */
  timestamp: number;
}

/**
 * Session change handler
 */
export type SessionChangeHandler = (event: SessionChangeEvent) => void | Promise<void>;

/**
 * Session file watcher configuration
 */
export interface SessionWatcherConfig {
  /** Debounce delay in milliseconds */
  debounceMs?: number;

  /** File patterns to watch */
  patterns?: string[];

  /** Ignore patterns */
  ignorePatterns?: string[];
}

/**
 * SessionWatcher - Monitors session files for changes
 *
 * Part of the dual-track data collection system.
 * Watches session files created by AI Agents and parses them.
 */
export class SessionWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private handlers: SessionChangeHandler[] = [];
  private adapters: Map<string, AgentAdapter> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: Required<SessionWatcherConfig>;

  constructor(config: SessionWatcherConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 500,
      patterns: config.patterns ?? ['*.json', '*.jsonl'],
      ignorePatterns: config.ignorePatterns ?? ['**/node_modules/**', '**/.git/**'],
    };
  }

  /**
   * Register an adapter for session parsing
   */
  registerAdapter(adapter: AgentAdapter): void {
    this.adapters.set(adapter.agentType, adapter);
  }

  /**
   * Start watching a directory
   */
  async watchDirectory(dirPath: string, agentType?: string): Promise<void> {
    if (this.watchers.has(dirPath)) {
      return; // Already watching
    }

    // Ensure directory exists
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }

    const watcher = watch(dirPath, {
      persistent: true,
      ignoreInitial: true,
      ignored: this.config.ignorePatterns,
      depth: 3,
    });

    watcher.on('add', (filePath) => {
      this.handleFileChange('created', filePath, agentType);
    });

    watcher.on('change', (filePath) => {
      this.handleFileChange('modified', filePath, agentType);
    });

    watcher.on('unlink', (filePath) => {
      this.handleFileChange('deleted', filePath, agentType);
    });

    watcher.on('error', (error) => {
      console.error(`Session watcher error for ${dirPath}:`, error);
    });

    this.watchers.set(dirPath, watcher);
  }

  /**
   * Stop watching a directory
   */
  async stopWatching(dirPath: string): Promise<void> {
    const watcher = this.watchers.get(dirPath);

    if (watcher) {
      await watcher.close();
      this.watchers.delete(dirPath);
    }
  }

  /**
   * Stop watching all directories
   */
  async stopAll(): Promise<void> {
    const closePromises = Array.from(this.watchers.values()).map((w) => w.close());
    await Promise.all(closePromises);
    this.watchers.clear();
    this.clearDebounceTimers();
  }

  /**
   * Register a change handler
   */
  onSessionChange(handler: SessionChangeHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a change handler
   */
  removeHandler(handler: SessionChangeHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Remove all handlers
   */
  removeAllHandlers(): void {
    this.handlers = [];
  }

  /**
   * Get watched directories
   */
  getWatchedDirs(): string[] {
    return Array.from(this.watchers.keys());
  }

  // ==================== Private Methods ====================

  private handleFileChange(
    type: SessionChangeEvent['type'],
    filePath: string,
    agentType?: string
  ): void {
    // Check if file matches patterns
    if (!this.matchesPatterns(filePath)) {
      return;
    }

    // Debounce changes
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      void this.processFileChange(type, filePath, agentType);
      this.debounceTimers.delete(filePath);
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private async processFileChange(
    type: SessionChangeEvent['type'],
    filePath: string,
    agentType?: string
  ): Promise<void> {
    let session: ParsedSession | undefined;

    if (type !== 'deleted') {
      session = await this.parseSessionFile(filePath, agentType);
    }

    const event: SessionChangeEvent = {
      type,
      filePath,
      session,
      timestamp: Date.now(),
    };

    // Notify all handlers
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Session change handler error:', error);
      }
    }
  }

  private async parseSessionFile(
    filePath: string,
    agentType?: string
  ): Promise<ParsedSession | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Try specified adapter first
      if (agentType) {
        const adapter = this.adapters.get(agentType);
        if (adapter?.parseSessionFile) {
          const session = adapter.parseSessionFile(content);
          if (session) {
            return session;
          }
        }
      }

      // Try all adapters
      for (const adapter of this.adapters.values()) {
        if (adapter.parseSessionFile) {
          const session = adapter.parseSessionFile(content);
          if (session) {
            return session;
          }
        }
      }

      // Default parsing
      return this.defaultParse(content, filePath);
    } catch (error) {
      console.error(`Failed to parse session file ${filePath}:`, error);
      return undefined;
    }
  }

  private defaultParse(content: string, filePath: string): ParsedSession | undefined {
    try {
      // Try JSON first
      const data = JSON.parse(content) as Record<string, unknown>;

      return {
        sessionId: (data['id'] as string | undefined) ?? path.basename(filePath, path.extname(filePath)),
        conversations: [],
        todos: [],
        toolCalls: [],
        startedAt: Date.now(),
      };
    } catch {
      // Try JSONL
      try {
        const lines = content.trim().split('\n');
        if (lines.length > 0 && lines[0]) {
          JSON.parse(lines[0]); // Validate it's JSONL

          return {
            sessionId: path.basename(filePath, path.extname(filePath)),
            conversations: [],
            todos: [],
            toolCalls: [],
            startedAt: Date.now(),
          };
        }
      } catch {
        // Not valid JSONL either
      }
    }

    return undefined;
  }

  private matchesPatterns(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return this.config.patterns.some((pattern) => {
      // Simple glob matching
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      return regex.test(fileName);
    });
  }

  private clearDebounceTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
