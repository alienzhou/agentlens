# GitLens Architecture Research

> Research Date: 2026-01-27  
> Source Code: https://github.com/gitkraken/vscode-gitlens

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LineAnnotationController                                    │
│  - Subscribe to lineTracker.onDidChangeActiveLines          │
│  - Call getInlineDecoration() to generate decorations        │
│  - editor.setDecorations() to render                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LineTracker                                                 │
│  - Listen to onDidChangeTextEditorSelection (cursor change) │
│  - Maintain _state: Map<line, {commit}>                     │
│  - Call getBlameForLine() to get blame data                 │
│  - debounce 250ms                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LocalGitProvider                                            │
│  - getBlame(): Full file blame + cache                      │
│  - getBlameForLine(): Default retrieve from getBlame()      │
│  - getBlameContents(): Support dirty files                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  git.ts + blameParser.ts                                    │
│  - git blame --root --incremental [-L start,end] <file>     │
│  - Parse porcelain format output                            │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| Module | File | Core Responsibility |
|--------|------|---------------------|
| Low-level execution | `src/env/node/git/git.ts` | `git blame --root --incremental` |
| Parser | `src/git/parsers/blameParser.ts` | Parse blame porcelain output → GitBlame |
| Provider | `src/env/node/git/localGitProvider.ts` | Cache management + high-level API |
| Line tracking | `src/trackers/lineTracker.ts` | Cursor listening + state management |
| Decoration control | `src/annotations/lineAnnotationController.ts` | Decoration rendering |
| Decoration generation | `src/annotations/annotations.ts` | `getInlineDecoration()` |

## Core Data Model

```typescript
// src/git/models/blame.ts
interface GitBlame {
  repoPath: string;
  authors: Map<string, GitBlameAuthor>;
  commits: Map<string, GitCommit>;
  lines: GitCommitLine[];  // Indexed by line number
}

interface GitBlameLine {
  author?: GitBlameAuthor;
  commit: GitCommit;
  line: GitCommitLine;
}
```

## Caching Strategy

| Scenario | Strategy | Reason |
|----------|----------|--------|
| Single line blame | Get full file blame, extract single line | Subsequent line switches retrieve directly from cache |
| Full file blame | Cache in `doc.state` | Reuse for multiple accesses to same file |
| Dirty files | Use `--contents` stdin | Support blame for unsaved content |

## Dirty File Handling

```typescript
// localGitProvider.ts
async getBlame(uri, document) {
  if (document?.isDirty) {
    return this.getBlameContents(uri, document.getText());
  }
  // ... normal flow
}

// git.ts
if (options?.contents != null) {
  params.push('--contents', '-');  // Pass via stdin
  stdin = options.contents;
}
```

## Decoration Rendering

```typescript
// 1. Predefine decoration type (create only once)
const annotationDecoration = window.createTextEditorDecorationType({
  after: { margin: '0 0 0 3em', textDecoration: 'none' },
  rangeBehavior: DecorationRangeBehavior.OpenOpen,
});

// 2. Generate decoration content (annotations.ts)
function getInlineDecoration(commit, format, options) {
  return {
    renderOptions: {
      after: {
        backgroundColor: new ThemeColor('gitlens.trailingLineBackgroundColor'),
        color: new ThemeColor('gitlens.trailingLineForegroundColor'),
        contentText: pad(message, 1, 1),
        fontWeight: 'normal',
        fontStyle: 'normal',
      },
    },
  };
}

// 3. Apply decoration
editor.setDecorations(annotationDecoration, [decoration]);
```

## Cursor Blame (Enterprise)

Cursor Enterprise edition has similar functionality:

| Feature | Description |
|---------|-------------|
| AI Attribution | Distinguish Tab completions / Agent runs / Human edits |
| Model Tracking | Mark which model generated the code |
| Conversation Link | Link to conversation summary that generated the code |

This is exactly the target direction for agent-blame.
