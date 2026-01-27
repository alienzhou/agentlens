import type { ReviewUnit } from '../models/review-unit.js';
import type { Todo } from '../models/todo.js';
import type { SessionSource } from '../models/session-source.js';

/**
 * Storage interface for Vibe Review data
 */
export interface StorageInterface {
  // Session operations
  /**
   * Save a session source
   */
  saveSession(session: SessionSource): Promise<void>;

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Promise<SessionSource | null>;

  /**
   * List all sessions
   */
  listSessions(): Promise<SessionSource[]>;

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): Promise<boolean>;

  // ReviewUnit operations
  /**
   * Save a review unit
   */
  saveReviewUnit(unit: ReviewUnit): Promise<void>;

  /**
   * Get a review unit by ID
   */
  getReviewUnit(unitId: string): Promise<ReviewUnit | null>;

  /**
   * List all review units
   */
  listReviewUnits(): Promise<ReviewUnit[]>;

  /**
   * List review units by session ID
   */
  listReviewUnitsBySession(sessionId: string): Promise<ReviewUnit[]>;

  /**
   * Delete a review unit
   */
  deleteReviewUnit(unitId: string): Promise<boolean>;

  // Todo operations
  /**
   * Save a todo item
   */
  saveTodo(todo: Todo): Promise<void>;

  /**
   * Get a todo by ID
   */
  getTodo(todoId: string): Promise<Todo | null>;

  /**
   * List all todos
   */
  listTodos(): Promise<Todo[]>;

  /**
   * List todos by status
   */
  listTodosByStatus(status: Todo['status']): Promise<Todo[]>;

  /**
   * Delete a todo
   */
  deleteTodo(todoId: string): Promise<boolean>;

  // Batch operations
  /**
   * Save multiple review units at once
   */
  saveReviewUnits(units: ReviewUnit[]): Promise<void>;

  /**
   * Save multiple todos at once
   */
  saveTodos(todos: Todo[]): Promise<void>;

  // Utility operations
  /**
   * Initialize storage (create directories, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Check if storage is initialized
   */
  isInitialized(): Promise<boolean>;

  /**
   * Get storage statistics
   */
  getStats(): Promise<StorageStats>;

  /**
   * Clear all data (use with caution)
   */
  clear(): Promise<void>;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  sessionsCount: number;
  reviewUnitsCount: number;
  todosCount: number;
  lastUpdated: number;
}
