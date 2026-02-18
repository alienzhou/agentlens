# Report Issue Feature Design

**Decision Time**: 2026-02-12
**Status**: ✅ Confirmed
**Related Outline**: [Back to Outline](../outline.md)

---

## 📋 Background

### Problem/Requirement

Users have discovered some occasional accuracy issues, but the pattern has not yet been identified. A mechanism is needed:
1. **Allow users to report inaccurate matching**
2. **Collect sufficient information for troubleshooting**
3. **Avoid collecting sensitive information (such as original prompts)**
4. **Facilitate developer tracing and analysis**

Core requirements:
- Developers can troubleshoot problems based on collected information
- Users are willing to provide reports (not too complex)
- Information anonymized to avoid privacy risks

### Constraints

1. **Privacy First**: Cannot collect sensitive prompt content or proprietary code
2. **User Friendly**: Simple operation, no user burden
3. **Traceable**: Collected information sufficient for troubleshooting
4. **Local First**: No automatic upload service required, avoid privacy risks

---

## 🎯 Objective

Design a user-friendly issue reporting mechanism that allows users to quickly report matching issues while collecting sufficient information for developer troubleshooting.

---

## 📊 Solution Comparison

### Feature Scope Comparison

| Solution | Audience | Information Amount | Anonymization Level | Decision |
|----------|----------|---------------------|---------------------|----------|
| Only available in developer mode | Developers | Complete | Low | ❌ |
| Available to all users | Everyone | Complete but configurable | Medium | ✅ |
| Layered (Debug Info + Report) | Layered | Dual | Layered | ❌ |

### Data Collection Strategy Comparison

| Field | Option A (Fully Anonymized) | Option B (Keep Content) | Decision |
|------|-----------------------------|-------------------------|----------|
| hunkContent | SHA256 hash | Keep complete | ✅ B |
| matchedRecordContent | SHA256 hash | Keep complete | ✅ B |
| prompt | Not recorded | Not recorded | ✅ |
| filePath | Not recorded at all | Relative path | ✅ B |
| sessionId | Keep | Keep | ✅ |

**Decision Rationale**:
- Content retention is needed to troubleshoot issues (hash cannot be analyzed)
- User actively reporting bugs indicates willingness to provide information
- Not recording prompts avoids privacy risks
- Relative paths do not expose absolute paths

### Output Format Comparison

| Format | Readability | Programmatic Processing | Decision |
|--------|-------------|--------------------------|----------|
| JSON | Medium | Strong | ✅ |
| Markdown | Strong | Weak | ❌ |
| Hybrid (JSON + readable fields) | Medium-high | Strong | ✅ |

---

## ✅ Final Decision

### Chosen Solution

**Unified Report Issue feature, available to all users, outputs structured JSON**

#### 1. UI Design

**Regular User Hover**:
```
┌──────────────────────────────────────┐
│ AI (Claude Code) · 2 hours ago       │
│ Prompt: "add error handling..."      │
│                                      │
│ [🐛 Report Issue]                   │
└──────────────────────────────────────┘
```

**Developer Mode Hover** (additional debug info):
```
┌──────────────────────────────────────┐
│ AI (Claude Code) · 2 hours ago       │
│ Prompt: "add error handling..."      │
│                                      │
│ 🔍 Debug Info                        │
│ • Match ID: abc123-def456            │
│ • Similarity: 87.3%                  │
│ • Confidence: Medium (0.72)          │
│ • Candidates: 23 → 8 → 5             │
│ • Compute time: 125ms ✓              │
│                                      │
│ [🐛 Report Issue]                   │
└──────────────────────────────────────┘
```

#### 2. Interaction Flow

```
User clicks "🐛 Report Issue"
  ↓
Quick Input pops up (optional)
  "Describe the issue (optional):"
  User inputs: "This looks wrong, I wrote this manually"
  ↓
Select expected result (optional)
  ○ Should be AI
  ● Should be Human
  ○ Wrong record matched
  ↓
Select action
  ○ 📋 Copy to clipboard
  ● 💾 Save to local
  ↓
Done
```

#### 3. Data Structure

