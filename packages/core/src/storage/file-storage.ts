import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { nanoid } from 'nanoid';
import type { StorageInterface, StorageStats } from './storage-interface.js';
import type { ReviewUnit } from '../models/review-unit.js';
import type { Todo } from '../models/todo.js';
import type { SessionSource } from '../models/session-source.js';
import type { PerformanceMetrics } from '../performance/performance-tracker.js';
import { DATA_DIR_NAME, DATA_SUBDIRS, DATA_FILES } from '../constants.js';

// ==================== Hook Data Types ====================

/**
 * Code change record (captured by Hook)
 */
export interface CodeChangeRecord {
  /** Unique ID: {timestamp}-{nanoid} */
  id?: string;
  /** Session ID */
  sessionId: string;
  /** Agent type */
  agent: string;
  /** Timestamp */
  timestamp: number;
  /** Tool name (Edit, Write, MultiEdit) */
  toolName: string;
  /** File path */
  filePath: string;
  /** Old content (when Edit) */
  oldContent?: string;
  /** New content */
  newContent?: string;
  /** Whether successful */
  success: boolean;
}

/**
 * Hook session data
 */
export interface HookSessionData {
  /** Session ID */
  sessionId: string;
  /** Agent type */
  agent: string;
  /** Start time */
  startedAt: number;
  /** End time */
  endedAt?: number;
  /** Session source */
  source?: 'startup' | 'resume' | 'clear' | 'compact';
  /** Model */
  model?: string;
  /** Session transcript file path */
  transcriptPath?: string;
  /** Working directory */
  cwd?: string;
  /** End reason */
  endReason?: string;
  /** @deprecated Use PromptRecord instead. Kept for backward compatibility. */
  userPrompt?: string;
}

/**
 * Prompt record (captured from UserPromptSubmit hook)
 * Each user prompt is stored with a timestamp for accurate matching with code changes.
 */
export interface PromptRecord {
  /** Session ID */
  sessionId: string;
  /** User prompt text */
  prompt: string;
  /** Timestamp when the prompt was submitted */
  timestamp: number;
}

/**
 * File-based storage implementation for Agent Blame
 */
export class FileStorage implements StorageInterface {
  private readonly basePath: string;
  private readonly dataPath: string;
  private readonly sessionsPath: string;
  private readonly reviewUnitsPath: string;
  private readonly configPath: string;
  private readonly hookDataPath: string;
  private initialized = false;

  constructor(projectRoot: string) {
    this.basePath = path.join(projectRoot, DATA_DIR_NAME);
    this.dataPath = path.join(this.basePath, DATA_SUBDIRS.DATA);
    this.sessionsPath = path.join(this.dataPath, DATA_SUBDIRS.SESSIONS);
    this.reviewUnitsPath = path.join(this.dataPath, DATA_SUBDIRS.REVIEW_UNITS);
    this.configPath = path.join(this.basePath, DATA_SUBDIRS.CONFIG);
    this.hookDataPath = path.join(this.dataPath, 'hooks');
  }

  // ==================== Initialization ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create directory structure
    await fs.mkdir(this.sessionsPath, { recursive: true });
    await fs.mkdir(this.reviewUnitsPath, { recursive: true });
    await fs.mkdir(this.configPath, { recursive: true });
    await fs.mkdir(this.hookDataPath, { recursive: true });
    await fs.mkdir(path.join(this.hookDataPath, 'changes'), { recursive: true });
    await fs.mkdir(path.join(this.hookDataPath, 'prompts'), { recursive: true });
    await fs.mkdir(path.join(this.hookDataPath, 'logs'), { recursive: true });
    await fs.mkdir(path.join(this.hookDataPath, 'reports'), { recursive: true });

