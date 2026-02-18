# Performance Monitoring Mechanism

**Decision Time**: 2026-02-12
**Status**: ✅ Confirmed
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement

During the process of optimizing matching performance, a mechanism is needed to:
1. **Monitor matching performance**: Understand the time cost of each match
2. **Identify performance bottlenecks**: Know which stage (loading, filtering, Levenshtein) is most time-consuming
3. **Track performance trends**: Discover performance regression or optimization effectiveness
4. **Locate performance issues**: When users report performance issues, be able to troubleshoot specific causes

User requirements:
- List performance data in debug info
- Be able to expose so developers can identify performance issues
- Include in Report Issue and also in local logs
- Continuously track performance issues

### Constraints

1. **Performance monitoring itself cannot affect performance**: Measurement code overhead should be as minimal as possible
2. **Controllable data volume**: Cannot record performance logs indefinitely
3. **Privacy protection**: Performance logs do not contain code content
4. **Easy to analyze**: Data structure facilitates programmatic analysis

---

## 🎯 Objective

Design a lightweight performance monitoring mechanism that can:
- Record detailed performance data for each match
- Store in Report Issue and local logs
- Support performance trend analysis and troubleshooting
- Minimize impact on matching performance

---

## 📊 Solution Comparison

### Monitoring Granularity Comparison

| Granularity | Information Amount | Overhead | Decision |
|-------------|-------------------|----------|----------|
| Total time only | Low | Very low | ❌ |
| Stage-by-stage time | Medium | Low | ✅ |
| Each Levenshtein call time | High | Medium | ✅ (Developer mode) |

### Storage Method Comparison

| Method | Query Efficiency | Storage Cost | Decision |
|--------|-------------------|--------------|----------|
| Only in Report Issue | Low (manual report) | Low | ❌ |
| Local JSONL log | High | Medium | ✅ |
| Database | Very high | High | ❌ |

### Alert Mechanism Comparison

| Solution | User Experience | Implementation Complexity | Decision |
|----------|------------------|-------------------------|----------|
| Active popup alert | Disturbing | Low | ❌ |
| Log marking + Hover red highlight | Non-disturbing | Low | ✅ |
| No alert | No awareness | Very low | ❌ |

---

## ✅ Final Decision

### Chosen Solution

**Layered Performance Monitoring: Detailed Metrics + Local Logs + Visual Alerts**

#### 1. Performance Metrics Definition

```typescript
interface PerformanceMetrics {
  // Overall performance
  totalMs: number;                    // Total time (milliseconds)
  warning: boolean;                   // Whether exceeded threshold
  warningReason?: string;             // Warning reason
  threshold: number;                  // Threshold (default 500ms)

  // Data loading stage
  dataLoading: {
    loadAllRecordsMs: number;         // Time to load records
    recordCount: number;              // Total records loaded
    fileSizeKB: number;               // File size read
  };

  // Filtering stage (each step)
  filtering: {
    // File path filtering
    filePathFilterMs: number;
    filePathCandidates: number;       // Count after filtering

    // Time window filtering
    timeWindowFilterMs: number;
    timeWindowCandidates: number;

    // Length filtering
    lengthFilterMs: number;
    lengthCandidates: number;
  };

  // Similarity calculation stage
  similarity: {
    levenshteinTotalMs: number;       // Total Levenshtein time
    levenshteinCallCount: number;     // Number of calls (= candidate count)
    avgLevenshteinMs: number;         // Average time per call
    maxLevenshteinMs: number;         // Longest single call time

    avgContentLength: number;         // Average content length
    maxContentLength: number;         // Maximum content length
  };

  // Match result
  result: {
    bestSimilarity: number;           // Best similarity
    candidatesProcessed: number;      // Candidates processed
    matched: boolean;                 // Whether matched successfully
  };

  // Performance analysis (auto-generated when threshold exceeded)
  analysis?: {
    bottleneck: 'loading' | 'filtering' | 'levenshtein';
    suggestion: string;
    breakdown: {
      loadingPercent: number;
      filteringPercent: number;
      levenshteinPercent: number;
    };
  };

  // Context information
  timestamp: number;
  filePath: string;
  hunkLineCount: number;
}
```

#### 2. Performance Tracking Implementation

