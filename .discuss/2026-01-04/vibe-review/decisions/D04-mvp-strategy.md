# MVP Strategy - Tool Layer → Data Layer Validation → Product Core

**Decision Date**: #R7  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

**Date**: 2026-01-04


---

## Background

Vibe Review adopts 4-layer architecture (Tool Layer / Data Layer / Product Core Layer / Product Delivery Layer). MVP strategy is:
1. First do Tool Layer (data acquisition)
2. Develop small tools to validate data layer (generate reports, pages, documentation)
3. After validation passes, develop Product Core Layer

---

## Core Decisions

### 1. Phased Strategy

```
┌─────────────────────────────────────────────┐
│  MVP Phased Strategy                          │
├─────────────────────────────────────────────┤
│                                             │
│  Phase 0: Tool Layer (2-3 weeks)                       │
│  ├─ vibe-review-core Skill                            │
│  ├─ Hook Core + first Adapter                        │
│  └─ Data fusion logic                                   │
│                                             │
│  Phase 1: Data Layer Validation (2-3 weeks)           │
│  ├─ Terminal tool: agent-blame diff --annotated              │
│  ├─ Verify if data model is correct                             │
│  └─ Verify if data is helpful for Review                            │
│                                             │
│  Phase 2: Product Core Layer (4-6 weeks)           │
│  ├─ Protocol parser                                           │
│  ├─ Rendering engine                                             │
│  └─ Interaction logic                                               │
│                                             │
│  Phase 3: Product Delivery Layer (Future)              │
│  ├─ VS Code plugin                                            │
│  ├─ GitLens integration                                         │
│  └─ CLI improvement                                                │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 2. Data Model Design

#### 2.1 Core Concepts

```
┌─────────────────────────────────────────────┐
│  Data Model Core Concepts                   │
├─────────────────────────────────────────────┤
│                                             │
│  SessionSource (Session Source)                          │
│  ├─ agent: Which Agent (cursor/claude/duet)                 │
│  ├─ sessionId: Session ID                                       │
│  ├─ qaIndex: Which round of QA conversation                           │
│  └─ timestamp: Timestamp                                       │
│                                             │
│  ReviewUnit (Review Unit)                                │
│  ├─ May contain multiple Hunks (multiple code segments represent one logical change)       │
│  ├─ Associate with SessionSource (source tracing)                          │
│  ├─ Contains annotations (intent/rationale/risks/tests/edgeCases)      │
│  └─ Associate with TODOs                                              │
│                                             │
│  Todo (Pending Items)                                         │
│  ├─ Separate persisted storage                                  │
│  ├─ Associate with SessionSource (source tracing)                          │
│  ├─ Associate with ReviewUnits (bidirectional index)                            │
│  └─ Support click to locate conversation                                      │
│                                             │
└─────────────────────────────────────────────┘
```

#### 2.2 TypeScript Type Definitions

```typescript
// Session source information
interface SessionSource {
  agent: 'cursor' | 'claude' | 'duet' | string;
  sessionId: string;
  qaIndex: number;
  timestamp: string;
  
  // Optional: conversation content summary
  userQuery?: string;
  agentSummary?: string;
}

// Code block
interface DiffHunk {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
}

// Review unit (may contain multiple Hunks)
interface ReviewUnit {
  id: string;
  
  // Associated Hunks (multiple Hunks may represent one logical change)
  hunks: DiffHunk[];
  
  // Source tracing
  source: SessionSource;
  
  // Annotation content
  annotations: {
    intent: string;
    rationale?: string;
    risks?: Array<{
      level: 'high' | 'medium' | 'low';
      description: string;
    }>;
    tests?: string[];
    edgeCases?: string[];
    confidence?: 'high' | 'medium' | 'low';
  };
  
  // Associated TODOs
  todoIds: string[];
}

// TODO data structure
interface Todo {
  id: string;
  description: string;
  status: 'pending' | 'confirmed' | 'rejected';
  
  // Source tracing
  source: SessionSource;
  
  // Associated Review Units (bidirectional index)
  relatedUnitIds: string[];
  
  // Extra information
  extra?: {
    priority?: 'high' | 'medium' | 'low';
    assignee?: string;
    dueDate?: string;
    notes?: string;
  };
}

