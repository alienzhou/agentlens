import type { SessionSource } from './session-source.js';

/**
 * Todo status
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Todo priority
 */
export type TodoPriority = 'low' | 'medium' | 'high';

/**
 * Todo - Task items from Agent's task breakdown
 *
 * Represents a task item that the Agent created during code generation.
 * These are NOT user-created tasks, but rather the Agent's own task breakdown
 * to accomplish the user's request.
 */
export interface Todo {
  /** Unique identifier */
  id: string;

  /** Task content/description */
  content: string;

  /** Current status */
  status: TodoStatus;

  /** Priority level */
  priority: TodoPriority;

  /** Source session information (for traceability) */
  sessionSource: SessionSource;

  /** Associated ReviewUnit IDs */
  reviewUnits: string[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Optional due date */
  dueDate?: number;

  /** Optional assignee */
  assignee?: string;

  /** Optional description/notes */
  description?: string;
}

/**
 * Creates a new Todo item
 */
export function createTodo(
  id: string,
  content: string,
  sessionSource: SessionSource,
  options?: {
    priority?: TodoPriority;
    description?: string;
    dueDate?: number;
    assignee?: string;
  }
): Todo {
  const now = Date.now();
  return {
    id,
    content,
    status: 'pending',
    priority: options?.priority ?? 'medium',
    sessionSource,
    reviewUnits: [],
    createdAt: now,
    updatedAt: now,
    dueDate: options?.dueDate,
    assignee: options?.assignee,
    description: options?.description,
  };
}

/**
 * Updates a Todo's status
 */
export function updateTodoStatus(todo: Todo, status: TodoStatus): Todo {
  return {
    ...todo,
    status,
    updatedAt: Date.now(),
  };
}

/**
 * Links a Todo to a ReviewUnit
 */
export function linkTodoToReviewUnit(todo: Todo, reviewUnitId: string): Todo {
  if (todo.reviewUnits.includes(reviewUnitId)) {
    return todo;
  }
  return {
    ...todo,
    reviewUnits: [...todo.reviewUnits, reviewUnitId],
    updatedAt: Date.now(),
  };
}

/**
 * Validates a Todo object
 */
export function isValidTodo(todo: unknown): todo is Todo {
  if (typeof todo !== 'object' || todo === null) {
    return false;
  }

  const t = todo as Todo;

  return (
    typeof t.id === 'string' &&
    t.id.length > 0 &&
    typeof t.content === 'string' &&
    t.content.length > 0 &&
    ['pending', 'in_progress', 'completed'].includes(t.status) &&
    ['low', 'medium', 'high'].includes(t.priority) &&
    typeof t.sessionSource === 'object' &&
    Array.isArray(t.reviewUnits) &&
    typeof t.createdAt === 'number' &&
    typeof t.updatedAt === 'number'
  );
}

/**
 * Generates a unique ID for a Todo
 */
export function generateTodoId(sessionId: string, index: number): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `todo_${sessionId.substring(0, 8)}_${String(index)}_${timestamp}_${random}`;
}
