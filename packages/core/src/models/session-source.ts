/**
 * Known agent types supported by Vibe Review
 */
export type KnownAgentType = 'cursor' | 'cursor-cli' | 'claude-code' | 'opencode' | 'gemini-cli' | 'unknown';

/**
 * Agent types supported by Vibe Review (extensible)
 */
export type AgentType = KnownAgentType | (string & Record<never, never>);

/**
 * SessionSource - Represents an AI Agent session
 *
 * Records which Agent generated the code, session ID, and conversation round.
 */
export interface SessionSource {
  /** Agent type (e.g., 'cursor', 'claude-code') */
  agent: AgentType;

  /** Unique session identifier */
  sessionId: string;

  /** Which round of QA conversation (1-indexed) */
  qaIndex: number;

  /** Timestamp when the session was created */
  timestamp: number;

  /** Optional metadata about the session */
  metadata?: SessionMetadata;
}

/**
 * Session metadata for additional context
 */
export interface SessionMetadata {
  /** User's original prompt/request */
  userPrompt?: string;

  /** Agent's response summary */
  agentResponse?: string;

  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Creates a new SessionSource instance
 */
export function createSessionSource(
  agent: AgentType,
  sessionId: string,
  qaIndex: number,
  metadata?: SessionMetadata
): SessionSource {
  return {
    agent,
    sessionId,
    qaIndex,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Validates a SessionSource object
 */
export function isValidSessionSource(source: unknown): source is SessionSource {
  if (typeof source !== 'object' || source === null) {
    return false;
  }

  const s = source as SessionSource;

  return (
    typeof s.agent === 'string' &&
    s.agent.length > 0 &&
    typeof s.sessionId === 'string' &&
    s.sessionId.length > 0 &&
    typeof s.qaIndex === 'number' &&
    s.qaIndex >= 0 &&
    typeof s.timestamp === 'number' &&
    s.timestamp > 0
  );
}