```typescript
interface ReportIssue {
  // Basic information
  reportId: string;              // Format: timestamp-nanoid
  timestamp: number;
  timestampHuman: string;        // "2026-02-12 08:58:46"

  // File information
  file: {
    path: string;                // Relative path
    lineRange: [number, number];
  };

  // Code content (fully retained)
  hunk: {
    content: string;             // Complete code content
    lineCount: number;
    charCount: number;
  };

  // Match result
  matchResult: {
    contributor: 'ai' | 'ai_modified' | 'human';
    similarity: number;
    confidence: number;
    matchedRecord?: {
      recordId: string;
      timestamp: number;
      timestampHuman: string;
      sessionId: string;
      agent: string;
      content: string;           // Complete content
    };
  };

  // Candidate information (top 5-10)
  candidates: Array<{
    recordId: string;
    similarity: number;
    timestamp: number;
    timestampHuman: string;
    contentPreview: string;      // First 200 characters
  }>;

  // Session information
  sessionId?: string;
  agent?: string;

  // User feedback
  userFeedback?: {
    comment?: string;
    expectedResult?: 'should_be_ai' | 'should_be_human' | 'wrong_record';
  };

  // Environment information
  environment: {
    agentBlameVersion: string;
    vscodeVersion: string;
    platform: string;
  };

  // Performance data (see D03)
  performance?: PerformanceMetrics;

  // Developer mode extra fields
  debug?: {
    filterSteps: {
      total: number;
      afterFilePathFilter: number;
      afterTimeWindowFilter: number;
      afterLengthFilter: number;
    };
    allCandidates?: Array<{      // Complete candidate list (non-developer mode only keeps top 5)
      recordId: string;
      similarity: number;
      timestamp: number;
    }>;
  };
}
```

#### 4. Save Location

```
.agent-blame/
├── reports/
│   ├── 2026-02-12/
│   │   ├── report-1707707126000-V1StGXR8.json
│   │   └── report-1707707127000-a3F2b9c4.json
│   └── 2026-02-13/
│       └── report-1707793526000-b4G3c8d5.json
```

**Directory by date**:
- Easy to manage and clean up
- Consistent with changes/prompts directory structure

#### 5. Implementation Example

```typescript
class ReportIssueService {
  async generateReport(
    hunk: GitHunk,
    matchResult: ContributorResult,
    candidates: AgentRecord[],
    performance: PerformanceMetrics,
    userFeedback?: UserFeedback
  ): Promise<ReportIssue> {
    const reportId = generateRecordId(Date.now());
    const isDeveloperMode = this.config.developerMode;

    return {
      reportId,
      timestamp: Date.now(),
      timestampHuman: formatTimestamp(Date.now()),

      file: {
        path: hunk.filePath,
        lineRange: [hunk.startLine, hunk.endLine],
      },

      hunk: {
        content: hunk.addedLines.join('\n'),
        lineCount: hunk.addedLines.length,
        charCount: hunk.addedLines.join('\n').length,
      },

      matchResult: {
        contributor: matchResult.contributor,
        similarity: matchResult.similarity,
        confidence: matchResult.confidence,
        matchedRecord: matchResult.matchedRecord ? {
          recordId: matchResult.matchedRecord.id,
          timestamp: matchResult.matchedRecord.timestamp,
          timestampHuman: formatTimestamp(matchResult.matchedRecord.timestamp),
          sessionId: matchResult.matchedRecord.sessionId,
          agent: matchResult.matchedRecord.sessionSource.agent,
          content: matchResult.matchedRecord.addedLines.join('\n'),
        } : undefined,
      },

      candidates: candidates.slice(0, isDeveloperMode ? 10 : 5).map(c => ({
        recordId: c.id,
        similarity: this.calculateSimilarity(hunk, c),
        timestamp: c.timestamp,
        timestampHuman: formatTimestamp(c.timestamp),
        contentPreview: c.addedLines.join('\n').slice(0, 200),
      })),

      userFeedback,

      environment: {
        agentBlameVersion: getExtensionVersion(),
        vscodeVersion: vscode.version,
        platform: process.platform,
      },

      performance,

      debug: isDeveloperMode ? {
        filterSteps: performance.filtering,
        allCandidates: candidates.map(c => ({
          recordId: c.id,
          similarity: this.calculateSimilarity(hunk, c),
          timestamp: c.timestamp,
        })),
      } : undefined,
    };
  }

  async saveReport(report: ReportIssue): Promise<string> {
    const date = new Date(report.timestamp);
    const dateStr = formatDate(date); // "2026-02-12"
    const dir = path.join(this.reportsDir, dateStr);

    await fs.mkdir(dir, { recursive: true });

    const filename = `report-${report.reportId}.json`;
    const filepath = path.join(dir, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8');

    return filepath;
  }

  async copyToClipboard(report: ReportIssue): Promise<void> {
    const json = JSON.stringify(report, null, 2);
    await vscode.env.clipboard.writeText(json);
    vscode.window.showInformationMessage('Report copied to clipboard');
  }
}
```

