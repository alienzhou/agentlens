# Performance Optimization Strategy

**Decision Time**: 2026-02-12
**Status**: ✅ Confirmed
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement

The current matching strategy has obvious performance issues:

1. **Full Read Bottleneck**: `getAllCodeChanges()` reads the entire `changes.jsonl` file, data volume keeps growing, load time increases linearly
2. **O(n×m) Matching Complexity**: Each hunk needs to traverse all relevant records and calculate edit distance
3. **No Effective Pre-filtering**: Only filters by file path, cannot narrow down matching scope
4. **Single File Storage**: All change records stored in a single JSONL file, performance degrades over time

User feedback:
- Matching efficiency becomes lower and lower when processing uncommitted content
- Need to filter out irrelevant data as much as possible before matching

### Constraints

1. **Cannot Compromise Accuracy**: Optimization cannot reduce matching accuracy
2. **Controllable Computation Cost**: Do not introduce complex indexing or hashing algorithms (Simhash, inverted index, etc.)
3. **Low Implementation Cost**: Prioritize simple, high-impact solutions
4. **Compatibility**: Need to support migration of existing data

---

## 🎯 Objective

Through multi-layer filtering and storage optimization, improve matching performance to acceptable range without compromising accuracy (target: <500ms)

---

## 📊 Solution Comparison

### Filtering Strategy Comparison

| Solution | Implementation Difficulty | Expected Benefit | Computation Cost | Decision |
|----------|----------------------------|------------------|------------------|----------|
| Time window filtering | Low | High | Very low (timestamp comparison) | ✅ |
| Content length filtering | Low | Medium | Very low (numeric comparison) | ✅ |
| File metadata filtering | Medium | Medium | Medium (requires git call) | ⏸️ Deferred |
| Simhash fast filtering | Medium | High | Medium-high | ❌ |
| Inverted index | High | High | High | ❌ |

### Storage Scheme Comparison

| Solution | Directory Structure | Pros | Cons | Decision |
|----------|---------------------|------|------|----------|
| File by date | `changes/YYYY-MM-DD.jsonl` | Simple, easy to clean up, works with time window filtering | Cross-day session scattered | ✅ |
| File by session | `changes/session-{id}.jsonl` | Session data complete | Hard to clean up by time, many files | ❌ |
| By date+session | `changes/YYYY-MM-DD/session-{id}.jsonl` | Balances both | Complex directory structure | ❌ |

---

## ✅ Final Decision

### Chosen Solution

**Layered Filtering + Sharded Storage + Periodic Cleanup**

#### 1. Pre-filter Logic (Four-level Filtering)

```typescript
function filterCandidates(hunk: GitHunk, allRecords: CodeChangeRecord[], config: Config) {
  let candidates = allRecords;

  // Level 1: File path filtering (existing)
  candidates = candidates.filter(r => r.filePath === hunk.filePath);

  // Level 2: Time window filtering (new)
  const timeWindowMs = config.timeWindowDays * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - timeWindowMs;
  candidates = candidates.filter(r => r.timestamp >= cutoffTime);

  // Level 3: Content length filtering (new)
  const hunkLength = hunk.addedLines.join('\n').length;
  const lengthTolerance = 0.5; // 50% tolerance
  candidates = candidates.filter(r => {
    const recordLength = r.addedLines.join('\n').length;
    const ratio = Math.max(hunkLength, recordLength) / Math.min(hunkLength, recordLength);
    return ratio <= (1 + lengthTolerance);
  });

  // Level 4: Levenshtein matching (existing)
  return findBestMatch(hunk, candidates);
}
```

**Configuration**:
```json
{
  "agentBlame.matching": {
    "timeWindowDays": 3,        // Default 3 days, configurable
    "lengthTolerance": 0.5      // Length tolerance 50%
  }
}
```

#### 2. Sharded Storage (by Date)

**Directory Structure**:
```
.agent-blame/data/hooks/
├── changes/
│   ├── 2026-02-10.jsonl
│   ├── 2026-02-11.jsonl
│   └── 2026-02-12.jsonl
├── prompts/
│   ├── 2026-02-10.jsonl
│   ├── 2026-02-11.jsonl
│   └── 2026-02-12.jsonl
└── sessions.json
```

**Read Logic**:
```typescript
async getRecentCodeChanges(timeWindowDays: number): Promise<CodeChangeRecord[]> {
  const records: CodeChangeRecord[] = [];
  const today = new Date();

  for (let i = 0; i < timeWindowDays; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date); // "2026-02-12"

    const filePath = path.join(this.changesDir, `${dateStr}.jsonl`);
    const fileRecords = await this.readJSONL(filePath);
    records.push(...fileRecords);
  }

  return records;
}
```

#### 3. Periodic Cleanup

