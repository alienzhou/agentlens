# Layer 4: Product Delivery Layer

**Related**: [Architecture Overview](./index.md)

---

## Layer Responsibilities

Provide product forms that users directly use, including various clients and integration methods.

---

## Product Forms

### 1. CLI Tool

```bash
# Basic commands
agent-blame diff --annotated
agent-blame review --format=markdown
agent-blame todos --interactive

# Advanced commands
agent-blame analyze --session=latest
agent-blame export --format=json --output=report.json
agent-blame config --set agent=cursor
```

**Features**:
- Zero-configuration startup
- Rich command-line options
- Support for pipeline operations

### 2. VS Code Plugin

```typescript
interface VSCodeExtension {
  activateReviewPanel(): void;
  showInlineAnnotations(document: TextDocument): void;
  highlightReviewUnits(units: ReviewUnit[]): void;
  provideTodoHover(position: Position): Hover;
}
```

**Functions**:
- Sidebar Review panel
- Inline code annotations
- TODO hover hints
- Keyboard shortcut support

### 3. GitLens Integration

**Functions**:
- Display protocol content next to Git blame
- Enhanced hover information
- Custom decorators

### 4. Standalone Panel (Post-MVP)

**Technology Stack**:
- React + TypeScript
- Electron (desktop application)
- Web version (browser)

---

## MVP Interaction Design

Based on **floating window display + command hints** approach for MVP phase:

**Floating Window Content**:
```
┌─────────────────────────────────────┐
│ 📍 Source: Cursor Session #abc123   │
│ 📝 Conversation: Round #3           │
│ 🎯 TODO: Implement login verification│
│                                     │
│ 💡 Jump Commands:                   │
│ Cursor: Ctrl+K → @history abc...    │
│ Claude: /goto conversation abc...   │
└─────────────────────────────────────┘
```

**Note**: Direct jump not implemented in MVP, users can manually execute commands based on hints.

---

## VS Code Plugin Interaction Flow

**Complete interaction flow** (Confirmed in R10):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. VS Code Plugin Startup                                              │
│     ↓                                                                   │
│  2. Auto-detect Local AI IDE Products (Hybrid Detection)                │
│     • Directory detection: ~/.cursor/, ~/.claude/, ~/.gemini/...        │
│     • which command: which cursor, which claude...                      │
│     ↓                                                                   │
│  3. Display Agent List                                                  │
│     ● Cursor        [Connected ✓]  [Disconnect]                         │
│     ● Claude Code   [Detected] [Connect]                                │
│     ● Gemini CLI    [Not Detected] [Connect]                            │
│     ↓                                                                   │
│  4. User Clicks "Connect"                                               │
│     1. Create directory if not exists                                   │
│     2. Write Hook config to platform config file                        │
│     3. Start Session file monitoring                                    │
│     ↓                                                                   │
│  5. Agent Executes Tasks - Dual-Track Data Collection                   │
│     Track 1: Hook Capture (File edits + TODOs)                          │
│     Track 2: Session File Monitoring (Operation history)                │
│     ↓                                                                   │
│  6. Store Locally (.agent-blame/data/)                                  │
│     ↓                                                                   │
│  7. Blame View Display                                                  │
│     Matching: Hunk-level Levenshtein (90% pure AI / 70% modified)       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Decisions** (R10):

| Decision Item | Choice | Notes |
|---------------|--------|-------|
| Detection Strategy | Hybrid Detection | Directory detection + `which` command |
| Connection Status | Check Hook Config | Check if Hook config exists in platform config file |
| Undetected Handling | Create & Connect | Create directory if not exists, then write config |
| Supported Agents | Fixed List | Cursor / Cursor CLI / Claude Code / OpenCode / Gemini CLI |
| Data Collection | Dual-Track | Hook capture + Session file monitoring |
| Matching Algorithm | Levenshtein | Hunk-level, 90%/70% thresholds |
| Blame Display | Rich Content | Contributor type + Source Agent + Session info + TODOs |
| Terminology | "Connect" | Use "Connect" instead of "Install" |

---

## Platform Configuration

| Platform | Config Directory | Config File | File Edit Hook | Stop Hook |
|----------|------------------|-------------|----------------|-----------|
| Cursor | `~/.cursor/` | `hooks.json` | `afterFileEdit` | `stop` |
| Claude Code | `~/.claude/` | `settings.json` | `PostToolUse` (Edit\|Write\|MultiEdit) | `Stop` |
| Gemini CLI | `~/.gemini/` | TBD | TBD | TBD |
| OpenCode | TBD | TBD | TBD | TBD |

---

## Blame Display Content

When code is identified as AI-generated:
1. **Contributor Type**: AI Generated / AI Generated (Human Modified) / Human Contribution
2. **Source Agent**: Which AI IDE generated this code (Cursor / Claude Code / etc.)
3. **Session Info**: Session ID and conversation round
4. **TODOs**: Related TODO items from the Agent's task breakdown

---

## Related Documents

- [Product Core Layer](./03-layer-product-core.md)
- [ADR-007: MVP Interaction Strategy](../adr/ADR-007-interaction.md)
