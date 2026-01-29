# fast-resume Implementation Analysis

**Project**: https://github.com/angristan/fast-resume  
**Analysis Date**: 2026-01-27

---

## 1. Project Positioning

Unified search and recovery of Sessions from multiple AI Coding Agents, supporting:
- Claude Code, Codex, Copilot CLI, Copilot VSCode, Crush, OpenCode, Vibe
- **Does not support Cursor** (needs to be implemented separately)

---

## 2. Core Architecture

### 2.1 Adapter Interface Design

```python
class AgentAdapter(Protocol):
    name: str
    color: str
    badge: str

    def find_sessions(self) -> list[Session]: ...
    def find_sessions_incremental(
        self,
        known: dict[str, tuple[float, str]],
        on_error: ErrorCallback = None,
        on_session: SessionCallback = None,
    ) -> tuple[list[Session], list[str]]: ...
    def get_resume_command(self, session: Session, yolo: bool = False) -> list[str]: ...
    def is_available(self) -> bool: ...
    def get_raw_stats(self) -> RawAdapterStats: ...
```

### 2.2 Session Data Structure

```python
@dataclass
class Session:
    id: str              # Unique identifier
    agent: str           # "claude", "codex", etc.
    title: str           # Summary or first user message
    directory: str       # Working directory
    timestamp: datetime  # Last modification time
    content: str         # Complete conversation text (user + AI)
    message_count: int   # Number of conversation rounds
    mtime: float         # File modification time (for incremental updates)
    yolo: bool           # Whether to start in auto-approve mode
```

### 2.3 Incremental Update Mechanism

```python
def find_sessions_incremental(self, known, on_error, on_session):
    # 1. Scan current files
    current_files = self._scan_session_files()
    
    # 2. Compare mtime, find new/modified
    for session_id, (path, mtime) in current_files.items():
        known_entry = known.get(session_id)
        if known_entry is None or mtime > known_entry[0] + MTIME_TOLERANCE:
            session = self._parse_session_file(path)
            if session:
                new_or_modified.append(session)
                if on_session:
                    on_session(session)  # Progressive callback
    
    # 3. Find deleted sessions
    deleted_ids = [sid for sid in known if sid not in current_files]
    
    return new_or_modified, deleted_ids
```

---

## 3. Claude Code Adapter Details

### 3.1 Storage Location
```
~/.claude/projects/
├── -home-user-project-a/
│   ├── session-id-1.jsonl
│   ├── session-id-2.jsonl
│   └── agent-xxx.jsonl  # Skip (subprocess file)
└── -home-user-project-b/
    └── session-id-3.jsonl
```

### 3.2 JSONL Format

```jsonl
{"type":"user","message":{"role":"user","content":"..."},"cwd":"/path/to/project"}
{"type":"assistant","message":{"role":"assistant","content":"..."}}
{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"xxx"}]}}
```

### 3.3 Parsing Strategy

```python
def _parse_session_file(self, session_file):
    # Key judgment logic:
    # - type == "user" and content is string → real user input
    # - type == "user" and content[0].type == "tool_result" → automatic tool result, not counted
    # - type == "assistant" → AI reply
    
    # Extract content:
    # - User message: messages.append(f"» {content}")
    # - AI message: messages.append(f"  {content}")
    
    # Title: Use first real user message (truncated to 100 characters)
```

### 3.4 Excluded Content

- Tool calls (tool_calls)
- Tool results (tool_result)
- Meta messages (isMeta=True)
- Local commands (`<command`, `<local-command`)

---

## 4. Copilot VSCode Adapter Details

### 4.1 Storage Location
```
~/Library/Application Support/Code/User/
├── globalStorage/emptyWindowChatSessions/  # Empty window sessions
│   └── *.json
└── workspaceStorage/*/chatSessions/        # Workspace sessions
    └── *.json
```

### 4.2 JSON Format

```json
{
  "sessionId": "xxx",
  "customTitle": "...",
  "creationDate": 1234567890000,
  "lastMessageDate": 1234567890000,
  "requests": [
    {
      "message": { "text": "User message" },
      "response": [{ "value": "AI reply" }],
      "contentReferences": [...]
    }
  ]
}
```

### 4.3 Notes

- **Not SQLite**, it's a JSON file
- Does not support `--resume` command, can only open directory

---

## 5. Reference Value for vibe-review

### 5.1 Can Be Directly Reused

| Component | Description |
|------|------|
| Session data structure | Field design is reasonable, can be directly referenced |
| Incremental update mechanism | mtime comparison + progressive callback |
| Claude Adapter | JSONL parsing logic can be directly referenced |

### 5.2 Needs Adjustment

| Component | Differences |
|------|------|
| Tool call parsing | fast-resume excludes, vibe-review needs to retain |
| Cursor Adapter | fast-resume doesn't have it, needs to be implemented separately |
| Monitoring mechanism | fast-resume uses scanning, vibe-review needs real-time monitoring |

### 5.3 Cursor Adapter Implementation Direction

Reference [cursor-session-manager](https://github.com/neosun100/cursor-session-manager):
- Storage location: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- Format: SQLite database
- Need to research specific table structure

---

## 6. Technology Stack Reference

| Component | fast-resume Uses | vibe-review Recommendation |
|------|------------------|------------------|
| JSON parsing | orjson (Rust, 10x faster) | Optional |
| Search engine | Tantivy (Rust) | Not needed for now |
| File monitoring | mtime scanning | chokidar (real-time) |
