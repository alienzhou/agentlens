# Vibe Review

> A Code Review tool redesigned for the Vibe Coding era

|[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
|[![Status: In Development](https://img.shields.io/badge/Status-In%20Development-orange.svg)](https://github.com/alienzhou/vibe-review)
|

## 🎯 Project Vision

In the Vibe Coding era where AI participates extensively in code generation, traditional Code Review methods are no longer applicable. **Vibe Review** is committed to solving the fundamental contradiction of using "industrial-era human review rituals" to review "post-industrial era machine-synthesized code."

**Core Philosophy**: The essence of Review is not "checking code," but "establishing understanding and trust in code."

## 🚀 Core Features

### 🤖 Agent Review Protocol v0.3
- **4-layer protocol structure**: WHAT / WHY / HOW TO VERIFY / IMPACT
- **Structured explanations**: Agents provide intent, rationale, verification methods, and impact analysis when generating code
- **Human and machine readable**: Markdown format, easy for humans to read and for tools to parse

### 🔌 Hook + Skill Dual-Track Data Acquisition
- **Hook mechanism**: Passively collect execution chain data through AGENTS framework API
- **Skill mechanism**: As an open protocol standard, allow Agents to actively generate protocol content
- **Intelligent fusion**: Automatically handle data conflicts, engineering metrics follow Hook as standard

### 📊 ReviewUnit Concept
- **Multi-Hunk combination**: Combine related code changes into logical units
- **Structured annotations**: Each ReviewUnit contains complete protocol content
- **TODO bidirectional index**: Support clicking TODO to navigate to original conversation

## 🏗️ Architecture Design

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: Product Delivery Layer                    │
│  ├─ GitLens Integration | Standalone Panel | IDE Plugin | CLI    │
├─────────────────────────────────────────────────────┤
│  Layer 3: Product Core Layer                       │
│  ├─ Protocol Parser | Rendering Engine | Interaction Logic | State Mgmt │
├─────────────────────────────────────────────────────┤
│  Layer 2: Data Layer                               │
│  ├─ SessionSource | ReviewUnit | Todo                  │
├─────────────────────────────────────────────────────┤
│  Layer 1: Tool Layer                                 │
│  ├─ Hook + Skill Dual-Track | Git Integration | Post-processing │
└─────────────────────────────────────────────────────┘
```

## 🎯 Core Problems Solved

6 structural problems traditional Code Review faces in the AI era:

1. **Object Changed**: From "human thinking" to "results from unknown systems"
2. **Scale Imbalance**: Generation is parallel, review is serial
3. **Trust Failure**: From "trust person + check code" to "only check code remains"
4. **Focus Shift**: From "text level" to "system semantic level"
5. **Cognitive Burden Transformation**: From "evaluation" to "reverse engineering + interrogation + explosion prevention"
6. **Unclear Boundaries**: Human and Agent review division undefined

## 🚀 Quick Start

### Installation (Planned)

```bash
# NPM installation
npm install -g vibe-review

# Or use Yarn
yarn global add vibe-review
```

### Basic Usage

```bash
# View annotated diff
vibe-review diff --annotated

# Generate review report
vibe-review review --format=markdown

# View TODO list
vibe-review todos --interactive
```

### Agent Integration

Add `AGENTS.md` to your project:

```markdown
# AGENTS

## Available Skills

<skill>
<name>vibe-review-core</name>
<description>Generate Agent Review Protocol content</description>
<location>global</location>
</skill>
```

## 📋 Agent Review Protocol Example

```markdown
## WHAT
**Intent**: Add "Remember Me" feature to login page
**Changes**: 
- `src/components/LoginForm.tsx`: Add checkbox component and state management
- `src/hooks/useAuth.ts`: Add rememberMe parameter and localStorage logic

## WHY
**Rationale**: 
- User feedback wants to avoid frequent login
- Store token in localStorage, expires in 7 days
- Checkbox unchecked by default, follows security best practices

## HOW TO VERIFY
**Tests**:
1. Check "Remember Me" to login, refresh page should maintain login state
2. Uncheck to login, refresh page should redirect to login page
3. Token should automatically expire after 7 days

**Edge Cases**:
- User clears browser data
- localStorage is disabled
- Compatibility when token format changes

## IMPACT
**Affected Areas**:
- Login flow: added state branches
- Security policy: need to consider token leakage risk
- User experience: reduce login frequency
```

## 🛣️ Development Roadmap

### Phase 0: Tool Layer (2-3 weeks)
- [x] Design Agent Review Protocol v0.3
- [x] Define data models and architecture
- [ ] Implement vibe-review-core Skill
- [ ] Implement Hook Core + first Adapter
- [ ] Implement data fusion logic

### Phase 1: Data Layer Validation (2-3 weeks)
- [ ] CLI tool: `vibe-review diff --annotated`
- [ ] Validate data model effectiveness
- [ ] Verify helpfulness of data to Review

### Phase 2: Product Core Layer (4-6 weeks)
- [ ] Protocol parser
- [ ] Rendering engine
- [ ] Interaction logic and state management

### Phase 3: Product Delivery Layer (Future)
- [ ] VS Code plugin
- [ ] GitLens integration
- [ ] CLI tool improvement

## 🤝 Supported Agent Platforms

- **Cursor**: Integration through AGENTS framework
- **Claude**: Support through adapter layer
- **GitHub Copilot**: Planned support
- **Other Agents**: Extension through open protocol

## 📚 Documentation

- [Agent Review Protocol detailed explanation](./discuss/decisions/01-Agent-Review-Protocol.md)
- [Data acquisition strategy](./discuss/decisions/02-Data-Acquisition-Strategy.md)
- [Skill and Rule collaboration](./discuss/decisions/03-Skill-Rule-Collaboration.md)
- [MVP strategy](./discuss/decisions/04-MVP-Strategy.md)
- [Technical solution overview](./discuss/README.md)

## 🔧 Technology Stack

| Component | Technology | Description |
|-----------|-----------|-------------|
| Git Integration | simple-git | Structured data, cross-platform compatibility |
| Skill Format | [Agent Skills Protocol](https://agentskills.io/specification) | Standardized, community compatible |
| Storage Format | JSON | Simple, easy to debug |
| Protocol Format | Markdown | Human readable + tool parsable |

## 🌟 Why Choose Vibe Review?

### Limitations of Traditional Code Review
- ❌ Cannot understand AI's generation logic
- ❌ Lacks structured intent transmission
- ❌ Excessive cognitive burden, low efficiency
- ❌ Cannot establish trust in AI code

### Advantages of Vibe Review
- ✅ Structured protocol content, clearly transmit intent
- ✅ Automated data collection, reduce manual costs
- ✅ Multi-dimensional verification mechanisms, improve code quality
- ✅ Open protocol standard, support ecosystem extension

## 🤝 Contributing Guide

We welcome community contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### Ways to Contribute
- 🐛 Report bugs
- 💡 Propose new features
- 📝 Improve documentation
- 🔧 Submit code

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

## 🙏 Acknowledgments

Thanks to all developers who have contributed to the exploration of engineering practices in the Vibe Coding era.

---

**Vibe Review** - Making Code Review in the AI era more intelligent, efficient, and trustworthy.

|[🌟 Star this repo](https://github.com/alienzhou/vibe-review) | [📖 Read docs](./discuss/README.md) | [💬 Join discussions](https://github.com/alienzhou/vibe-review/discussions)