// Complete Review data
interface VibeReviewData {
  // Meta information
  meta: {
    projectId: string;
    createdAt: string;
    updatedAt: string;
  };
  
  // Global protocol content
  protocol: {
    intent: string;
    rationale: string;
    tests: string[];
    edgeCases: string[];
    impact?: string;
  };
  
  // Review Units (Hunk level, can be combined)
  units: ReviewUnit[];
  
  // TODOs (separate storage, supports click to locate)
  todos: Todo[];
  
  // Session history (for tracing)
  sessions: SessionSource[];
}
```

---

### 3. Storage Structure

```
.agent-blame/
├── data/
│   ├── review-{timestamp}.json    # Complete Review data
│   └── todos.json                 # TODOs separate storage (supports cross-Review)
├── rule.yaml                      # Rule definition
└── skills/                        # Project-level Skills
    └── ...
```

**todos.json Example**:

```json
{
  "version": "0.3.0",
  "todos": [
    {
      "id": "T1",
      "description": "Confirm fallback handling in private mode",
      "status": "pending",
      "source": {
        "agent": "cursor",
        "sessionId": "abc123",
        "qaIndex": 3,
        "timestamp": "2026-01-04T14:30:00Z",
        "userQuery": "Add remember me function to login page",
        "agentSummary": "Added checkbox and localStorage storage"
      },
      "relatedUnitIds": ["U1", "U2"],
      "extra": {
        "priority": "medium",
        "notes": "Need to test Safari private mode"
      }
    }
  ]
}
```

---

### 4. Terminal Output Format

```bash
$ agent-blame diff --annotated

╭──────────────────────────────────────────────────────╮
│  Vibe Review Report                                 │
│  📅 2026-01-04 14:30                                     │
│  🤖 Agent: cursor | Session: abc123 | QA: #3                   │
╰──────────────────────────────────────────────────────╯

═══════════════════════════════════════════════════════════
  📁 src/pages/Login.tsx
  └─ Source: cursor / session:abc123 / QA:#3
═════════════════════════════════════════════════════════════
  
  [U1] Add "remember me" state management
  ├─ 🎯 Goal: Read saved username on initialization
  ├─ ⚠️  Risk: 🟡 Medium - localStorage may not be available in private mode
  ├─ ✅ Verify: After refreshing page username should auto-fill
  └─ ❓ TODO: #T1 Confirm fallback handling in private mode
  
  @@ -15,6 +15,20 @@
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
  + const [rememberMe, setRememberMe] = useState(false);
  +
  + useEffect(() => {
  +   const saved = localStorage.getItem('remembered_user');
  +   if (saved) setUsername(saved);
  + }, []);

──────────────────────────────────────────────────────────────
  
  [U2] Save username on login
  ├─ 🎯 Goal: Save/clear username based on checkbox status when login succeeds
  ├─ 💡 Decision: Actively clear when unchecked to avoid residue
  ├─ ✅ Verify: Unchecked → Login → Refresh → Username should be empty
  └─ ❓ TODO: #T2 Confirm if username encryption is needed
  
  @@ -45,6 +59,15 @@
    const handleSubmit = async () => {
  +   if (rememberMe) {
  +     localStorage.setItem('remembered_user', username);
  +   } else {
  +     localStorage.removeItem('remembered_user');
  +   }
      await login(username, password);
    };

═════════════════════════════════════════════════════════════
  📁 src/utils/storage.ts (new file)
  └─ Source: cursor / session:abc123 / QA:#3
═══════════════════════════════════════════════════════════════
  
  [U3] localStorage utility functions
  ├─ 🎯 Goal: Encapsulate localStorage, handle exception cases
  ├─ 💡 Decision: try-catch for exceptions in private mode
  ├─ ⚠️  Risk: 🟢 Low
  └─ ✅ Confidence: High
  
  @@ -0,0 +1,20 @@
  + export const storage = {
  +   get: (key: string) => {
  +     try {
  +       return localStorage.getItem(key);
  +     } catch {
  +       return null;
  +     }
  +   },
  +   ...
  + };

═══════════════════════════════════════════════════════════════
  📋 TODOs (2 pending items)
