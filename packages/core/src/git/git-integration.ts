import { simpleGit, type SimpleGit, type DiffResult, type DefaultLogFields, type ListLogLine } from 'simple-git';
import type {
  GitDiff,
  GitFileDiff,
  GitHunk,
  GitBlameInfo,
  GitBlameLine,
  GitBranchInfo,
  GitFileHistory,
  GitFileHistoryEntry,
} from '../models/git-types.js';
import { generateHunkId } from '../models/git-types.js';

/**
 * Git integration for Vibe Review
 *
 * Provides structured Git data for diff, blame, and file history operations.
 */
export class GitIntegration {
  private readonly git: SimpleGit;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  /**
   * Get the diff between two refs or working tree
   */
  async getDiff(ref?: string): Promise<GitDiff> {
    const options = ref ? [ref] : [];
    const diffResult = await this.git.diff(options);
    const diffSummary = await this.git.diffSummary(options);

    const files = this.parseDiffResult(diffResult, diffSummary);

    return {
      ref,
      files,
      timestamp: Date.now(),
    };
  }

  /**
   * Get the diff for staged changes
   */
  async getStagedDiff(): Promise<GitDiff> {
    const diffResult = await this.git.diff(['--cached']);
    const diffSummary = await this.git.diffSummary(['--cached']);

    const files = this.parseDiffResult(diffResult, diffSummary);

    return {
      ref: 'staged',
      files,
      timestamp: Date.now(),
    };
  }

  /**
   * Get the diff between two commits
   */
  async getDiffBetween(fromRef: string, toRef: string): Promise<GitDiff> {
    const diffResult = await this.git.diff([fromRef, toRef]);
    const diffSummary = await this.git.diffSummary([fromRef, toRef]);

    const files = this.parseDiffResult(diffResult, diffSummary);

    return {
      ref: `${fromRef}..${toRef}`,
      files,
      timestamp: Date.now(),
    };
  }

  /**
   * Get blame information for a file
   */
  async getBlame(filePath: string): Promise<GitBlameInfo> {
    const blameResult = await this.git.raw(['blame', '--porcelain', filePath]);
    const lines = this.parseBlameResult(blameResult, filePath);

    return {
      filePath,
      lines,
    };
  }

  /**
   * Get branch information
   */
  async getBranchInfo(): Promise<GitBranchInfo> {
    const branchSummary = await this.git.branch();
    const status = await this.git.status();

    return {
      current: branchSummary.current,
      local: branchSummary.all.filter((b) => !b.startsWith('remotes/')),
      remote: branchSummary.all.filter((b) => b.startsWith('remotes/')),
      isDirty: !status.isClean(),
    };
  }

  /**
   * Get file history
   */
  async getFileHistory(filePath: string, maxEntries = 50): Promise<GitFileHistory> {
    const log = await this.git.log({
      file: filePath,
      maxCount: maxEntries,
    });

    const entries: GitFileHistoryEntry[] = log.all.map((entry: DefaultLogFields & ListLogLine) => ({
      commitHash: entry.hash,
      message: entry.message,
      author: entry.author_name,
      authorEmail: entry.author_email,
      timestamp: new Date(entry.date).getTime(),
      changeType: 'modified' as const, // Simplified - would need more analysis for accurate type
    }));

    return {
      filePath,
      entries,
    };
  }

  /**
   * Get the current commit hash
   */
  async getCurrentCommit(): Promise<string> {
    return await this.git.revparse(['HEAD']);
  }

  /**
   * Check if the path is a valid Git repository
   */
  async isGitRepository(): Promise<boolean> {
    return await this.git.checkIsRepo();
  }

  /**
   * Get the repository root path
   */
  async getRepoRoot(): Promise<string> {
    return await this.git.revparse(['--show-toplevel']);
  }

  // ==================== Private Methods ====================

  private parseDiffResult(
    diffResult: string,
    _diffSummary: DiffResult
  ): GitFileDiff[] {
    const files: GitFileDiff[] = [];
    const fileDiffs = this.splitByFile(diffResult);

    for (const fileDiff of fileDiffs) {
      const parsed = this.parseFileDiff(fileDiff);
      if (parsed) {
        files.push(parsed);
      }
    }

    return files;
  }

