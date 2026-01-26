# Core Mechanisms

**Related**: [Architecture Overview](./index.md)

---

## 1. Agent Review Protocol v0.3

### Protocol Structure

```markdown
## WHAT
**Intent**: [One-sentence intent description]
**Changes**: 
- [File 1]: [Change description]
- [File 2]: [Change description]

## WHY
**Rationale**: [Design rationale and decision basis]

## HOW TO VERIFY
**Tests**:
1. [Test step 1]
2. [Test step 2]

**Edge Cases**:
- [Edge case 1]
- [Edge case 2]

## IMPACT
**Affected Areas**: [Other modules or systems affected]
**Risks**: [Potential risks]
```

### Protocol Example

**Scenario**: Adding "Remember Me" feature to login page

```markdown
## WHAT
**Intent**: Add "Remember Me" feature to login page
**Changes**: 
- `src/components/LoginForm.tsx`: Add checkbox component and state management
- `src/hooks/useAuth.ts`: Add rememberMe parameter and localStorage logic

## WHY
**Rationale**: 
- User feedback wants to avoid frequent login
- Store token in localStorage, expires in 7 days
- Checkbox unchecked by default, follows security best practices

## HOW TO VERIFY
**Tests**:
1. Check "Remember Me" to login, refresh page should maintain login state
2. Uncheck to login, refresh page should redirect to login page
3. Token should automatically expire after 7 days

**Edge Cases**:
- User clears browser data
- localStorage is disabled
- Compatibility when token format changes

## IMPACT
**Affected Areas**: 
- Login flow: added state branches
- Security policy: need to consider token leakage risks

**Risks**: 
- Token in localStorage may be accessed by malicious scripts
```

### Protocol Generation (Post-MVP)

> **Note**: Protocol content generation via Skill is planned for Post-MVP phase.
> In MVP, we focus on data collection (Hook + Session monitoring) and Blame display.

---

## 2. MVP Data Collection: Hook + Session Monitoring

### Hook Mechanism

```typescript
interface HookCore {
  registerAdapter(agent: string, adapter: AgentAdapter): void;
  startSession(sessionId: string): void;
  captureEvent(event: AgentEvent): void;
  endSession(sessionId: string): HookData;
}

interface AgentAdapter {
  name: string;
  version: string;
  hooks: {
    onSessionStart?: (sessionId: string) => void;
    onCodeChange?: (change: CodeChange) => void;
    onUserPrompt?: (prompt: string) => void;
    onAgentResponse?: (response: string) => void;
    onSessionEnd?: (sessionId: string) => void;
  };
}
```

**Supported Agents**:

| Agent | Adapter | Status |
|-------|---------|--------|
| Cursor | CursorAdapter | ✅ Supported |
| Cursor CLI | CursorCLIAdapter | ✅ Supported |
| Claude Code | ClaudeCodeAdapter | ✅ Supported |
| OpenCode | OpenCodeAdapter | 🔄 Planned |
| Gemini CLI | GeminiCLIAdapter | 🔄 Planned |

### Session Monitoring

```typescript
interface SessionMonitor {
  watchSessionFiles(agent: AgentConfig): void;
  parseSessionData(filePath: string): SessionData;
  mergeWithHookData(hookData: HookData, sessionData: SessionData): MergedData;
}

interface SessionData {
  sessionId: string;
  operations: Array<{
    timestamp: number;
    type: 'prompt' | 'response' | 'tool_call' | 'file_edit';
    content: any;
  }>;
  todos: TodoItem[];
}
```

---

## 3. Data Fusion Mechanism (MVP)

MVP focuses on fusing Hook data and Session monitoring data.

### Fusion Strategy

```typescript
interface FusionStrategy {
  // Timestamp fusion: follow Hook
  mergeTimestamp(hookTime: number, skillTime: number): number;
  
  // File path fusion: follow Hook
  mergeFilePaths(hookPaths: string[], skillPaths: string[]): string[];
  
  // Protocol content fusion: follow Skill (Post-MVP)
  mergeProtocolContent(hookContent: any, skillContent: AgentProtocol): AgentProtocol;
  
  // Conflict detection
  detectConflicts(hookData: HookData, sessionData: SessionData): DataConflict[];
}
```

### Conflict Resolution

```typescript
interface ConflictResolver {
  resolveTimestampConflict(conflict: TimestampConflict): Resolution;
  resolveContentConflict(conflict: ContentConflict): Resolution;
  logUnresolvedConflict(conflict: DataConflict): void;
}

type Resolution = 
  | { action: 'use_hook_data' }
  | { action: 'use_session_data' }
  | { action: 'merge_data'; strategy: MergeStrategy }
  | { action: 'manual_review'; reason: string };
```

---

## Related Documents

- [Tool Layer](./01-layer-tool.md)
- [ADR-001: Protocol Design](../adr/ADR-001-protocol.md)
- [ADR-002: Data Acquisition](../adr/ADR-002-data-acquisition.md)