```typescript
class PerformanceTracker {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private lastStepTime: number;
  private threshold: number;

  constructor(config: Config) {
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;
    this.threshold = config.performance?.warningThresholdMs ?? 500;

    this.metrics = {
      totalMs: 0,
      warning: false,
      threshold: this.threshold,
      dataLoading: { loadAllRecordsMs: 0, recordCount: 0, fileSizeKB: 0 },
      filtering: {
        filePathFilterMs: 0,
        filePathCandidates: 0,
        timeWindowFilterMs: 0,
        timeWindowCandidates: 0,
        lengthFilterMs: 0,
        lengthCandidates: 0,
      },
      similarity: {
        levenshteinTotalMs: 0,
        levenshteinCallCount: 0,
        avgLevenshteinMs: 0,
        maxLevenshteinMs: 0,
        avgContentLength: 0,
        maxContentLength: 0,
      },
      result: {
        bestSimilarity: 0,
        candidatesProcessed: 0,
        matched: false,
      },
      timestamp: Date.now(),
      filePath: '',
      hunkLineCount: 0,
    };
  }

  recordDataLoading(recordCount: number, fileSizeKB: number) {
    const now = performance.now();
    this.metrics.dataLoading.loadAllRecordsMs = now - this.lastStepTime;
    this.metrics.dataLoading.recordCount = recordCount;
    this.metrics.dataLoading.fileSizeKB = fileSizeKB;
    this.lastStepTime = now;
  }

  recordFilterStep(
    step: 'filePath' | 'timeWindow' | 'length',
    candidatesAfter: number
  ) {
    const now = performance.now();
    const stepMs = now - this.lastStepTime;

    this.metrics.filtering[`${step}FilterMs`] = stepMs;
    this.metrics.filtering[`${step}Candidates`] = candidatesAfter;

    this.lastStepTime = now;
  }

  recordLevenshteinCall(durationMs: number, contentLength: number) {
    this.metrics.similarity.levenshteinTotalMs += durationMs;
    this.metrics.similarity.levenshteinCallCount++;

    if (durationMs > this.metrics.similarity.maxLevenshteinMs) {
      this.metrics.similarity.maxLevenshteinMs = durationMs;
    }

    if (contentLength > this.metrics.similarity.maxContentLength) {
      this.metrics.similarity.maxContentLength = contentLength;
    }
  }

  recordResult(bestSimilarity: number, matched: boolean) {
    this.metrics.result.bestSimilarity = bestSimilarity;
    this.metrics.result.candidatesProcessed = this.metrics.similarity.levenshteinCallCount;
    this.metrics.result.matched = matched;
  }

  async finalize(): Promise<PerformanceMetrics> {
    this.metrics.totalMs = performance.now() - this.startTime;

    // Calculate averages
    if (this.metrics.similarity.levenshteinCallCount > 0) {
      this.metrics.similarity.avgLevenshteinMs =
        this.metrics.similarity.levenshteinTotalMs /
        this.metrics.similarity.levenshteinCallCount;
    }

    // Check if threshold exceeded
    if (this.metrics.totalMs > this.threshold) {
      this.metrics.warning = true;
      this.metrics.warningReason = `Performance exceeded ${this.threshold}ms threshold`;
      this.metrics.analysis = this.analyzeBottleneck();
    }

    // Save to performance log
    await this.saveToLog();

    return this.metrics;
  }

  private analyzeBottleneck(): PerformanceMetrics['analysis'] {
    const total = this.metrics.totalMs;
    const loading = this.metrics.dataLoading.loadAllRecordsMs;
    const filtering =
      this.metrics.filtering.filePathFilterMs +
      this.metrics.filtering.timeWindowFilterMs +
      this.metrics.filtering.lengthFilterMs;
    const levenshtein = this.metrics.similarity.levenshteinTotalMs;

    const breakdown = {
      loadingPercent: (loading / total) * 100,
      filteringPercent: (filtering / total) * 100,
      levenshteinPercent: (levenshtein / total) * 100,
    };

    let bottleneck: 'loading' | 'filtering' | 'levenshtein';
    let suggestion: string;

    if (breakdown.levenshteinPercent > 70) {
      bottleneck = 'levenshtein';
      suggestion = `Large number of candidates (${this.metrics.similarity.levenshteinCallCount}) caused slow Levenshtein matching. Consider tightening time window filter or reducing length tolerance.`;
    } else if (breakdown.loadingPercent > 50) {
      bottleneck = 'loading';
      suggestion = `Loading ${this.metrics.dataLoading.recordCount} records took ${loading.toFixed(0)}ms. Consider reducing retention days or implementing more aggressive cleanup.`;
    } else {
      bottleneck = 'filtering';
      suggestion = `Filtering took ${filtering.toFixed(0)}ms. Check if filter logic can be optimized.`;
    }

    return { bottleneck, suggestion, breakdown };
  }

  private async saveToLog(): Promise<void> {
    const logPath = path.join(this.config.dataPath, 'logs', 'performance.jsonl');

    // Simplified log entry (remove redundant fields)
    const logEntry = {
      timestamp: this.metrics.timestamp,
      totalMs: this.metrics.totalMs,
      warning: this.metrics.warning,
      filtering: {
        filePathCandidates: this.metrics.filtering.filePathCandidates,
        timeWindowCandidates: this.metrics.filtering.timeWindowCandidates,
        lengthCandidates: this.metrics.filtering.lengthCandidates,
      },
      similarity: {
        levenshteinTotalMs: this.metrics.similarity.levenshteinTotalMs,
        callCount: this.metrics.similarity.levenshteinCallCount,
        avgMs: this.metrics.similarity.avgLevenshteinMs,
      },
      result: {
        matched: this.metrics.result.matched,
      },
    };

    const line = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  }
}
```