**Trigger Mechanism**:
- ✅ Startup check (when VSCode extension activates)
- ✅ Background periodic check (every 24 hours)
- ✅ Manual command: `agentBlame.cleanup`

**Configuration**:
```json
{
  "agentBlame.autoCleanup": {
    "enabled": true,
    "retentionDays": 7,          // Keep last 7 days
    "checkIntervalHours": 24     // Check every 24 hours
  }
}
```

**Implementation Example**:
```typescript
class CleanupManager {
  private lastCleanupTime = 0;

  async tryCleanup(force = false) {
    const now = Date.now();
    const config = await getConfig();

    if (!config.autoCleanup.enabled && !force) {
      return;
    }

    const intervalMs = config.autoCleanup.checkIntervalHours * 60 * 60 * 1000;
    if (!force && (now - this.lastCleanupTime) < intervalMs) {
      return; // Not time for check yet
    }

    await this.cleanup(config.autoCleanup.retentionDays);
    this.lastCleanupTime = now;
  }

  private async cleanup(retentionDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete expired date files
    for (const dir of ['changes', 'prompts']) {
      const files = await fs.readdir(path.join(this.hookDataPath, dir));

      for (const file of files) {
        const match = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
        if (match) {
          const fileDate = new Date(match[1]);
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.hookDataPath, dir, file));
          }
        }
      }
    }
  }
}
```

#### 4. RecordId Generation Strategy

**Format**: `{timestamp}-{nanoid}`

```typescript
import { nanoid } from 'nanoid';

function generateRecordId(timestamp: number): string {
  const nanoId = nanoid(8); // Generate 8-character nanoid
  return `${timestamp}-${nanoId}`;
}

// Example output
// 1707707126000-V1StGXR8
// 1707707127000-a3F2b9c4
```

**Interface Change**:
```typescript
export interface CodeChangeRecord {
  id: string;              // New field
  sessionId: string;
  agent: string;
  timestamp: number;
  toolName: string;
  filePath: string;
  oldContent?: string;
  newContent?: string;
  success: boolean;
}
```

### Decision Rationale

1. **Time Window Filtering Has Highest Benefit**:
   - Uncommitted code is usually recent changes, matching last 3 days is sufficient
   - Simple implementation (timestamp comparison), very low computation cost
   - Works with sharded storage, only need to read files from last N days

2. **Content Length Filtering Has Low Cost**:
   - Code with large length difference cannot have high similarity
   - Pure numeric comparison, no additional computation cost

3. **Sharded Storage Facilitates Cleanup and Reading**:
   - File by date, periodic cleanup only needs to delete expired files
   - When filtering by time window, directly read corresponding date files
   - Single file size controllable, avoid infinite growth

4. **Periodic Cleanup Prevents Data Bloat**:
   - Automatically clean expired data, maintain stable performance
   - Configurable retention days, balance performance and traceability needs

5. **RecordId Facilitates Tracing**:
   - Timestamp prefix easy for human understanding and sorting
   - nanoid guarantees uniqueness
   - Used for issue tracing in Report Issue

### Expected Outcome

**Performance Improvement Expectation**:
- Data loading: From full read to time window read, reduce 70-90% of load
- Candidate count: Through length filtering, reduce 30-50% of Levenshtein calculations
- Total time: Expected to drop from 200-500ms to 50-150ms

**Accuracy Guarantee**:
- Time window of 3 days covers majority of uncommitted code scenarios
- Length tolerance of 50% will not mistakenly filter correct matches
- Levenshtein algorithm unchanged, accuracy not affected

**Storage Controllability**:
- Single day file size controllable (estimated 1-10MB)
- Automatic cleanup keeps total data volume stable (7 days ≈ 7-70MB)

---

## ❌ Rejected Solutions

### Simhash/Hash Fingerprint Fast Filtering

- **Rejection Reason**: Computation cost not low, medium implementation complexity, benefit not obviously better than time window + length filtering
- **Reconsideration**: Can consider introducing if performance issues persist after time window + length filtering

### Inverted Index

- **Rejection Reason**: High implementation complexity, high maintenance cost, requires additional storage space
- **Reconsideration**: Can consider when data volume grows to millions

### File Metadata Filtering

- **Rejection Reason**: Requires git calls, relatively high cost, benefit not obvious
- **Reconsideration**: Temporarily deferred, not implemented in first version

### Sharded Storage by Session

- **Rejection Reason**: Hard to clean up by time, many files, not conducive to time window reading
- **Reconsideration**: Can consider hybrid approach if complete session tracing is needed

---

## 🔗 Related Links

- [D02: Report Issue Feature Design](./D02-report-issue-feature.md)
- [D03: Performance Monitoring Mechanism](./D03-performance-monitoring.md)