═══════════════════════════════════════════════════════════════
  
  ❓ #T1 Confirm fallback handling in private mode
         ├─ Source: cursor / session:abc123 / QA:#3
         ├─ Related: [U1] Login.tsx:18-22
         └─ Priority: 🟡 Medium

  ❓ #T2 Confirm if username encryption is needed
         ├─ Source: cursor / session:abc123 / QA:#3
         ├─ Related: [U2] Login.tsx:50-55
         └─ Priority: 🟡 Medium

═══════════════════════════════════════════════════════════════
  📊 Statistics
═══════════════════════════════════════════════════════════════
  
  Files changed: 2
  Review Units: 3
  TODOs: 2 pending
  Risk distribution: 🟢 1 Low | 🟡 1 Medium | 🔴 0 High
  Confidence distribution: ✅ 2 High | ⚠️ 1 Medium | ❓ 0 Low
```

---

### 5. Git Integration Method

**Choice**: Direct Git API call (using simple-git)

```typescript
import simpleGit from 'simple-git';

const git = simpleGit();

// Get structured diff
const diff = await git.diff(['--unified=3', 'HEAD~1']);

// Parse into Hunk structure
const hunks = parseDiff(diff);
```

**Reasons**:
1. Structured data, easy to process
2. Can get more meta information (commit hash, author, etc.)
3. Cross-platform compatible

---

### 6. Multi-Hunk Combination

**Introduce ReviewUnit Concept**:

```
Hunk 1 ─┐
Hunk 2 ─┼─→ ReviewUnit 1 (one logical change)
Hunk 3 ─┘

Hunk 4 ────→ ReviewUnit 2 (another logical change)
```

**Association Method**:
- When Skill generates, output ReviewUnit-level annotations
- Each ReviewUnit contains references to multiple Hunks
- Each ReviewUnit has its own source tracing

---

### 7. TODO Bidirectional Index

```typescript
// TODO → ReviewUnit
todo.relatedUnitIds = ['U1', 'U2'];

// ReviewUnit → TODO
reviewUnit.todoIds = ['T1'];
```

**Supported Operations**:
- Click TODO → Locate to related Hunks
- Click Hunk → Locate to related TODOs
- Click TODO → Locate to conversation (via source.sessionId + qaIndex)

---

## Key Decision Records

### Why Tool Layer First?

**Decision**: Complete data acquisition capability first, then validate data value

**Reasons**:
1. Data is the foundation of everything
2. First verify if data model is correct
3. Avoid building product on wrong data model

### Why Terminal Validation?

**Decision**: Phase 1 uses terminal output to validate data

**Reasons**:
1. Lowest development cost
2. Quickly verify if data is useful
3. No UI development needed

### Why Separate TODO Storage?

**Decision**: TODOs separately persisted to todos.json

**Reasons**:
1. Support clicking Hunk → Locate to conversation's TODO
2. Support cross-Review TODO management
3. Support TODO status updates (doesn't affect Review data)

### Why Introduce ReviewUnit?

**Decision**: Multiple Hunks can compose a ReviewUnit

**Reasons**:
1. One logical change may span multiple code blocks
2. Annotations should be at logical change level, not code block level
3. More aligned with human Review thinking

---

## Association with Other Decisions

| Related Decision | Association Explanation |
|-----------------|----------------------|
| [Agent Review Protocol](./D01-agent-review-protocol.md) | Protocol content as annotation of ReviewUnit |
| [Data Acquisition Strategy](./D02-data-acquisition-strategy.md) | Phase 0 implement Hook + Skill |
| [Skill and Rule Collaboration](./D03-skill-rule-collaboration.md) | Phase 0 implement vibe-review-core Skill |

---

## Next Steps

### Phase 0: Tool Layer (2-3 weeks)

1. **Week 1**:
   - [ ] Implement vibe-review-core Skill
   - [ ] Define data model TypeScript types

2. **Week 2**:
   - [ ] Implement Hook Core
   - [ ] Implement first Adapter (Cursor or Claude)
   - [ ] Implement data fusion logic

3. **Week 3**:
   - [ ] Implement terminal output
   - [ ] Test complete flow

---


---

**Last Updated**: 2026-01-04
