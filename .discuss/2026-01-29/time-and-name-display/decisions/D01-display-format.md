# D01: Blame 显示格式规范

## 决定

### 人类编辑（未提交）
```
👤 {userName}, uncommitted
```
- 不显示虚假时间
- `uncommitted` 明确表示是未提交的本地修改

### AI 编辑
```
🤖 {agentName}, {relativeTime}
```
- `agentName` 从 `AGENT_CONFIGS[agent].name` 获取
- `relativeTime` 根据 timestamp 动态计算

### 时间规则（AI 编辑 & Git Blame）

| 时间差 | 显示 |
|--------|------|
| < 60 秒 | "just now" |
| 1-59 分钟 | "X minute(s) ago" |
| 1-23 小时 | "X hour(s) ago" |
| 1-6 天 | "X day(s) ago" |
| 1-4 周 | "X week(s) ago" |
| 1-11 月 | "X month(s) ago" |
| >= 1 年 | "X year(s) ago" |

## 原因

1. **人类编辑无时间戳**：未提交的代码没有准确时间，显示 "just now" 是错误信息
2. **未匹配不代表是人类**：可能是 AI 写的但没记录下来，所以不显示时间更诚实
3. **AI 编辑有时间戳**：`changes.jsonl` 中有 timestamp，可以准确计算

## 相关代码

- `line-blame.ts` - `createHumanDisplayInfo()`
- `line-blame.ts` - `formatRelativeTime()`
