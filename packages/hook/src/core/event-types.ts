import type { AgentType, SessionSource } from '@agent-blame/core';

/**
 * Code change event - emitted when Agent modifies a file
 */
export interface CodeChangeEvent {
  /** Event type */
  type: 'code_change';

  /** Session source */
  sessionSource: SessionSource;

  /** File path (relative to repository root) */
  filePath: string;

  /** Absolute file path */
  absolutePath: string;

  /** Content before the change (if available) */
  oldContent?: string;

  /** Content after the change */
  newContent: string;

  /** Lines added */
  addedLines: string[];

  /** Lines removed */
  removedLines: string[];

  /** Timestamp */
  timestamp: number;
}

/**
 * Todo update event - emitted when Agent creates/updates a todo
 */
export interface TodoUpdateEvent {
  /** Event type */
  type: 'todo_update';

  /** Session source */
  sessionSource: SessionSource;

  /** Todo ID */
  todoId: string;

  /** Todo content */
  content: string;

  /** Todo status */
  status: 'pending' | 'in_progress' | 'completed';

  /** Timestamp */
  timestamp: number;
}

/**
 * Session start event
 */
export interface SessionStartEvent {
  /** Event type */
  type: 'session_start';

  /** Agent type */
  agent: AgentType;

  /** Session ID */
  sessionId: string;

  /** Timestamp */
  timestamp: number;

  /** User prompt (if available) */
  userPrompt?: string;
}

/**
 * Session end event
 */
export interface SessionEndEvent {
  /** Event type */
  type: 'session_end';

  /** Agent type */
  agent: AgentType;

  /** Session ID */
  sessionId: string;

  /** Timestamp */
  timestamp: number;

  /** Summary (if available) */
  summary?: string;
}

/**
 * All hook event types
 */
export type HookEvent = CodeChangeEvent | TodoUpdateEvent | SessionStartEvent | SessionEndEvent;

/**
 * Event handler function type
 */
export type HookEventHandler<T extends HookEvent = HookEvent> = (event: T) => void | Promise<void>;

/**
 * Event handler registration
 */
export interface EventHandlerRegistration {
  type: HookEvent['type'];
  handler: HookEventHandler;
  id: string;
}
