# D02: Data Flow and Matching Mechanism

## Decision

Handle two scenarios separately, using different data sources and matching mechanisms:

### Scenario 1: Committed Code

- **Data Source**: git blame
- **Returned Info**: author, timestamp, commitHash, message
- **Processing**: Direct display, no AI session association (MVP simplification)

### Scenario 2: Uncommitted Code

- **Data Source**: `.agent-blame/data/hooks/changes.jsonl`
- **Matching Mechanism**: Levenshtein similarity matching (reuse `ContributorDetector`)
- **Result Classification**:
  - `ai`: Similarity >= 90%, pure AI generated
  - `ai_modified`: Similarity 70-90%, AI generated but human modified
  - `human`: Similarity < 70%, human written

## Data Structures

Storage Layer (CodeChangeRecord):

```typescript
{
  sessionId: string;
  agent: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  addedLines: string[];  // Calculated at storage time
  timestamp: number;
}
```

Consumption Layer (AgentRecord):

```typescript
{
  id: string;
  sessionSource: { agent, sessionId, qaIndex, timestamp };
  filePath: string;
  content: string;
  addedLines: string[];
  timestamp: number;
}
```

## addedLines Calculation

- **Timing**: Calculated at Hook storage time (not read time)
- **Method**: diff(oldContent, newContent)
- **Reason**: Read is high-frequency operation, write is low-frequency operation, calculating at storage time reduces runtime overhead

## Status

✅ Confirmed