    // Initialize files if they don't exist
    await this.initializeFile(path.join(this.dataPath, DATA_FILES.TODOS), '[]');
    await this.initializeFile(path.join(this.dataPath, DATA_FILES.METADATA), JSON.stringify({
      version: '0.1.0',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    }));
    await this.initializeFile(path.join(this.sessionsPath, DATA_FILES.INDEX), '[]');
    await this.initializeFile(path.join(this.hookDataPath, 'sessions.json'), '{}');

    this.initialized = true;
  }

  async isInitialized(): Promise<boolean> {
    try {
      await fs.access(this.basePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the hook data path for cleanup manager
   */
  getHookDataPath(): string {
    return this.hookDataPath;
  }

  private async initializeFile(filePath: string, defaultContent: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, defaultContent, 'utf-8');
    }
  }

  // ==================== Session Operations ====================

  async saveSession(session: SessionSource): Promise<void> {
    await this.ensureInitialized();
    
    // Create date-based directory
    const date = new Date(session.timestamp);
    const dateDir = this.getDateDirectory(date);
    await fs.mkdir(dateDir, { recursive: true });

    // Save session file
    const sessionFile = path.join(dateDir, `session-${session.sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2), 'utf-8');

    // Update index
    await this.updateSessionIndex(session);
  }

  async getSession(sessionId: string): Promise<SessionSource | null> {
    await this.ensureInitialized();
    
    const index = await this.readSessionIndex();
    const entry = index.find((s: SessionIndexEntry) => s.sessionId === sessionId);
    
    if (!entry) {
      return null;
    }

    try {
      const content = await fs.readFile(entry.filePath, 'utf-8');
      return JSON.parse(content) as SessionSource;
    } catch {
      return null;
    }
  }

  async listSessions(): Promise<SessionSource[]> {
    await this.ensureInitialized();
    
    const index = await this.readSessionIndex();
    const sessions: SessionSource[] = [];

    for (const entry of index) {
      try {
        const content = await fs.readFile(entry.filePath, 'utf-8');
        sessions.push(JSON.parse(content) as SessionSource);
      } catch {
        // Skip invalid entries
      }
    }

    return sessions;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const index = await this.readSessionIndex();
    const entryIndex = index.findIndex((s: SessionIndexEntry) => s.sessionId === sessionId);
    
    if (entryIndex === -1) {
      return false;
    }

    const entry = index[entryIndex]!;
    
    try {
      await fs.unlink(entry.filePath);
    } catch {
      // File might already be deleted
    }

    // Update index
    index.splice(entryIndex, 1);
    await this.writeSessionIndex(index);
    
    return true;
  }

  private getDateDirectory(date: Date): string {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return path.join(this.sessionsPath, `${year}-${month}-${day}`);
  }

  private async readSessionIndex(): Promise<SessionIndexEntry[]> {
    try {
      const content = await fs.readFile(
        path.join(this.sessionsPath, DATA_FILES.INDEX),
        'utf-8'
      );
      return JSON.parse(content) as SessionIndexEntry[];
    } catch {
      return [];
    }
  }

  private async writeSessionIndex(index: SessionIndexEntry[]): Promise<void> {
    await fs.writeFile(
      path.join(this.sessionsPath, DATA_FILES.INDEX),
      JSON.stringify(index, null, 2),
      'utf-8'
    );
  }

  private async updateSessionIndex(session: SessionSource): Promise<void> {
    const index = await this.readSessionIndex();
    const date = new Date(session.timestamp);
    const dateDir = this.getDateDirectory(date);
    const filePath = path.join(dateDir, `session-${session.sessionId}.json`);

    const existingIndex = index.findIndex((s) => s.sessionId === session.sessionId);
    const entry: SessionIndexEntry = {
      sessionId: session.sessionId,
      agent: session.agent,
      timestamp: session.timestamp,
      filePath,
    };

    if (existingIndex >= 0) {
      index[existingIndex] = entry;
    } else {
      index.push(entry);
    }

    await this.writeSessionIndex(index);
  }

  // ==================== ReviewUnit Operations ====================

  async saveReviewUnit(unit: ReviewUnit): Promise<void> {
    await this.ensureInitialized();
    
    const unitFile = path.join(this.reviewUnitsPath, `${unit.id}.json`);
    await fs.writeFile(unitFile, JSON.stringify(unit, null, 2), 'utf-8');
  }

  async getReviewUnit(unitId: string): Promise<ReviewUnit | null> {
    await this.ensureInitialized();
    
    try {
      const content = await fs.readFile(
        path.join(this.reviewUnitsPath, `${unitId}.json`),
        'utf-8'
      );
      return JSON.parse(content) as ReviewUnit;
    } catch {
      return null;
    }
  }

  async listReviewUnits(): Promise<ReviewUnit[]> {
    await this.ensureInitialized();
    
    const units: ReviewUnit[] = [];
    
    try {
      const files = await fs.readdir(this.reviewUnitsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(
              path.join(this.reviewUnitsPath, file),
              'utf-8'
            );
            units.push(JSON.parse(content) as ReviewUnit);
          } catch {
            // Skip invalid files
          }
        }
      }
    } catch {
      // Directory might not exist
    }

    return units.sort((a, b) => b.createdAt - a.createdAt);
  }

  async listReviewUnitsBySession(sessionId: string): Promise<ReviewUnit[]> {
    const allUnits = await this.listReviewUnits();
    return allUnits.filter((unit) => unit.sessionSource.sessionId === sessionId);
  }

  async deleteReviewUnit(unitId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      await fs.unlink(path.join(this.reviewUnitsPath, `${unitId}.json`));
      return true;
    } catch {
      return false;
    }
  }

  async saveReviewUnits(units: ReviewUnit[]): Promise<void> {
    await Promise.all(units.map((unit) => this.saveReviewUnit(unit)));
  }

  // ==================== Todo Operations ====================

  async saveTodo(todo: Todo): Promise<void> {
    await this.ensureInitialized();
    
    const todos = await this.listTodos();
    const existingIndex = todos.findIndex((t) => t.id === todo.id);

    if (existingIndex >= 0) {
      todos[existingIndex] = todo;
    } else {
      todos.push(todo);
    }

    await this.writeTodos(todos);
  }

  async getTodo(todoId: string): Promise<Todo | null> {
    const todos = await this.listTodos();
    return todos.find((t) => t.id === todoId) ?? null;
  }

  async listTodos(): Promise<Todo[]> {
    await this.ensureInitialized();
    
    try {
      const content = await fs.readFile(
        path.join(this.dataPath, DATA_FILES.TODOS),
        'utf-8'
      );
      return JSON.parse(content) as Todo[];
    } catch {
      return [];
    }
  }

  async listTodosByStatus(status: Todo['status']): Promise<Todo[]> {
    const todos = await this.listTodos();
    return todos.filter((t) => t.status === status);
  }

  async deleteTodo(todoId: string): Promise<boolean> {
    const todos = await this.listTodos();
    const index = todos.findIndex((t) => t.id === todoId);

    if (index === -1) {
      return false;
    }

    todos.splice(index, 1);
    await this.writeTodos(todos);
    return true;
  }

  async saveTodos(todos: Todo[]): Promise<void> {
    await this.ensureInitialized();
    await this.writeTodos(todos);
  }

  private async writeTodos(todos: Todo[]): Promise<void> {
    await fs.writeFile(
      path.join(this.dataPath, DATA_FILES.TODOS),
      JSON.stringify(todos, null, 2),
      'utf-8'
    );
  }

  // ==================== Utility Operations ====================

  async getStats(): Promise<StorageStats> {
    await this.ensureInitialized();
    
    const sessions = await this.listSessions();
    const reviewUnits = await this.listReviewUnits();
    const todos = await this.listTodos();

    return {
      sessionsCount: sessions.length,
      reviewUnitsCount: reviewUnits.length,
      todosCount: todos.length,
      lastUpdated: Date.now(),
    };
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ==================== Hook Data Operations ====================

  /**
   * Generate a unique record ID
   * Format: {timestamp}-{nanoid}
   */
  private generateRecordId(timestamp: number): string {
    const nanoId = nanoid(8);
    return `${timestamp}-${nanoId}`;
  }

  /**
   * Get date string in YYYY-MM-DD format
   */
  private getDateString(timestamp: number): string {
    const date = new Date(timestamp);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get sharded file path for changes or prompts
   */
  private getShardedFilePath(type: 'changes' | 'prompts', timestamp: number): string {
    const dateStr = this.getDateString(timestamp);
    return path.join(this.hookDataPath, type, `${dateStr}.jsonl`);
  }

  /**
   * Append code change record (from Hook)
   * Now writes to sharded files by date
   */
  async appendCodeChange(change: CodeChangeRecord): Promise<void> {
    await this.ensureInitialized();

    // Generate ID if not present
    const changeWithId: CodeChangeRecord = {
      ...change,
      id: change.id ?? this.generateRecordId(change.timestamp),
    };

    // Write to sharded file
    const filePath = this.getShardedFilePath('changes', change.timestamp);
    const line = JSON.stringify(changeWithId) + '\n';
    await fs.appendFile(filePath, line, 'utf-8');
  }

  /**
   * Save Hook session data
   */
  async saveHookSession(session: HookSessionData): Promise<void> {
    await this.ensureInitialized();

    const sessionsFile = path.join(this.hookDataPath, 'sessions.json');

    // Read existing sessions
    let sessions: Record<string, HookSessionData> = {};
    try {
      const content = await fs.readFile(sessionsFile, 'utf-8');
      sessions = JSON.parse(content) as Record<string, HookSessionData>;
    } catch {
      // File doesn't exist or parse failed, use empty object
    }

    // Save session
    sessions[session.sessionId] = session;

    await fs.writeFile(sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8');
  }

  /**
   * Update Hook session data
   */
  async updateHookSession(sessionId: string, updates: Partial<HookSessionData>): Promise<void> {
    await this.ensureInitialized();

    const sessionsFile = path.join(this.hookDataPath, 'sessions.json');

    // Read existing sessions
    let sessions: Record<string, HookSessionData> = {};
    try {
      const content = await fs.readFile(sessionsFile, 'utf-8');
      sessions = JSON.parse(content) as Record<string, HookSessionData>;
    } catch {
      // File doesn't exist or parse failed
      return;
    }

    // Update session
    const existingSession = sessions[sessionId];
    if (existingSession) {
      sessions[sessionId] = { ...existingSession, ...updates };
      await fs.writeFile(sessionsFile, JSON.stringify(sessions, null, 2), 'utf-8');
    }
  }

  /**
   * Get Hook session data
   */
  async getHookSession(sessionId: string): Promise<HookSessionData | null> {
    await this.ensureInitialized();

    const sessionsFile = path.join(this.hookDataPath, 'sessions.json');

    try {
      const content = await fs.readFile(sessionsFile, 'utf-8');
      const sessions = JSON.parse(content) as Record<string, HookSessionData>;
      return sessions[sessionId] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get code changes by session ID
   */
  async getCodeChangesBySession(sessionId: string): Promise<CodeChangeRecord[]> {
    await this.ensureInitialized();

    const changes: CodeChangeRecord[] = [];
    const changesDir = path.join(this.hookDataPath, 'changes');

    try {
      const files = await fs.readdir(changesDir);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) {
          continue;
        }
        
        const filePath = path.join(changesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const change = JSON.parse(line) as CodeChangeRecord;
              if (change.sessionId === sessionId) {
                changes.push(change);
              }
            } catch {
              // Skip invalid lines
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return changes;
  }

  /**
   * Get recent code changes within a time window
   * Reads from sharded files for better performance
   */
  async getRecentCodeChanges(timeWindowDays: number): Promise<CodeChangeRecord[]> {
    await this.ensureInitialized();
    
    const records: CodeChangeRecord[] = [];
    const today = new Date();
    
    for (let i = 0; i < timeWindowDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.getDateString(date.getTime());
      
      const filePath = path.join(this.hookDataPath, 'changes', `${dateStr}.jsonl`);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              records.push(JSON.parse(line) as CodeChangeRecord);
            } catch {
              // Skip invalid lines
            }
          }
        }
      } catch {
        // File doesn't exist, skip
      }
    }
    
    return records;
  }

  // ==================== Prompt Record Operations ====================

  /**
   * Append a prompt record (from UserPromptSubmit hook)
   * Now writes to sharded files by date
   */
  async appendPrompt(record: PromptRecord): Promise<void> {
    await this.ensureInitialized();

    const filePath = this.getShardedFilePath('prompts', record.timestamp);
    const line = JSON.stringify(record) + '\n';
    await fs.appendFile(filePath, line, 'utf-8');
  }

  /**
   * Get the latest prompt before a given timestamp for a session
   * Used to match code changes with their triggering prompt
   */
  async getLatestPromptBefore(sessionId: string, beforeTimestamp: number): Promise<string | undefined> {
    await this.ensureInitialized();

    const promptsDir = path.join(this.hookDataPath, 'prompts');

    try {
      const files = await fs.readdir(promptsDir);
      
      let latestPrompt: string | undefined;
      let latestTimestamp = 0;

      for (const file of files) {
        if (!file.endsWith('.jsonl')) {
          continue;
        }
        
        const filePath = path.join(promptsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          try {
            const record = JSON.parse(line) as PromptRecord;

            // Match session and find the latest prompt before the given timestamp
            if (
              record.sessionId === sessionId &&
              record.timestamp <= beforeTimestamp &&
              record.timestamp > latestTimestamp
            ) {
              latestTimestamp = record.timestamp;
              latestPrompt = record.prompt;
            }
          } catch {
            // Skip invalid lines
          }
        }
      }

      return latestPrompt;
    } catch {
      // Directory doesn't exist
      return undefined;
    }
  }

  /**
   * Get all prompt records for a session
   */
  async getPromptsBySession(sessionId: string): Promise<PromptRecord[]> {
    await this.ensureInitialized();

    const promptsDir = path.join(this.hookDataPath, 'prompts');
    const prompts: PromptRecord[] = [];

    try {
      const files = await fs.readdir(promptsDir);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) {
          continue;
        }
        
        const filePath = path.join(promptsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          try {
            const record = JSON.parse(line) as PromptRecord;
            if (record.sessionId === sessionId) {
              prompts.push(record);
            }
          } catch {
            // Skip invalid lines
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return prompts.sort((a, b) => a.timestamp - b.timestamp);
  }

  // ==================== Performance Log Operations ====================

  /**
   * Append performance log entry
   */
  async appendPerformanceLog(metrics: PerformanceMetrics): Promise<void> {
    await this.ensureInitialized();

    const logPath = path.join(this.hookDataPath, 'logs', 'performance.jsonl');

    // Simplified log entry
    const logEntry = {
      timestamp: metrics.timestamp,
      totalMs: metrics.totalMs,
      warning: metrics.warning,
      filtering: {
        filePathCandidates: metrics.filtering.filePathCandidates,
        timeWindowCandidates: metrics.filtering.timeWindowCandidates,
        lengthCandidates: metrics.filtering.lengthCandidates,
      },
      similarity: {
        levenshteinTotalMs: metrics.similarity.levenshteinTotalMs,
        callCount: metrics.similarity.levenshteinCallCount,
        avgMs: metrics.similarity.avgLevenshteinMs,
      },
      result: {
        matched: metrics.result.matched,
      },
    };

    const line = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  }
}

/**
 * Session index entry for fast lookups
 */
interface SessionIndexEntry {
  sessionId: string;
  agent: string;
  timestamp: number;
  filePath: string;
}
