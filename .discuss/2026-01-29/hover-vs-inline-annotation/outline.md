# Hover Popover vs Inline Annotation Interaction Design Discussion

## 🔵 Current Focus

(Discussion completed)

## ⚪ Pending

(None)

## 📄 Decisions

- [D01-interaction-strategy.md](decisions/D01-interaction-strategy.md) - Hover + Inline Annotation Coexistence Strategy
- [D02-data-flow.md](decisions/D02-data-flow.md) - Data Flow and Matching Mechanism
- [D03-mvp-scope.md](decisions/D03-mvp-scope.md) - MVP Scope Definition
- [D04-hover-content.md](decisions/D04-hover-content.md) - Hover Content Definition

## 🔴 Data Gap Analysis (Resolved)

### ~~Gap 1: Session association for committed code~~

**Decision**: Not needed for MVP, committed code uses git blame for traditional info display

### Gap 2: AgentRecord's addedLines

**Solution**: Calculated from oldContent/newContent diff

## 🔴 Key Insights (This Round)

1. **AI Generation ≠ Immediate Commit**: Users may modify/combine multiple AI results before committing
2. **Uncommitted Code Also Needs Display**: Staging area and working directory AI-generated content should be trackable
3. **Conclusion**: Commit hash association scheme is not feasible, content-level matching mechanism is required

## ✅ Confirmed (New)

- **C03**: Data already exists in `.agent-blame/data/hooks/changes.jsonl`, containing `{sessionId, filePath, newContent}` and other key information

## ✅ Confirmed

- **C01**: Adopt hover + inline annotation coexistence strategy (same as GitLens)
- **C02**: Hover content has two layers: Basic layer (replicate GitLens) + AI-enhanced layer (agent conversation info)
- **C03**: Data already exists in `.agent-blame/data/hooks/changes.jsonl`
- **C04**: Handle two scenarios separately:
  - Committed code → git blame tracing
  - Uncommitted code → Content matching (Levenshtein) to determine AI/Human
- **C05**: MVP focuses on Claude Code first, expand to other Agents later
- **C06**: Committed code directly uses git blame, no need to associate AI session info
- **C07**: addedLines calculated from oldContent/newContent diff
- **C08**: Diff calculation done at Hook storage time (not read time), reducing runtime overhead
- **C09**: MVP version Hover only displays info, no interactive features
- **C10**: AI code Hover displays: Agent name, Session ID, User prompt

## ❌ Rejected

(Empty initially)

---

## 📝 Research Notes

### GitLens Implementation (2026-01-29 Research)

**Core Discovery: GitLens's hover and inline annotation coexist, not mutually exclusive**

1. **Two Independent Mechanisms**
   - `LineHoverController`: Hover provides detailed info
   - `LineAnnotationController`: Line-end decoration provides brief info
   - Has mutex logic to avoid duplicate display

2. **VSCode API**
   - Hover: `languages.registerHoverProvider()` + `MarkdownString`
   - Annotation: `TextEditorDecorationType` + `editor.setDecorations()`

3. **Hover Displayed Information**
   - Commit SHA, author, date
   - Full commit message (supports autolinks)
   - Associated Pull Request
   - Code change diff (changes hover)
   - Command links (Open Changes, etc.)

4. **Configuration Flexibility**
   - `hovers.currentLine.details`: Commit details
   - `hovers.currentLine.changes`: Code changes
   - Users can independently control each feature

### Vibe Review Data Model Analysis

1. **SessionSource** existing fields:
   - `agent`: cursor / claude-code etc.
   - `sessionId`: Session ID
   - `qaIndex`: Conversation round
   - `metadata.userPrompt`: User's original request ✅
   - `metadata.agentResponse`: Agent response summary ✅

2. **ReviewUnit** existing fields:
   - `sessionSource`: Associated session
   - `hunks`: Code changes (including file, line numbers)
   - `annotation`: intent, changes, rationale, etc.

3. **Key Issues**:
   - Current BlameService only returns git blame info
   - Need mechanism to associate commit hash → ReviewUnit
   - Or file + line → ReviewUnit (more precise)

### Existing Matching Implementation (ContributorDetector)

**Complete similarity matching mechanism already exists:**

1. `LevenshteinMatcher`:
   - String/line-level similarity calculation
   - Standardized processing (ignore whitespace differences)
   - Best match search

2. `ContributorDetector`:
   - Three contributor types: `ai` | `ai_modified` | `human`
   - Thresholds: `THRESHOLD_PURE_AI` (high similarity), `THRESHOLD_AI_MODIFIED` (medium similarity)
   - Supports hunk-level detection
   - Includes confidence calculation

3. Data Structures:
   ```typescript
   AgentRecord { sessionSource, filePath, content, addedLines, timestamp }
   ContributorResult { contributor, similarity, confidence, matchedRecord }
   ```

**Conclusion**: Uncommitted code matching logic is already implemented and can be reused directly!
