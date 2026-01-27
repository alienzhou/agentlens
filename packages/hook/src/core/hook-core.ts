import type { AgentType, SessionSource } from '@vibe-review/core';
import { createSessionSource } from '@vibe-review/core';
import type {
  HookEvent,
  HookEventHandler,
  EventHandlerRegistration,
  CodeChangeEvent,
  TodoUpdateEvent,
  SessionStartEvent,
  SessionEndEvent,
} from './event-types.js';

/**
 * HookCore - Central event management for the Hook system
 *
 * Manages sessions, captures events, and distributes them to handlers.
 */
export class HookCore {
  private handlers: EventHandlerRegistration[] = [];
  private activeSessions: Map<string, SessionSource> = new Map();
  private handlerIdCounter = 0;

  /**
   * Start a new session
   */
  onSessionStart(agent: AgentType, sessionId: string, userPrompt?: string): SessionSource {
    const session = createSessionSource(agent, sessionId, 1, {
      userPrompt,
    });

    this.activeSessions.set(sessionId, session);

    // Emit session start event
    const event: SessionStartEvent = {
      type: 'session_start',
      agent,
      sessionId,
      timestamp: Date.now(),
      userPrompt,
    };

    void this.emit(event);

    return session;
  }

  /**
   * Handle a code change
   */
  onCodeChange(
    sessionId: string,
    filePath: string,
    absolutePath: string,
    newContent: string,
    addedLines: string[],
    removedLines: string[],
    oldContent?: string
  ): void {
    const session = this.getOrCreateSession(sessionId);

    const event: CodeChangeEvent = {
      type: 'code_change',
      sessionSource: session,
      filePath,
      absolutePath,
      oldContent,
      newContent,
      addedLines,
      removedLines,
      timestamp: Date.now(),
    };

    void this.emit(event);
  }

  /**
   * Handle a todo update
   */
  onTodoUpdate(
    sessionId: string,
    todoId: string,
    content: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): void {
    const session = this.getOrCreateSession(sessionId);

    const event: TodoUpdateEvent = {
      type: 'todo_update',
      sessionSource: session,
      todoId,
      content,
      status,
      timestamp: Date.now(),
    };

    void this.emit(event);
  }

  /**
   * End a session
   */
  onSessionEnd(sessionId: string, summary?: string): void {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return;
    }

    const event: SessionEndEvent = {
      type: 'session_end',
      agent: session.agent,
      sessionId,
      timestamp: Date.now(),
      summary,
    };

    void this.emit(event);

    this.activeSessions.delete(sessionId);
  }

  /**
   * Increment QA index for a session (new conversation round)
   */
  incrementQaIndex(sessionId: string): number {
    const session = this.activeSessions.get(sessionId);

    if (session) {
      const newSession: SessionSource = {
        ...session,
        qaIndex: session.qaIndex + 1,
      };
      this.activeSessions.set(sessionId, newSession);
      return newSession.qaIndex;
    }

    return 1;
  }

  /**
   * Get an active session
   */
  getSession(sessionId: string): SessionSource | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionSource[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Register an event handler
   */
  on<T extends HookEvent>(
    type: T['type'],
    handler: HookEventHandler<T>
  ): string {
    const id = `handler_${String(++this.handlerIdCounter)}`;

    this.handlers.push({
      type,
      handler: handler as HookEventHandler,
      id,
    });

    return id;
  }

  /**
   * Register a handler for all events
   */
  onAny(handler: HookEventHandler): string {
    const id = `handler_${String(++this.handlerIdCounter)}`;

    // Register for all event types
    const eventTypes: HookEvent['type'][] = [
      'session_start',
      'session_end',
      'code_change',
      'todo_update',
    ];

    for (const type of eventTypes) {
      this.handlers.push({
        type,
        handler,
        id: `${id}_${type}`,
      });
    }

    return id;
  }

  /**
   * Remove an event handler
   */
  off(handlerId: string): boolean {
    const initialLength = this.handlers.length;
    this.handlers = this.handlers.filter(
      (h) => h.id !== handlerId && !h.id.startsWith(`${handlerId}_`)
    );
    return this.handlers.length < initialLength;
  }

  /**
   * Remove all handlers
   */
  removeAllHandlers(): void {
    this.handlers = [];
  }

  /**
   * Emit an event to all registered handlers
   */
  private async emit(event: HookEvent): Promise<void> {
    const relevantHandlers = this.handlers.filter((h) => h.type === event.type);

    for (const registration of relevantHandlers) {
      try {
        await registration.handler(event);
      } catch (error) {
        console.error(`Error in hook handler ${registration.id}:`, error);
      }
    }
  }

  /**
   * Get or create a session with unknown agent
   */
  private getOrCreateSession(sessionId: string): SessionSource {
    let session = this.activeSessions.get(sessionId);

    if (!session) {
      session = createSessionSource('unknown', sessionId, 1);
      this.activeSessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.removeAllHandlers();
    this.activeSessions.clear();
  }
}

/**
 * Singleton instance of HookCore
 */
let hookCoreInstance: HookCore | null = null;

/**
 * Get the singleton HookCore instance
 */
export function getHookCore(): HookCore {
  if (!hookCoreInstance) {
    hookCoreInstance = new HookCore();
  }
  return hookCoreInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetHookCore(): void {
  if (hookCoreInstance) {
    hookCoreInstance.dispose();
    hookCoreInstance = null;
  }
}
