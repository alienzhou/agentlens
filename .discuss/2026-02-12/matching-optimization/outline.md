# Matching Accuracy and Performance Optimization Discussion

## 🔵 Current Focus
(All core issues have been discussed, Decision documents have been generated)

## ⚪ Pending
(None)

## ✅ Confirmed
- **C1**: Content length similarity as preliminary filter condition ✓
- **C2**: Time window filtering, default 3 days, configurable ✓
- **C3**: File metadata (last edit time) as filter option ✓
- **C4**: Sharded storage (by date/session) to replace single JSONL ✓
- **C5**: Periodic deletion (7/14 days), as an enableable setting ✓
- **C6**: Accuracy troubleshooting approach: Developer mode + Hover error + ID information collection ✓
- **C7**: Report Issue available to all users (not limited to developer mode) ✓
- **C8**: Report Issue data strategy:
  - Content fully retained (hunkContent + matchedRecordContent)
  - Prompt not recorded
  - FilePath records relative path
  - SessionId retained
- **C9**: Report Issue interaction: Only provide "Copy to Clipboard" + "Save to Local" ✓
- **C10**: Merge Copy Debug Info and Report Issue into unified "Report Issue" feature ✓
- **C11**: Report Issue output format: Structured JSON (with readability optimization) ✓
- **C12**: Developer mode additional display: Match ID, Similarity, Confidence, Candidates, Compute time ✓
- **C13**: Report Issue save location: `.agent-blame/reports/YYYY-MM-DD/report-{reportId}.json` ✓
- **C14**: Developer mode includes in generated JSON: filterSteps, performance, allCandidates ✓
- **C15**: Pre-filter logic order: File path → Time window (default 3 days) → Content length (tolerance 50%) ✓
- **C16**: Sharded storage scheme: File by date (`changes/YYYY-MM-DD.jsonl`, `prompts/YYYY-MM-DD.jsonl`) ✓
- **C17**: Periodic cleanup trigger mechanism: Startup check + Background periodic check (default every 24 hours) ✓
- **C18**: RecordId generation strategy: Timestamp (milliseconds) + nanoid (short format) ✓
- **C19**: Performance monitoring mechanism:
  - Collect detailed performance metrics (loading, filtering, Levenshtein, total time)
  - Record in Report Issue JSON and local `performance.jsonl` log
  - Performance threshold 500ms, special marking when exceeded
  - Red warning in Developer mode Hover
  - No proactive alert for now ✓

## ❌ Rejected
- **R1**: Simhash/hash fingerprint fast filtering — computation cost not low, not considering for now
- **R2**: Inverted index — high complexity, not considering for now

---

## 📚 Decision Documents

| ID | Title | Status | File |
|----|-------|--------|------|
| D01 | Performance Optimization Strategy | ✅ Confirmed | [D01-performance-optimization-strategy.md](decisions/D01-performance-optimization-strategy.md) |
| D02 | Report Issue Feature Design | ✅ Confirmed | [D02-report-issue-feature.md](decisions/D02-report-issue-feature.md) |
| D03 | Performance Monitoring Mechanism | ✅ Confirmed | [D03-performance-monitoring.md](decisions/D03-performance-monitoring.md) |

---

## 📊 Current Matching Strategy Analysis

### Existing Implementation

1. **Matching Algorithm**: Levenshtein edit distance
   - Location: `packages/core/src/detection/levenshtein-matcher.ts`
   - Normalization: Ignore whitespace differences
   - Return value: 0-1 similarity score

2. **Matching Granularity**: Hunk level
   - Comparison unit: `GitHunk.addedLines` vs `AgentRecord.addedLines`
   - Traverse all relevant records, find best match

3. **Threshold Settings** (constants.ts):
   - `THRESHOLD_PURE_AI`: 0.9 (≥90% → AI generated)
   - `THRESHOLD_AI_MODIFIED`: 0.7 (70-90% → AI generated but human modified)
   - `<70%` → Human contribution

4. **Pre-filtering**:
   - **Only filter by file path**: `agentRecords.filter(r => r.filePath === hunk.filePath)`
   - No time dimension filtering
   - No content feature filtering

### Storage Structure

- `changes.jsonl`: JSONL format, append-only write
- Fields: `sessionId`, `agent`, `timestamp`, `toolName`, `filePath`, `oldContent`, `newContent`, `success`
- Read method: Full load → Parse line by line → Filter

### Performance Bottlenecks

1. **Full read**: `getAllCodeChanges()` reads entire JSONL file
2. **O(n*m) matching**: Each hunk traverses all relevantRecords
3. **Levenshtein complexity**: O(len1 * len2), high cost for long text
