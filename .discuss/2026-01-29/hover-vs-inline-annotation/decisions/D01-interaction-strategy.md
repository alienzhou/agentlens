# D01: Interaction Strategy - Hover + Inline Annotation Coexistence

## Decision

Adopt **Hover Popover + Inline Annotation Coexistence** interaction strategy, referencing GitLens implementation pattern.

## Background

The discussion originated from "why not use hover popover like GitLens". After researching GitLens source code, we found that hover and inline annotation are not mutually exclusive, but serve different purposes:

- **Inline Annotation**: Line-end decoration, provides "at a glance" brief info
- **Hover Popover**: Displays detailed info on mouse hover

## Technical Implementation

| Feature           | VSCode API                                             |
| ----------------- | ------------------------------------------------------ |
| Inline Annotation | `TextEditorDecorationType` + `editor.setDecorations()` |
| Hover Popover     | `languages.registerHoverProvider()` + `MarkdownString` |

## Reference

GitLens key files:

- `src/hovers/lineHoverController.ts` - Hover controller
- `src/annotations/lineAnnotationController.ts` - Inline annotation controller

They have mutex logic to avoid duplicate display (when file-level blame annotation is enabled, line hover's details are disabled).

## Status

✅ Confirmed
