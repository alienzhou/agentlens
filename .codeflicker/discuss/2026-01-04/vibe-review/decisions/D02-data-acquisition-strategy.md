# Data Acquisition Strategy - Hook + Skill Dual-Track

**Decision Date**: #R5  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

**Date**: 2026-01-04


---

## Background

Vibe Review needs to acquire two types of data:
1. **Execution Trace Data**: What Agent did (tool calls, file changes, decision points)
2. **Protocol Content Data**: Why Agent did this (Intent, Rationale, Tests, etc.)

Traditional solutions can only choose one, we adopt **Dual-Track System** to acquire both types of data simultaneously.

---

## Core Solution: Dual-Track

```
┌─────────────────────────────────────────────────────┐
│  Data Acquisition: Dual-Track                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Track 1: Hook (Passive Collection)                │
│  ├─ Source: Hook API provided by AGENTS framework      │
│  ├─ Data: Execution trace, tool calls, file changes, timeline │
│  ├─ Implementation: Connect to different Agents through adapter layer │
│  └─ Features: Non-invasive to Agent, objective recording │
│                                                     │
│  Track 2: Skill (Active Generation)                    │
│  ├─ Source: Called on-demand during Agent execution    │
│  ├─ Data: WHAT/WHY/HOW TO VERIFY/IMPACT                   │
│  ├─ Implementation: Mounted to execution flow as an Agent skill │
│  └─ Features: Agent active output, complies with protocol standard │
│                                                     │
│  Post-Processing: Data Fusion                           │
│  ├─ Merge dual-track data                                 │
│  ├─ Engineering metrics based on Hook (e.g., file count)         │
│  ├─ Mark conflicts specifically                              │
│  └─ Generate final Review protocol                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Detailed Design

### 1. Hook Implementation

#### 1.1 Core Design

```typescript
// Vibe Review Hook Core
interface VibeReviewHook {
  // Lifecycle hooks
  onTaskStart(context: TaskContext): void;
  onToolCall(tool: string, args: any, result: any): void;
  onFileChange(file: string, diff: Diff): void;
  onDecisionPoint(decision: Decision): void;
  onTaskEnd(result: TaskResult): void;
  
  // Data export
  exportExecutionTrace(): ExecutionTrace;
}
```

#### 1.2 Adapter Layer Design

```
┌─────────────────────────────────────────────────────┐
│  Vibe Review Hook Core (Core)                      │
│  ├─ Define unified Hook interface                        │
│  └─ Provide data collection and export capability         │
└─────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Cursor Adapter│   │ Claude Adapter│   │ Duet Adapter  │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ - Monitor      │   │ - Monitor     │   │ - Monitor     │
│   Cursor Hook  │   │   Claude Hook │   │   Duet Hook   │
│   API         │   │   API         │   │   API         │
│ - Convert to  │   │ - Convert to  │   │ - Convert to  │
│   unified     │   │   unified     │   │   unified     │
│   format      │   │   format      │   │   format      │
└───────────────┘   └───────────────┘   └───────────────┘
```

**User Installation Method**:
```bash
# Install in Cursor
vibe-review install --agent cursor

# Install in Claude
vibe-review install --agent claude

# Install in Duet
vibe-review install --agent duet
```

#### 1.3 Collected Data

```typescript
interface ExecutionTrace {
  // Basic information
  taskId: string;
  agentName: string;
  startTime: string;
  endTime: string;
  
  // Execution trace
  timeline: Array<{
    timestamp: string;
    type: 'tool_call' | 'file_change' | 'decision' | 'other';
    data: any;
  }>;
  
  // File changes (engineering metrics)
  fileChanges: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    diff: string;
  }>;
  
  // Tool calls
  toolCalls: Array<{
    tool: string;
    args: any;
    result: any;
    timestamp: string;
  }>;
}
```

---

### 2. Skill Implementation

#### 2.1 Core Design

Skill as **Open Protocol Standard**, allowing Agent to generate protocol content on-demand during execution.

```yaml
# vibe-review-skill.yaml
name: vibe-review-protocol-generator
version: 1.0.0
description: Generate Vibe Review protocol content

# Trigger timing
triggers:
  - on_task_complete  # When task completes
  - on_user_request   # When user requests
  - on_file_change    # When file changes (optional)

