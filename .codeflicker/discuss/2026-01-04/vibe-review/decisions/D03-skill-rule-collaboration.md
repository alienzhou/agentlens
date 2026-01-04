# Skill and Rule Collaboration

**Decision Date**: #R6  
**Status**: ✅ Confirmed  
**Related Outline**: [Back to Outline](../outline.md)

---

**Date**: 2026-01-04


---

## Background

In the Vibe Review system, we need to make Agents automatically generate protocol content when executing tasks. This requires two mechanisms working together:
- **Rule**: Tells the Agent "what you must do"
- **Skill**: Tells the Agent "how to do it"

---

## Core Decisions

### 1. Rule Location: AGENTS.md + Independent File

```
┌─────────────────────────────────────────────────────┐
│  Rule Definition Method                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  AGENTS.md (Declaration Layer)                        │
│  ├─ Declare use of Vibe Review protocol                  │
│  ├─ Point to independent rule file                     │
│  └─ Concise, no details                              │
│                                                     │
│  vibe-review.rule.yaml (Definition Layer)              │
│  ├─ Protocol version                                 │
│  ├─ Required fields                                 │
│  ├─ Optional fields                                 │
│  ├─ Format requirements                              │
│  └─ Trigger timing                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### AGENTS.md Example

```markdown
# AGENTS.md

## Rules

### Vibe Review Protocol
Generate code change descriptions using Vibe Review protocol.

- Rule file: `.vibe-review/rule.yaml`
- Skill files: `.vibe-review/skills/`
- Protocol version: 0.3

When task completes, must call `vibe-review-core` Skill to generate protocol content.
```

#### vibe-review.rule.yaml Example

```yaml
# .vibe-review/rule.yaml
name: vibe-review-protocol
version: 0.3.0
description: Vibe Review protocol rule definition

# Trigger timing
triggers:
  - event: task_complete
    action: generate_protocol

# Required fields
required_fields:
  what:
    - intent      # What I understand you want to do
    - changes     # Which files I changed
  why:
    - rationale   # Why I designed it this way
  verify:
    - tests       # How to verify
    - edge_cases  # Edge cases

# Optional fields
optional_fields:
  impact:
    - side_effects  # Possible side effects
    - affected_modules  # Affected modules
  alternatives:
    - rejected_options  # Rejected solutions
    - reasons  # Rejection reasons
  confidence:
    - high_confidence  # High confidence parts
    - low_confidence   # Low confidence parts
  meta:
    - scope   # Change scale
    - risk    # Risk level
    - hint    # Review hints

# Format requirements
format:
  type: markdown
  template: protocol-template.md

# Associated Skills
skills:
  core: vibe-review-core@0.3.0
  optional:
    - vibe-review-impact@0.3.0
    - vibe-review-alternatives@0.3.0
```

---

### 2. Trigger Method: Agent Autonomous Call

```
┌─────────────────────────────────────────────────────┐
│  Agent Execution Flow                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Agent starts                                     │
│     └─ Read AGENTS.md, discover need to follow Vibe Review protocol        │
│                                                     │
│  2. Agent reads rules                                │
│     └─ Load .vibe-review/rule.yaml                       │
│                                                     │
│  3. Agent executes task                               │
│     ├─ Call various tools                          │
│     ├─ Generate code                                  │
│     └─ Record execution process (for Skill to use)                          │
│                                                     │
│  4. When task completes, Agent autonomously calls Skill                       │
│     ├─ Call vibe-review-core (required)                        │
│     │   └─ Generate WHAT / WHY / HOW TO VERIFY                  │
│     └─ Call optional Skills as needed                               │
│         ├─ vibe-review-impact (if there are side effects)               │
│         └─ vibe-review-alternatives (if there are multiple solutions)       │
│                                                     │
│  5. Agent output                                        │
│     ├─ Code changes                                   │
│     └─ Vibe Review protocol content                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Why Agent Autonomous Call?**
- Agent understands execution context best
- Agent can judge which optional Skills need to be called
- No external system intervention needed

---

### 3. Skill Granularity: Core + Optional

