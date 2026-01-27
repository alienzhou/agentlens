import type { ParsedSession, ParsedConversation, ParsedTodo, ParsedToolCall } from '../adapters/adapter-interface.js';

/**
 * Session parser utilities
 *
 * Provides common parsing functions for session files
 * from different AI Agent platforms.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SessionParser {
  /**
   * Parse JSON session content
   */
  static parseJson(content: string): Record<string, unknown> | null {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Parse JSONL session content
   */
  static parseJsonl(content: string): Record<string, unknown>[] {
    const lines = content.trim().split('\n');
    const results: Record<string, unknown>[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          results.push(JSON.parse(trimmed) as Record<string, unknown>);
        } catch {
          // Skip invalid lines
        }
      }
    }

    return results;
  }

  /**
   * Extract conversations from parsed messages
   */
  static extractConversations(
    messages: Record<string, unknown>[],
    options: {
      userTypeField?: string;
      assistantTypeField?: string;
      contentField?: string;
      timestampField?: string;
    } = {}
  ): ParsedConversation[] {
    const {
      userTypeField = 'type',
      assistantTypeField = 'type',
      contentField = 'content',
      timestampField = 'timestamp',
    } = options;

    const conversations: ParsedConversation[] = [];
    let currentUserMessage = '';
    let conversationIndex = 0;

    for (const msg of messages) {
      const type = msg[userTypeField] as string | undefined;
      const content = msg[contentField] as string | undefined;
      const timestamp = msg[timestampField] as number | undefined;

      if (type === 'user' && content) {
        currentUserMessage = content;
      } else if (
        (type === 'assistant' || msg[assistantTypeField] === 'assistant') &&
        currentUserMessage
      ) {
        conversationIndex++;
        conversations.push({
          index: conversationIndex,
          userMessage: currentUserMessage,
          agentResponse: content ?? '',
          timestamp: timestamp ?? Date.now(),
        });
        currentUserMessage = '';
      }
    }

    return conversations;
  }

  /**
   * Extract todos from parsed messages
   */
  static extractTodos(
    messages: Record<string, unknown>[],
    options: {
      toolNameField?: string;
      todoToolNames?: string[];
      argumentsField?: string;
    } = {}
  ): ParsedTodo[] {
    const {
      toolNameField = 'tool',
      todoToolNames = ['write_todo', 'TodoWrite', 'create_todo'],
      argumentsField = 'arguments',
    } = options;

    const todos: ParsedTodo[] = [];

    for (const msg of messages) {
      const toolName = msg[toolNameField] as string | undefined;

      if (toolName && todoToolNames.includes(toolName)) {
        const args = msg[argumentsField] as Record<string, unknown> | undefined;

        if (args) {
          todos.push({
            id: (args['id'] as string | undefined) ?? `todo_${String(todos.length + 1)}`,
            content: (args['content'] as string | undefined) ?? '',
            status: ((args['status'] as string | undefined) ?? 'pending') as 'pending' | 'in_progress' | 'completed',
            createdAt: (msg['timestamp'] as number | undefined) ?? Date.now(),
          });
        }
      }
    }

    return todos;
  }

  /**
   * Extract tool calls from parsed messages
   */
  static extractToolCalls(
    messages: Record<string, unknown>[],
    options: {
      typeField?: string;
      toolTypeValue?: string;
      toolNameField?: string;
      argumentsField?: string;
      resultField?: string;
      timestampField?: string;
      filePathField?: string;
    } = {}
  ): ParsedToolCall[] {
    const {
      typeField = 'type',
      toolTypeValue = 'tool_use',
      toolNameField = 'tool',
      argumentsField = 'arguments',
      resultField = 'result',
      timestampField = 'timestamp',
      filePathField = 'filePath',
    } = options;

    const toolCalls: ParsedToolCall[] = [];

    for (const msg of messages) {
      if (msg[typeField] === toolTypeValue) {
        toolCalls.push({
          tool: (msg[toolNameField] as string | undefined) ?? 'unknown',
          arguments: (msg[argumentsField] as Record<string, unknown> | undefined) ?? {},
          result: msg[resultField],
          timestamp: (msg[timestampField] as number | undefined) ?? Date.now(),
          filePath: msg[filePathField] as string | undefined,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Create a ParsedSession from extracted data
   */
  static createSession(
    sessionId: string,
    conversations: ParsedConversation[],
    todos: ParsedTodo[],
    toolCalls: ParsedToolCall[],
    startedAt?: number,
    endedAt?: number
  ): ParsedSession {
    return {
      sessionId,
      conversations,
      todos,
      toolCalls,
      startedAt: startedAt ?? Date.now(),
      endedAt,
    };
  }

  /**
   * Merge multiple sessions into one
   */
  static mergeSessions(sessions: ParsedSession[]): ParsedSession {
    if (sessions.length === 0) {
      return this.createSession('empty', [], [], []);
    }

    const firstSession = sessions[0];
    if (sessions.length === 1 && firstSession) {
      return firstSession;
    }

    const merged = this.createSession(
      firstSession?.sessionId ?? 'merged',
      [],
      [],
      [],
      Math.min(...sessions.map((s) => s.startedAt)),
      Math.max(...sessions.filter((s) => s.endedAt !== undefined).map((s) => s.endedAt as number))
    );

    // Merge and renumber conversations
    let conversationIndex = 0;
    for (const session of sessions) {
      for (const conv of session.conversations) {
        conversationIndex++;
        merged.conversations.push({
          ...conv,
          index: conversationIndex,
        });
      }
    }

    // Merge todos (deduplicate by id)
    const todoMap = new Map<string, ParsedTodo>();
    for (const session of sessions) {
      for (const todo of session.todos) {
        todoMap.set(todo.id, todo);
      }
    }
    merged.todos = Array.from(todoMap.values());

    // Merge tool calls
    for (const session of sessions) {
      merged.toolCalls.push(...session.toolCalls);
    }

    // Sort tool calls by timestamp
    merged.toolCalls.sort((a, b) => a.timestamp - b.timestamp);

    return merged;
  }
}