#### 6. Command Registration

```typescript
export function activate(context: vscode.ExtensionContext) {
  const reportService = new ReportIssueService();

  context.subscriptions.push(
    vscode.commands.registerCommand('agentBlame.reportIssue', async (params) => {
      // Collect user feedback
      const comment = await vscode.window.showInputBox({
        prompt: 'Describe the issue (optional)',
        placeHolder: 'e.g., This code was written by me manually',
      });

      const expectedResult = await vscode.window.showQuickPick([
        { label: 'Should be AI', value: 'should_be_ai' },
        { label: 'Should be Human', value: 'should_be_human' },
        { label: 'Wrong record matched', value: 'wrong_record' },
        { label: 'Skip', value: undefined },
      ], {
        placeHolder: 'Expected correct result (optional)',
      });

      const userFeedback = comment || expectedResult ? {
        comment,
        expectedResult: expectedResult?.value,
      } : undefined;

      // Generate report
      const report = await reportService.generateReport(
        params.hunk,
        params.matchResult,
        params.candidates,
        params.performance,
        userFeedback
      );

      // Select action
      const action = await vscode.window.showQuickPick([
        { label: '📋 Copy to clipboard', value: 'copy' },
        { label: '💾 Save to local', value: 'save' },
      ], {
        placeHolder: 'Select action',
      });

      if (action?.value === 'copy') {
        await reportService.copyToClipboard(report);
      } else if (action?.value === 'save') {
        const filepath = await reportService.saveReport(report);
        vscode.window.showInformationMessage(`Report saved: ${filepath}`);
      }
    })
  );
}
```

### Decision Rationale

1. **Available to All Users**:
   - Need real user feedback to discover patterns in occasional issues
   - Developer mode users are too few, cannot collect enough samples
   - Anonymized data has no privacy risk

2. **Content Fully Retained**:
   - Only complete code can troubleshoot matching issues
   - User actively reporting bugs indicates willingness to provide information
   - Relative paths do not expose absolute paths

3. **Prompt Not Recorded**:
   - Avoid privacy risks (may contain sensitive business logic)
   - Prompt content is not key to troubleshooting matching issues

4. **Unified Function, Enhanced in Developer Mode**:
   - Simplify UI, reduce user confusion
   - Display additional debug info in developer mode
   - Low maintenance cost

5. **Local First**:
   - No automatic upload service needed, avoid privacy risks and service costs
   - User chooses to copy or save
   - Can paste to GitHub Issue or send via email

### Expected Outcome

**User Experience**:
- Simple operation: Complete report in 2-3 steps
- Privacy controllable: No sensitive information recorded
- Low burden: Optional feedback input

**Developer Troubleshooting**:
- Complete information: Code content, match result, candidate list, performance data
- Traceable: Search local logs by recordId
- Analyzable: JSON format facilitates programmatic processing

**Issue Collection**:
- Cover all users, large sample size
- Real scenario feedback, discover occasional issues
- Continuously optimize matching accuracy

---

## ❌ Rejected Solutions

### Layered Function (Copy Debug Info + Report Issue)

- **Rejection Reason**: Duplicate functionality, high maintenance cost, user confusion
- **Reconsideration**: If developers need more internal debug info, can enhance in developer mode instead of separating functions

### Fully Anonymized (Hash Code Content)

- **Rejection Reason**: Cannot troubleshoot issues, loses meaning of report
- **Reconsideration**: If privacy risk becomes main concern, can consider configurable anonymization levels

### Markdown Format Output

- **Rejection Reason**: Hard to process programmatically, not conducive to batch analysis
- **Reconsideration**: Can provide optional "Export as Markdown" feature for human reading

### Automatic Upload Service

- **Rejection Reason**: Privacy risk, service cost, users may not be willing to auto-upload
- **Reconsideration**: If user base is large and willing to cooperate, can consider optional anonymous upload

---

## 🔗 Related Links

- [D01: Performance Optimization Strategy](./D01-performance-optimization-strategy.md)
- [D03: Performance Monitoring Mechanism](./D03-performance-monitoring.md)
