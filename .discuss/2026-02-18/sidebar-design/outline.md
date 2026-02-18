# AgentLens Sidebar Design Discussion

## 🔵 Current Focus
- Discussion complete, ready for implementation

## ⚪ Pending
(None)

## ✅ Confirmed
- **Sidebar contains two panels**:
  1. Agent connection status
  2. Agent contribution overview + activity log

- **Data sources confirmed**:
  - `CodeChangeRecord`: sessionId, agent, timestamp, toolName, filePath, oldContent, newContent
  - `HookSessionData`: sessionId, agent, startedAt, endedAt, model, cwd
  - `PromptRecord`: sessionId, prompt, timestamp
  - Activity log can display: Agent name, file path, timestamp, line range, associated prompt

- **Technical approach**: TreeView (MVP first, consider WebView later for visualizations)

## ❌ Rejected
- Project-level statistics (not now)
- WebView (not now, use TreeView first)