# Generated content
outputs:
  - type: protocol
    format: markdown
    schema: vibe-review-protocol-v0.3
```

#### 2.2 Skill Mounting Method

```
┌─────────────────────────────────────────────────────┐
│  Agent Execution Flow                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Read task                                        │
│  2. Read Rule (know to follow Vibe Review protocol)               │
│  3. Execute task                                        │
│     ├─ Call various tools                                 │
│     └─ Generate code                                      │
│  4. Call Skill: vibe-review-protocol-generator               │
│     ├─ Generate WHAT (Intent, Changes)                         │
│     ├─ Generate WHY (Rationale)                                │
│     ├─ Generate HOW TO VERIFY (Tests, Edge Cases)              │
│     └─ Generate IMPACT (optional)                                  │
│  5. Output result                                        │
│     ├─ Code changes                                      │
│     └─ Protocol content (Markdown)                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### 2.3 Skill Generated Data

```markdown
## Vibe Review Protocol

### WHAT
**Intent**: I understand you want to do X
**Changes**: I changed A, B, C

### WHY
**Rationale**: I chose solution X because...

### HOW TO VERIFY
**Tests**: You can verify through these tests
**Edge Cases**: These edge cases need confirmation

### IMPACT (optional)
This may affect D, E
```

---

### 3. Skill and Rule Collaboration

```
┌─────────────────────────────────────────────────────┐
│  Rule (Specification Layer)                            │
│  ├─ Definition: Agent must follow Vibe Review protocol                   │
│  ├─ Location: AGENTS.md or independent vibe-review.rule.yaml          │
│  └─ Content:                                                  │
│     - Which fields must be generated                                      │
│     - Format requirements                                              │
│     - Trigger timing                                              │
└─────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────┐
│  Skill (Implementation Layer)                                  │
│  ├─ Definition: How to generate protocol content                            │
│  ├─ Location: skills/vibe-review-protocol-generator/            │
│  └─ Content:                                                  │
│     - Specific generation logic                                        │
│     - Prompt templates                                           │
│     - Output formatting                                            │
└─────────────────────────────────────────────────────┘
```

**Collaboration Method**:
1. **Rule Definition Requirements**: Agent must generate Vibe Review protocol when task completes
2. **Skill Implementation Logic**: Provide specific methods for generating protocol
3. **Agent Execution**: Read Rule → Call Skill → Generate protocol

---

### 4. Conflict Handling Strategy

#### 4.1 Engineering Metrics Conflicts

**Principle**: Engineering metrics based on actual data collected by Hook

```typescript
// Example: File count conflict
const hookData = { filesChanged: 5 };  // Collected by Hook
const skillData = { filesChanged: 3 }; // Generated by Skill

// Handling
const result = {
  filesChanged: hookData.filesChanged, // Based on Hook
  conflict: {
    type: 'file_count_mismatch',
    hookValue: 5,
    skillValue: 3,
    resolution: 'use_hook_value',
    note: 'Agent may have missed explanation for 2 files'
  }
};
```

#### 4.2 Other Conflicts

**Principle**: Record first, resolve specifically later

```typescript
interface Conflict {
  type: string;
  hookValue: any;
  skillValue: any;
  resolution: 'use_hook' | 'use_skill' | 'manual_review' | 'pending';
  note: string;
}
```

**Conflict Types**:
- `file_count_mismatch`: File count inconsistent → Use Hook
- `intent_unclear`: Intent not clear → Mark as need manual confirmation
- `test_missing`: Missing test description → Mark as need supplement
- `impact_unknown`: Impact scope unknown → Mark as need analysis

---

### 5. Adapter Layer Implementation

#### 5.1 Why Need Adapter Layer?

Different Agents have different Hook APIs:
- **Cursor**: May provide Hook through Extension API
- **Claude**: May provide Hook through MCP protocol
- **Duet**: May provide Hook through custom event system

#### 5.2 Adapter Layer Interface