  private splitByFile(diffResult: string): string[] {
    const files: string[] = [];
    const lines = diffResult.split('\n');
    let currentFile: string[] = [];

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile.length > 0) {
          files.push(currentFile.join('\n'));
        }
        currentFile = [line];
      } else {
        currentFile.push(line);
      }
    }

    if (currentFile.length > 0) {
      files.push(currentFile.join('\n'));
    }

    return files;
  }

  private parseFileDiff(fileDiff: string): GitFileDiff | null {
    const lines = fileDiff.split('\n');
    if (lines.length === 0) {
      return null;
    }

    // Parse file path from diff header
    const diffHeader = lines[0];
    const match = /diff --git a\/(.+?) b\/(.+)/.exec(diffHeader ?? '');
    if (!match) {
      return null;
    }

    const oldPath = match[1]!;
    const newPath = match[2]!;
    const filePath = newPath;

    // Determine change type
    let changeType: GitFileDiff['changeType'] = 'modified';
    const hasNewFile = lines.some((l) => l.startsWith('new file mode'));
    const hasDeletedFile = lines.some((l) => l.startsWith('deleted file mode'));
    const hasRename = lines.some((l) => l.startsWith('rename from'));

    if (hasNewFile) {
      changeType = 'added';
    } else if (hasDeletedFile) {
      changeType = 'deleted';
    } else if (hasRename) {
      changeType = 'renamed';
    }

    // Check for binary
    const isBinary = lines.some((l) => l.includes('Binary files'));

    // Parse hunks
    const hunks = this.parseHunks(filePath, lines);

    return {
      filePath,
      oldFilePath: oldPath !== newPath ? oldPath : undefined,
      changeType,
      hunks,
      isBinary,
    };
  }

  private parseHunks(filePath: string, lines: string[]): GitHunk[] {
    const hunks: GitHunk[] = [];
    let currentHunk: {
      header: string;
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      content: string[];
      addedLines: string[];
      removedLines: string[];
    } | null = null;

    for (const line of lines) {
      // Match hunk header: @@ -old_start,old_lines +new_start,new_lines @@
      const hunkMatch = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);

      if (hunkMatch) {
        // Save previous hunk
        if (currentHunk) {
          hunks.push(this.createHunk(filePath, currentHunk));
        }

        currentHunk = {
          header: line,
          oldStart: parseInt(hunkMatch[1]!, 10),
          oldLines: parseInt(hunkMatch[2] ?? '1', 10),
          newStart: parseInt(hunkMatch[3]!, 10),
          newLines: parseInt(hunkMatch[4] ?? '1', 10),
          content: [line],
          addedLines: [],
          removedLines: [],
        };
      } else if (currentHunk) {
        currentHunk.content.push(line);

        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.addedLines.push(line.substring(1));
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.removedLines.push(line.substring(1));
        }
      }
    }

    // Save last hunk
    if (currentHunk) {
      hunks.push(this.createHunk(filePath, currentHunk));
    }

    return hunks;
  }

  private createHunk(
    filePath: string,
    hunkData: {
      header: string;
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      content: string[];
      addedLines: string[];
      removedLines: string[];
    }
  ): GitHunk {
    return {
      id: generateHunkId(filePath, hunkData.oldStart, hunkData.newStart),
      filePath,
      oldStart: hunkData.oldStart,
      oldLines: hunkData.oldLines,
      newStart: hunkData.newStart,
      newLines: hunkData.newLines,
      content: hunkData.content.join('\n'),
      addedLines: hunkData.addedLines,
      removedLines: hunkData.removedLines,
      header: hunkData.header,
    };
  }

  private parseBlameResult(blameResult: string, _filePath: string): GitBlameLine[] {
    const lines: GitBlameLine[] = [];
    const blameLines = blameResult.split('\n');

    let currentCommit = '';
    let currentAuthor = '';
    let currentEmail = '';
    let currentTimestamp = 0;
    let lineNumber = 0;

    for (const line of blameLines) {
      // Commit line: 40-char hash followed by line numbers
      const commitMatch = /^([a-f0-9]{40}) (\d+) (\d+)/.exec(line);
      if (commitMatch) {
        currentCommit = commitMatch[1]!;
        lineNumber = parseInt(commitMatch[3]!, 10);
        continue;
      }

      // Author
      if (line.startsWith('author ')) {
        currentAuthor = line.substring(7);
        continue;
      }

      // Author email
      if (line.startsWith('author-mail ')) {
        currentEmail = line.substring(12).replace(/[<>]/g, '');
        continue;
      }

      // Author time
      if (line.startsWith('author-time ')) {
        currentTimestamp = parseInt(line.substring(12), 10) * 1000;
        continue;
      }

      // Content line (starts with tab)
      if (line.startsWith('\t')) {
        lines.push({
          lineNumber,
          commitHash: currentCommit,
          author: currentAuthor,
          authorEmail: currentEmail,
          timestamp: currentTimestamp,
          content: line.substring(1),
        });
      }
    }

    return lines;
  }
}
