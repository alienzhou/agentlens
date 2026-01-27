import type { SessionSource } from './session-source.js';
import type { GitHunk } from './git-types.js';

/**
 * Protocol annotation fields based on Agent Review Protocol v0.3
 */
export interface ProtocolAnnotation {
  /** Intent: What the code is trying to do */
  intent: string;

  /** Changes: List of changes made */
  changes: string[];

  /** Rationale: Why this approach was chosen */
  rationale: string;

  /** Tests: How to verify the changes */
  tests: string[];

  /** Edge Cases: Edge cases considered */
  edgeCases: string[];

  /** Optional: Impact analysis */
  impact?: string;

  /** Optional: Alternative approaches considered */
  alternatives?: string[];

  /** Optional: Assumptions made */
  assumptions?: string[];

  /** Optional: Confidence level (0-1) */
  confidence?: number;
}

/**
 * Reference to a Todo item
 */
export interface TodoReference {
  /** Todo ID */
  todoId: string;

  /** Relationship type */
  relationship: 'created_by' | 'related_to' | 'blocked_by';
}

/**
 * ReviewUnit - Core data structure for code review
 *
 * Represents a unit of code change with its source, annotations, and related todos.
 */
export interface ReviewUnit {
  /** Unique identifier */
  id: string;

  /** Source session information */
  sessionSource: SessionSource;

  /** Code hunks in this review unit */
  hunks: GitHunk[];

  /** Protocol annotation (may be empty in MVP) */
  annotation: ProtocolAnnotation;

  /** Related todo items */
  todos: TodoReference[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Creates an empty ProtocolAnnotation
 */
export function createEmptyAnnotation(): ProtocolAnnotation {
  return {
    intent: '',
    changes: [],
    rationale: '',
    tests: [],
    edgeCases: [],
  };
}

/**
 * Creates a new ReviewUnit
 */
export function createReviewUnit(
  id: string,
  sessionSource: SessionSource,
  hunks: GitHunk[],
  annotation?: Partial<ProtocolAnnotation>
): ReviewUnit {
  const now = Date.now();
  return {
    id,
    sessionSource,
    hunks,
    annotation: {
      ...createEmptyAnnotation(),
      ...annotation,
    },
    todos: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validates a ReviewUnit object
 */
export function isValidReviewUnit(unit: unknown): unit is ReviewUnit {
  if (typeof unit !== 'object' || unit === null) {
    return false;
  }

  const u = unit as ReviewUnit;

  return (
    typeof u.id === 'string' &&
    u.id.length > 0 &&
    typeof u.sessionSource === 'object' &&
    Array.isArray(u.hunks) &&
    typeof u.annotation === 'object' &&
    Array.isArray(u.todos) &&
    typeof u.createdAt === 'number' &&
    typeof u.updatedAt === 'number'
  );
}

/**
 * Generates a unique ID for a ReviewUnit
 */
export function generateReviewUnitId(sessionId: string, qaIndex: number, hunkCount: number): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ru_${sessionId.substring(0, 8)}_${String(qaIndex)}_${String(hunkCount)}_${timestamp}_${random}`;
}