```typescript
// Unified interface
interface AgentAdapter {
  name: string;
  version: string;
  
  // Installation
  install(): Promise<void>;
  
  // Event monitoring
  onTaskStart(callback: (ctx: TaskContext) => void): void;
  onToolCall(callback: (tool: ToolCall) => void): void;
  onFileChange(callback: (change: FileChange) => void): void;
  onTaskEnd(callback: (result: TaskResult) => void): void;
  
  // Data export
  exportTrace(): ExecutionTrace;
}

// Cursor adapter example
class CursorAdapter implements AgentAdapter {
  name = 'cursor';
  version = '1.0.0';
  
  async install() {
    // Register Cursor's Extension Hook
    vscode.workspace.onDidChangeTextDocument((e) => {
      this.handleFileChange(e);
    });
  }
  
  // ... other implementations
}
```

---

## Data Flow Diagram

```
User initiates task
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Agent Execution                                         │
│  ├─ Read Rule: Must generate Vibe Review protocol                   │
│  ├─ Execute task                                        │
│  └─ Call Skill: Generate protocol content                       │
└─────────────────────────────────────────────────────┘
    │                           │
    │ Hook collection                 │ Skill output
    ▼                           ▼
┌─────────────┐           ┌─────────────┐
│ Execution   │           │ Protocol    │
│ Trace      │           │ Content     │
│ Data       │           │             │
│             │           │ - Intent    │
│ - Tool calls│           │ - Changes   │
│ - File changes│          │ - Rationale │
│ - Decision points│         │ - Tests     │
│ - Timeline  │           │ - ...       │
└─────────────┘           └─────────────┘
    │                           │
    └───────────┬───────────────┘
                ▼
┌─────────────────────────────────────────────────────┐
│  Post-Processing Layer                               │
│  ├─ Merge data                                        │
│  ├─ Conflict detection                                │
│  │   ├─ Engineering metrics → Based on Hook                             │
│  │   └─ Other conflicts → Mark as pending processing                               │
│  ├─ Data supplement                                  │
│  │   └─ Use Hook data to supplement information missing from Skill                   │
│  └─ Generate final protocol                            │
└─────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────┐
│  Final Output                                       │
│  ├─ Complete Review protocol (Markdown)                          │
│  ├─ Execution trace visualization                                  │
│  ├─ Conflict report (if any)                                      │
│  └─ Metadata (time, Agent info, etc.)                            │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1: MVP (Minimum Viable Version)

**Goal**: Verify feasibility of dual-track system

- [ ] Hook Core: Define unified interface
- [ ] Cursor Adapter: Implement first adapter
- [ ] Skill: Basic protocol generation (required fields)
- [ ] Post-processing: Simple merge, file count conflict handling

### Phase 2: Enhanced Version

**Goal**: Support more Agents, enhance conflict handling

- [ ] Claude Adapter
- [ ] Duet Adapter
- [ ] Skill: Add optional fields
- [ ] Post-processing: More conflict type handling

### Phase 3: Complete Version

**Goal**: Production level

- [ ] More Agent adapters
- [ ] Skill standardization (open protocol)
- [ ] Intelligent conflict resolution
- [ ] Visualization tools

---

## Key Decision Records

### Why Use Hook Instead of Log Parsing?

**Decision**: Use Hook API provided by AGENTS framework

**Reasons**:
1. Hook API is more reliable, does not depend on log format
2. Can get structured data instead of text parsing
3. Different Agents are all providing Hook capabilities

### Why Skill as Open Protocol?

**Decision**: Skill as open protocol standard, not hard-coded

**Reasons**:
1. Let different Agents all be able to implement
2. Community can extend and improve
3. Reduce coupling, improve flexibility

### Why Need Adapter Layer?

**Decision**: Adapt to each Agent separately instead of unified interface

**Reasons**:
1. Different Agents have different Hook requirements
2. Adapter layer can be optimized specifically
3. Reduce invasiveness to Agent

---

## Association with Other Decisions

| Related Decision | Association Explanation |
|-----------------|----------------------|
| [Agent Review Protocol](./D01-agent-review-protocol.md) | Defines structure of protocol content |
| [Skill and Rule Collaboration](./D03-skill-rule-collaboration.md) | Skill is one track of dual-track system |
| [MVP Strategy](./D04-mvp-strategy.md) | Phase 0 implement Hook Core + Adapter |

---

## Next Steps

1. Design Hook Core interface
2. Implement Cursor Adapter (first adapter)
3. Define Skill standard (comply with Agent Skills protocol)
4. Implement post-processing logic

---


---

**Last Updated**: 2026-01-04