**Follow Agent Skills Protocol** (https://agentskills.io/specification): Use `SKILL.md` format (YAML frontmatter + Markdown body)

```
┌─────────────────────────────────────────────────────┐
│  Skill Organization Structure (Follows Agent Skills Protocol)                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ~/.claude/skills/                       # Global Skills      │
│  ├─ vibe-review-core/                    [Required]             │
│  │   ├─ SKILL.md                         # Skill definition       │
│  │   └─ references/                      # Optional: reference docs   │
│  │       └─ protocol-template.md                            │
│  │                                                          │
│  ├─ vibe-review-impact/                  [Optional]             │
│  │   └─ SKILL.md                                            │
│  │                                                          │
│  ├─ vibe-review-alternatives/            [Optional]             │
│  │   └─ SKILL.md                                            │
│  │                                                          │
│  └─ vibe-review-confidence/              [Optional]             │
│      └─ SKILL.md                                            │
│                                                     │
│  Or Project-level Skills:                                         │
│  .vibe-review/skills/                    # Project-level Skills    │
│  ├─ vibe-review-core/SKILL.md                               │
│  └─ ...                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Agent Skills Protocol Key Points

According to https://agentskills.io/specification:

| Field | Required | Constraints |
|-------|----------|------------|
| `name` | ✅ | Max 64 chars, lowercase+numbers+hyphens, cannot start/end with hyphen |
| `description` | ✅ | Max 1024 chars, describe functionality and usage scenarios |
| `license` | ❌ | License name or file reference |
| `compatibility` | ❌ | Max 500 chars, environment requirements |
| `metadata` | ❌ | Arbitrary key-value pairs |
| `allowed-tools` | ❌ | Space-separated pre-approved tool list (experimental) |

**Progressive Disclosure**:
1. **Metadata** (~100 tokens): Load all Skill names and descriptions at startup
2. **Instructions** (< 5000 tokens): Load complete SKILL.md when activated
3. **Resources** (On-demand): Load scripts/, references/, assets/ as needed

**Best Practices**:
- Keep SKILL.md under 500 lines
- Put detailed reference materials in references/ directory

#### vibe-review-core Skill Definition (Follows Agent Skills Protocol)

```markdown
---
name: vibe-review-core
description: Generates Vibe Review protocol content (WHAT/WHY/HOW TO VERIFY) after code changes. Use when completing coding tasks to explain intent, changes, rationale, and verification steps.
license: MIT
compatibility: Designed for Claude Code, Cursor, and similar AI coding assistants
metadata:
  author: vibe-review
  version: "0.3.0"
  category: code-review
allowed-tools: Read Write Bash(git:*)
---

# Vibe Review Core - Protocol Core Content Generation

## 📋 Function Positioning

Generate **core content** of Vibe Review protocol after Agent completes code change tasks.

**Core Value**:
- 📝 **Intent Explanation**: Explain user requirements as understood by Agent
- 🔧 **Change List**: List all changed files
- 💡 **Design Rationale**: Explain why designed this way
- ✅ **Verification Methods**: Provide tests and edge cases

---

## 🎯 Applicable Scenarios

### ✅ When to Call

| Scenario | Call or Not |
|----------|-------------|
| Task completes with code changes | ✅ Required |
| Task completes without code changes | ❌ Do not call |
| Task in progress | ❌ Do not call |

---

## 📥 Input Data

When calling this Skill, need to provide following context:

1. **Task Description**: User's original requirements
2. **Execution Context**: Agent's execution process
3. **File Change List**: All changed files

---

## 📤 Output Format

Generate following Markdown format protocol content:

```markdown
## Vibe Review Protocol v0.3

### WHAT
**Intent**: [What I understand you want to do]

**Changes**:
- `[file path]`: [change description]
- ...

### WHY
**Rationale**: 
- [reason 1]
- [reason 2]

### HOW TO VERIFY
**Tests**:
- [test step 1]
- [test step 2]

**Edge Cases**:
- [edge case 1]
- [edge case 2]
```

---

## 📝 Generation Guidelines

### Intent Generation Rules
- Summarize user requirements in one sentence
- Use "You want..." sentence pattern
- Avoid technical details

### Changes Generation Rules
- List all changed files
- Describe changes with one sentence per file
- Sort by importance

### Rationale Generation Rules
- Explain key design decisions
- Explain why chose this solution
- If there are trade-offs, explain trade-off points

### Tests Generation Rules
- Provide executable test steps
- Cover main functional paths
- Use "→" to indicate expected results

### Edge Cases Generation Rules
- List possible edge cases
- Mark points needing user confirmation
- Use question form

---

## 🔗 Collaboration with Other Skills

| Collaboration Target | Collaboration Method |
|-------------------|---------------------|
| **vibe-review-impact** | Optional, generate impact scope analysis |
| **vibe-review-alternatives** | Optional, generate rejected solutions |
| **vibe-review-confidence** | Optional, generate confidence level |

---

**Last Updated**: 2026-01-04  
**Version**: v0.3.0
```

#### vibe-review-impact Skill Definition (Follows Agent Skills Protocol)

```markdown
---
name: vibe-review-impact
description: Analyzes impact scope of code changes including side effects and affected modules. Use when changes affect multiple files or modules, or when API changes are involved.
license: MIT
compatibility: Designed for Claude Code, Cursor, and similar AI coding assistants
metadata:
  author: vibe-review
  version: "0.3.0"
  category: code-review
allowed-tools: Read Bash(git:*) Bash(grep:*)
---

# Vibe Review Impact - Impact Scope Analysis

## 📋 Function Positioning

Analyze **impact scope** of code changes, including side effects and affected modules.

**Core Value**:
- 🔍 **Side Effect Analysis**: Identify possible side effects
- 📦 **Module Impact**: List affected modules
- ⚠️ **Risk Hints**: Mark risk points needing attention

---

## 🎯 Applicable Scenarios

### ✅ When to Call

| Scenario | Call or Not |
|----------|-------------|
| Files changed > 3 | ✅ Recommended |
| Involves multiple modules | ✅ Recommended |
| API changes | ✅ Recommended |
| Simple changes | ❌ Not needed |

---

## 📤 Output Format

```markdown
### IMPACT
**Side Effects**:
- [side effect 1]
- [side effect 2]

**Affected Modules**:
- [module 1]
- [module 2]
```

---

## 🔗 Dependencies

- Must first execute `vibe-review-core`

---

**Last Updated**: 2026-01-04  
**Version**: v0.3.0
```

---

### 4. Version Management: Rule and Skill Synchronous Upgrade

```
┌─────────────────────────────────────────────────────┐
│  Version Management Strategy                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Version number format: MAJOR.MINOR.PATCH                          │
│  ├─ MAJOR: Protocol structure changes (incompatible)                           │
│  ├─ MINOR: New fields added (backward compatible)                             │
│  └─ PATCH: Bug fixes                                         │
│                                                     │
│  Synchronous upgrade rules                                               │
│  ├─ Rule version = Skill version                                  │
│  ├─ Update Rule and Skill simultaneously when upgrading                            │
│  └─ Report error when versions don't match                                        │
│                                                     │
│  Upgrade process                                                   │
│  1. Release new version protocol specification                                      │
│  2. Update Rule file (version number + field definitions)                     │
│  3. Update Skill file (version number + Prompt)                      │
│  4. Publish Release                                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Version Check Mechanism

```yaml
# .vibe-review/rule.yaml
name: vibe-review-protocol
version: 0.3.0

skills:
  core: vibe-review-core@0.3.0  # Must match
  optional:
    - vibe-review-impact@0.3.0  # Must match
```

```yaml
# .vibe-review/skills/vibe-review-core/skill.yaml
name: vibe-review-core
version: 0.3.0  # Must match version declared in Rule

# Compatibility declaration
compatibility:
  min_rule_version: 0.3.0
  max_rule_version: 0.3.x
```

**Behavior when versions don't match**:
```
⚠️ Version Mismatch Warning
Rule version: 0.3.0
Skill version: 0.2.0

Please upgrade your skills:
  vibe-review upgrade --skill vibe-review-core
```

---

## Complete Example

### Project Structure

```
my-project/
├─ AGENTS.md                    # Declare use of Vibe Review
├─ .vibe-review/
│   ├─ rule.yaml                # Rule definition
│   └─ skills/                  # Project-level Skills (optional)
│       ├─ vibe-review-core/
│       │   └─ SKILL.md         # Follows Claude Code Agent Skill protocol
│       ├─ vibe-review-impact/
│       │   └─ SKILL.md
│       └─ ...
└─ src/
    └─ ...

# Or use global Skills
~/.claude/skills/
├─ vibe-review-core/
│   └─ SKILL.md
├─ vibe-review-impact/
│   └─ SKILL.md
└─ ...
```

### Execution Flow Example

```
User: "Add remember me function to login page"

Agent executes:
1. Read AGENTS.md → Discover Vibe Review protocol
2. Read .vibe-review/rule.yaml → Understand protocol requirements
3. Execute task → Modify 3 files
4. Task completes → Autonomously call Skill
   ├─ Call vibe-review-core → Generate required fields
   └─ Check trigger conditions → files_changed=3, call vibe-review-impact
5. Output:
   ├─ Code changes (3 files)
   └─ Vibe Review protocol (Markdown)
```

### Generated Protocol Content

```markdown
## Vibe Review Protocol v0.3

### WHAT
**Intent**: Add "remember me" feature to login page to auto-fill username when user visits next time.

**Changes**:
- `src/pages/Login.tsx`: Add checkbox component and state management
- `src/utils/storage.ts`: Add localStorage read/write utility functions
- `src/hooks/useAuth.ts`: Modify login logic to support remembering username

### WHY
**Rationale**: 
- Use localStorage instead of cookie because it only needs to be used on frontend
- Store username but not password to balance convenience and security

### HOW TO VERIFY
**Tests**:
- Check "remember me" → Login → Close browser → Reopen → Username should auto-fill
- Uncheck → Login → Close → Reopen → Username should be empty

**Edge Cases**:
- localStorage may not be available in private mode
- How to handle when switching between multiple accounts?

### IMPACT
**Side Effects**:
- Login process will have one additional step (reading localStorage)
- User privacy: Username will be stored locally

**Affected Modules**:
- Login module
- Storage utility module
```

---

## Key Decision Records

### Why AGENTS.md + Independent File?

**Decision**: Declare in AGENTS.md, define details in independent file

**Reasons**:
1. AGENTS.md stays concise, only declares "what protocol to use"
2. Independent file can contain detailed rule definitions
3. Independent file can have separate version management
4. Follows "separation of concerns" principle

### Why Agent Autonomous Call?

**Decision**: Agent autonomously calls Skill when task completes

**Reasons**:
1. Agent understands execution context best
2. Agent can judge which optional Skills need to be called
3. No external system intervention needed
4. More flexible, adapts to different scenarios

### Why Core + Optional?

**Decision**: One core Skill (required) + multiple optional Skills

**Reasons**:
1. Core Skill ensures basic protocol content
2. Optional Skills called as needed, no extra burden
3. Can be independently upgraded and extended
4. Community can contribute new optional Skills

### Why Synchronous Upgrade?

**Decision**: Rule and Skill versions must match

**Reasons**:
1. Avoid issues caused by version mismatch
2. Simplify version management
3. Ensure protocol consistency
4. Facilitate problem troubleshooting

---

## Association with Other Decisions

| Related Decision | Association Explanation |
|-----------------|----------------------|
| [Agent Review Protocol](./D01-agent-review-protocol.md) | Skill generates protocol content |
| [Data Acquisition Strategy](./D02-data-acquisition-strategy.md) | Skill is one track of dual-track system |
| [MVP Strategy](./D04-mvp-strategy.md) | Phase 0 implement vibe-review-core Skill |

---

## Next Steps

1. Define Rule's YAML Schema
2. Create vibe-review-core Skill (follows Agent Skills protocol)
3. Create vibe-review-impact Skill (follows Agent Skills protocol)
4. Implement version check mechanism

---

## Appendix: Agent Skills Protocol Explanation

**Reference Specification**: https://agentskills.io/specification

### SKILL.md Format Specification

Each Skill uses a single `SKILL.md` file, containing:

1. **YAML Frontmatter**: Metadata definition

| Field | Required | Constraints |
|-------|----------|------------|
| `name` | ✅ | Max 64 chars, lowercase+numbers+hyphens, must match directory name |
| `description` | ✅ | Max 1024 chars, describe functionality and usage scenarios |
| `license` | ❌ | License name or file reference |
| `compatibility` | ❌ | Max 500 chars, environment requirements |
| `metadata` | ❌ | Arbitrary key-value pairs (author, version, etc.) |
| `allowed-tools` | ❌ | Space-separated pre-approved tool list (experimental) |

2. **Markdown Body**: Detailed instructions
   - Function positioning
   - Applicable scenarios
   - Input/Output format
   - Usage guidelines
   - Collaboration relationships

### Directory Structure

```
skill-name/
├── SKILL.md          # Required
├── scripts/          # Optional: executable scripts
├── references/       # Optional: reference documents
└── assets/           # Optional: static resources
```

### Progressive Disclosure

1. **Metadata** (~100 tokens): Load all Skill names and descriptions at startup
2. **Instructions** (< 5000 tokens): Load complete SKILL.md when activated
3. **Resources** (On-demand): Load scripts/, references/, assets/ as needed

**Best Practices**:
- Keep SKILL.md under 500 lines
- Put detailed reference materials in references/ directory

### Example Structure

```markdown
---
name: skill-name
description: Describes what this skill does and when to use it. Include keywords for agent matching.
license: MIT
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: author-name
  version: "1.0.0"
allowed-tools: Read Write Bash(git:*)
---

# Skill Title

## 📋 Function Positioning
...

## 🎯 Applicable Scenarios
...

## 📥 Input Data
...

## 📤 Output Format
...
```

### Validation Tools

```bash
skills-ref validate ./my-skill
```

---


---

**Last Updated**: 2026-01-04