#### 3. Usage Example

```typescript
async detect(hunk: GitHunk, agentRecords: AgentRecord[]): Promise<ContributorResult> {
  const tracker = new PerformanceTracker(this.config);

  // 1. Load data
  const startLoad = performance.now();
  const records = await this.loadRecords();
  tracker.recordDataLoading(records.length, this.calculateFileSize(records));

  // 2. File path filtering
  const filtered1 = records.filter(r => r.filePath === hunk.filePath);
  tracker.recordFilterStep('filePath', filtered1.length);

  // 3. Time window filtering
  const filtered2 = this.filterByTimeWindow(filtered1);
  tracker.recordFilterStep('timeWindow', filtered2.length);

  // 4. Length filtering
  const filtered3 = this.filterByLength(filtered2, hunk);
  tracker.recordFilterStep('length', filtered3.length);

  // 5. Levenshtein matching
  let bestMatch: AgentRecord | undefined;
  let bestSimilarity = 0;

  for (const record of filtered3) {
    const startLev = performance.now();
    const similarity = this.matcher.calculate(hunk.content, record.content);
    const levDuration = performance.now() - startLev;

    tracker.recordLevenshteinCall(levDuration, record.content.length);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = record;
    }
  }

  // 6. Record result
  tracker.recordResult(bestSimilarity, !!bestMatch);

  // 7. Finalize tracking
  const performance = await tracker.finalize();

  // 8. Return result (include performance data)
  return {
    ...this.determineContributor(hunk.id, bestSimilarity, bestMatch),
    performance, // Attach performance data
  };
}
```

#### 4. Developer Mode Hover Display

**Normal case** (<500ms):
```
🔍 Debug Info
• Match ID: abc123-def456
• Similarity: 87.3%
• Candidates: 23 → 8 → 5
• Compute time: 125ms ✓
  ├─ Loading: 15ms (127 records)
  ├─ Filtering: 12ms
  └─ Levenshtein: 98ms (5 calls)
```

**Exceeded threshold** (≥500ms):
```
🔍 Debug Info
• Match ID: abc123-def456
• Similarity: 87.3%
• Candidates: 127 → 45 → 23
⚠️  Compute time: 650ms (SLOW)
  ├─ Loading: 45ms (1,245 records)
  ├─ Filtering: 28ms
  └─ Levenshtein: 577ms (23 calls) ⚠️

💡 Bottleneck: Levenshtein (88.8%)
Suggestion: Large number of candidates caused slow matching.
Consider tightening time window filter.
```

#### 5. Local Performance Log

**Location**: `.agent-blame/logs/performance.jsonl`

**Format**:
```jsonl
{"timestamp":1707707126000,"totalMs":125,"warning":false,"filtering":{"filePathCandidates":23,"timeWindowCandidates":8,"lengthCandidates":5},"similarity":{"levenshteinTotalMs":98,"callCount":5,"avgMs":19.6},"result":{"matched":true}}
{"timestamp":1707707127000,"totalMs":650,"warning":true,"filtering":{"filePathCandidates":127,"timeWindowCandidates":45,"lengthCandidates":23},"similarity":{"levenshteinTotalMs":577,"callCount":23,"avgMs":25.1},"result":{"matched":true}}
```

