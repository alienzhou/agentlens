/**
 * Git-related type definitions for Agent Blame
 */

/**
 * Represents a single hunk in a Git diff
 */
export interface GitHunk {
  /** Unique identifier for this hunk */
  id: string;

  /** File path (relative to repository root) */
  filePath: string;

  /** Starting line number in the old file */
  oldStart: number;

  /** Number of lines in the old file */
  oldLines: number;

  /** Starting line number in the new file */
  newStart: number;

  /** Number of lines in the new file */
  newLines: number;

  /** The actual content of the hunk (diff format) */
  content: string;

  /** Lines added in this hunk */
  addedLines: string[];

  /** Lines removed in this hunk */
  removedLines: string[];

  /** Hunk header (e.g., @@ -1,5 +1,6 @@) */
  header: string;
}

/**
 * Represents a file diff in Git
 */
export interface GitFileDiff {
  /** File path */
  filePath: string;

  /** Old file path (for renames) */
  oldFilePath?: string;

  /** Change type */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';

  /** All hunks in this file diff */
  hunks: GitHunk[];

  /** Binary file flag */
  isBinary: boolean;
}

/**
 * Represents a complete Git diff
 */
export interface GitDiff {
  /** Commit hash (if applicable) */
  commitHash?: string;

  /** Reference being compared (e.g., 'HEAD', 'main') */
  ref?: string;

  /** All file diffs */
  files: GitFileDiff[];

  /** Timestamp of the diff */
  timestamp: number;
}

/**
 * Git blame information for a single line
 */
export interface GitBlameLine {
  /** Line number (1-indexed) */
  lineNumber: number;

  /** Commit hash */
  commitHash: string;

  /** Author name */
  author: string;

  /** Author email */
  authorEmail: string;

  /** Commit timestamp */
  timestamp: number;

  /** Line content */
  content: string;
}

/**
 * Git blame information for a file
 */
export interface GitBlameInfo {
  /** File path */
  filePath: string;

  /** Blame information for each line */
  lines: GitBlameLine[];
}

/**
 * Git branch information
 */
export interface GitBranchInfo {
  /** Current branch name */
  current: string;

  /** All local branches */
  local: string[];

  /** All remote branches */
  remote: string[];

  /** Whether the repository has uncommitted changes */
  isDirty: boolean;
}

/**
 * File history entry
 */
export interface GitFileHistoryEntry {
  /** Commit hash */
  commitHash: string;

  /** Commit message */
  message: string;

  /** Author name */
  author: string;

  /** Author email */
  authorEmail: string;

  /** Commit timestamp */
  timestamp: number;

  /** Change type in this commit */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
}

/**
 * File history
 */
export interface GitFileHistory {
  /** File path */
  filePath: string;

  /** History entries (newest first) */
  entries: GitFileHistoryEntry[];
}

/**
 * Generates a unique ID for a GitHunk
 */
export function generateHunkId(filePath: string, oldStart: number, newStart: number): string {
  return `${filePath}:${String(oldStart)}:${String(newStart)}`;
}

/**
 * Creates an empty GitHunk
 */
export function createEmptyHunk(filePath: string): GitHunk {
  return {
    id: generateHunkId(filePath, 0, 0),
    filePath,
    oldStart: 0,
    oldLines: 0,
    newStart: 0,
    newLines: 0,
    content: '',
    addedLines: [],
    removedLines: [],
    header: '',
  };
}
