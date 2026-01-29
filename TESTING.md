# Agent Blame Local Testing Verification Manual

## Prerequisites

Ensure the following are installed:
- Node.js >= 22.15.1
- pnpm >= 9.5.0
- Git repository environment

---

## Step 1: Build Project

```bash
cd /Users/zhouhongxuan/program/works/vibe-review
pnpm build
```

**Verification Point:** No compilation errors, all packages built successfully

---

## Step 2: Link CLI to Global

```bash
# Enter cli package directory
cd packages/cli

# Create global symlink
pnpm link --global

# Verify installation success
agent-blame --version
```

**Expected Output:** `0.1.0`

**Verification Point:** `agent-blame --version` returns version number

---

## Step 3: Initialize Target Project

```bash
# Enter the project directory you want to test (can be the current project)
cd $YOUR_PROJECT_DIR

# Initialize agent-blame configuration directory
agent-blame config --init

# View generated directory structure
ls -la .agent-blame/
```

**Expected Directory Structure:**
```
.agent-blame/
├── config/
├── data/
│   ├── sessions/
│   ├── review-units/
│   └── todos.json
```

**Verification Point:** `.agent-blame/` directory created successfully with subdirectories

---

## Step 4: Connect to Claude Code

```bash
# Connect to Claude Code
agent-blame hook connect claude-code

# Check connection status
agent-blame hook status

# View injected configuration
cat ~/.claude/settings.json
```

**Expected Configuration Example:**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "agent-blame hook posttooluse --agent claude-code"
      }]
    }],
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "agent-blame hook sessionstart --agent claude-code"
      }]
    }],
    "SessionEnd": [{
      "hooks": [{
        "type": "command",
        "command": "agent-blame hook sessionend --agent claude-code"
      }]
    }]
  }
}
```

**Verification Points:**
- `agent-blame hook status` shows "Connected"
- `~/.claude/settings.json` contains hook configuration
- Hook commands use `agent-blame` instead of `vibe-review`

---

## Step 5: Verify Data Collection

### 5.1 Start Claude Code and Perform File Edits

1. Open Claude Code
2. Perform file edit operations (Edit/Write/MultiEdit) in any project
3. Hook will automatically trigger and collect data

### 5.2 Check Collected Data

```bash
# View session data
ls -la .agent-blame/data/sessions/

# View code change data (if exists)
cat .agent-blame/data/code-changes.jsonl 2>/dev/null || echo "No code changes yet"

# View hook session data
find .agent-blame/data -name "*.json" -type f | head -5
```

**Verification Points:**
- Files exist in `.agent-blame/data/sessions/` directory
- Data files contain correct session_id, agent, timestamp, and other information

### 5.3 Use CLI to View Diff

```bash
# View annotated diff (if data has been collected)
agent-blame diff --annotated

# View working directory changes
agent-blame diff

# View staged changes
agent-blame diff --staged
```

**Verification Point:** CLI commands execute normally, can display code change information

---

## Step 6: Verify Hook Event Triggers

### 6.1 Manually Test Hook Commands (Optional)

```bash
# Simulate PostToolUse event (requires JSON input)
echo '{"session_id":"test-123","tool_name":"Write","tool_input":{"file_path":"test.ts","content":"test"},"tool_response":{"success":true},"cwd":"/tmp","hook_event_name":"PostToolUse"}' | agent-blame hook posttooluse --agent claude-code

# Check if data was written
ls -la .agent-blame/data/
```

### 6.2 View Hook Logs

Hook commands output logs in the terminal when executed, check for any error messages.

---

## Step 7: Disconnect (Optional)

```bash
# Disconnect from Claude Code
agent-blame hook disconnect claude-code

# Verify disconnected status
agent-blame hook status

# Check if configuration was removed
cat ~/.claude/settings.json
```

**Verification Points:**
- `agent-blame hook status` shows "Detected (not connected)"
- `~/.claude/settings.json` no longer contains agent-blame hook configuration

---

## Step 8: Cleanup (After Testing)

```bash
# Uninstall global link
cd packages/cli
pnpm unlink --global

# Verify uninstallation
agent-blame --version  # Should report command not found
```

---

## Verification Checklist

| Step | Verification Point | Status |
|------|--------|------|
| build | No compilation errors | ⬜ |
| link | `agent-blame --version` returns `0.1.0` | ⬜ |
| init | `.agent-blame/` directory created successfully | ⬜ |
| connect | `~/.claude/settings.json` contains hook configuration | ⬜ |
| connect | Hook commands use `agent-blame` | ⬜ |
| collection | Data files exist under `.agent-blame/data/` | ⬜ |
| collection | Data file format is correct | ⬜ |
| diff | CLI diff command executes normally | ⬜ |
| disconnect | Hook configuration removed correctly | ⬜ |

---

## Troubleshooting

### Issue 1: `agent-blame: command not found`

**Solution:** Ensure `pnpm link --global` has been executed, and `~/.local/share/pnpm/global/5/node_modules/.bin` is in PATH

### Issue 2: Hook Not Triggered

**Check:**
- `~/.claude/settings.json` configuration is correct
- Claude Code has been restarted
- Hook command path is correct (`which agent-blame`)

### Issue 3: Data Not Collected

**Check:**
- `.agent-blame/` directory exists
- File permissions are correct
- Hook command execution has errors (check terminal output)

### Issue 4: Build Failed

**Solution:**
```bash
# Clean and reinstall
pnpm clean
pnpm install --no-frozen-lockfile
pnpm build
```

---

## Next Steps

After completing basic verification, you can:
1. Test data collection in real projects
2. Verify contributor detection functionality
3. Test VS Code extension integration
4. View collected data structure and format