**Log management**:
- Like `changes.jsonl`, clean up periodically as needed
- Or shard by date: `logs/performance-YYYY-MM-DD.jsonl`

#### 6. Performance Log Analysis

**View performance trends**:
```bash
# Average time for last 100 matches
cat .agent-blame/logs/performance.jsonl | tail -100 | jq '.totalMs' | awk '{sum+=$1; count++} END {print sum/count}'

# Output: 156.3
```

**Discover performance regression**:
```bash
# Find matches exceeding 500ms
cat .agent-blame/logs/performance.jsonl | jq 'select(.totalMs > 500)'

# Output:
# {"timestamp":1707707127000,"totalMs":650,...}
# {"timestamp":1707707456000,"totalMs":720,...}
```

**Analyze bottlenecks**:
```bash
# Calculate percentage of Levenshtein time to total time
cat .agent-blame/logs/performance.jsonl | jq '{total: .totalMs, lev: .similarity.levenshteinTotalMs, ratio: (.similarity.levenshteinTotalMs / .totalMs * 100)}'

# Output:
# {"total":125,"lev":98,"ratio":78.4}
# {"total":650,"lev":577,"ratio":88.8}
```

**Candidate count trends**:
```bash
# View filtering effectiveness
cat .agent-blame/logs/performance.jsonl | jq '{filePath: .filtering.filePathCandidates, timeWindow: .filtering.timeWindowCandidates, length: .filtering.lengthCandidates}'

# Output:
# {"filePath":23,"timeWindow":8,"length":5}
# {"filePath":127,"timeWindow":45,"length":23}
```

#### 7. Configuration Items

```json
{
  "agentBlame.performance": {
    "logEnabled": true,              // Whether to record performance logs
    "logRetentionDays": 7,           // Log retention days
    "warningThresholdMs": 500,        // Performance warning threshold
    "showInHover": true,             // Whether to show performance info in developer mode hover
    "showAnalysis": true             // Whether to show performance analysis suggestions
  }
}
```

### Decision Rationale

1. **Stage-by-stage monitoring granularity is appropriate**:
   - Can identify specific bottlenecks (loading, filtering, Levenshtein)
   - Low overhead (only `performance.now()` calls)
   - Sufficient information to troubleshoot issues

2. **Local JSONL logs facilitate analysis**:
   - Simple file operations, low performance overhead
   - Facilitates programmatic analysis (jq, awk, etc.)
   - Consistent with `changes.jsonl`, unified management

3. **Visual alerts do not disturb users**:
   - No active popups, avoids disturbance
   - Only visible in Hover when developers are checking
   - Red highlight when threshold exceeded, visually prominent

4. **Automatic bottleneck analysis improves efficiency**:
   - Automatically identify main bottleneck (loading/filtering/levenshtein)
   - Provide targeted suggestions
   - Reduce manual analysis cost

5. **500ms threshold is reasonable**:
   - Normal matching expected 50-150ms
   - Above 500ms is clearly perceptible
   - Can be adjusted based on actual data later

### Expected Outcome

**Performance Visibility**:
- Detailed performance data for each match
- Clear bottleneck identification
- Long-term performance trend analysis

**Troubleshooting**:
- When users report performance issues, complete performance data visible through Report Issue
- Local logs support batch analysis, discover performance patterns
- Automatic suggestions help quickly identify optimization direction

**Continuous Optimization**:
- Validate optimization effectiveness through log analysis
- Discover time points of performance regression
- Data-driven optimization decisions

---

## ❌ Rejected Solutions

### Active Popup Alert

- **Rejection Reason**: Disturbs users, poor experience
- **Reconsideration**: If performance issues are severe and widespread, can consider configurable warning prompts

### Database Storage for Performance Logs

- **Rejection Reason**: Introduces additional dependencies, complex implementation, JSONL is sufficient
- **Reconsideration**: If complex queries needed (e.g., aggregate by file, by time range), can consider SQLite

### Record Detailed Info for Every Levenshtein Call

- **Rejection Reason**: Data volume too large, log files will expand quickly
- **Reconsideration**: Can provide more detailed log levels in developer mode

### No Performance Alert Mechanism

- **Rejection Reason**: Users and developers cannot perceive performance issues
- **Reconsideration**: If threshold setting causes false positives, can consider removing alerts

---

## 🔗 Related Links

- [D01: Performance Optimization Strategy](./D01-performance-optimization-strategy.md)
- [D02: Report Issue Feature Design](./D02-report-issue-feature.md)
