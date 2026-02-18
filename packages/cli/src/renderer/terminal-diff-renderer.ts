import chalk from 'chalk';
import type { GitDiff, GitFileDiff, GitHunk, ContributorType } from '@agentlens/core';

/**
 * Terminal diff renderer options
 */
export interface TerminalDiffRendererOptions {
  /** Use ANSI colors */
  useColor?: boolean;

  /** Show contributor information */
  showContributor?: boolean;

  /** Context lines to show */
  contextLines?: number;
}

/**
 * Diff summary statistics
 */
export interface DiffSummary {
  files: number;
  additions: number;
  deletions: number;
  aiHunks: number;
  aiModifiedHunks: number;
  humanHunks: number;
}

/**
 * Terminal diff renderer
 *
 * Renders Git diffs with colored output and optional contributor information.
 */
export class TerminalDiffRenderer {
  private options: Required<TerminalDiffRendererOptions>;

  constructor(options: TerminalDiffRendererOptions = {}) {
    this.options = {
      useColor: options.useColor ?? true,
      showContributor: options.showContributor ?? true,
      contextLines: options.contextLines ?? 3,
    };
  }

  /**
   * Render a GitDiff to terminal output
   */
  render(diff: GitDiff): string {
    const lines: string[] = [];

    for (const file of diff.files) {
      lines.push(this.renderFileDiff(file));
    }

    return lines.join('\n');
  }

  /**
   * Render a GitDiff to Markdown
   */
  renderMarkdown(diff: GitDiff): string {
    const lines: string[] = [];

    lines.push('# Code Diff');
    lines.push('');

    for (const file of diff.files) {
      lines.push(this.renderFileDiffMarkdown(file));
    }

    return lines.join('\n');
  }

  /**
   * Get summary statistics for a diff
   */
  getSummary(diff: GitDiff): DiffSummary {
    let additions = 0;
    let deletions = 0;
    const aiHunks = 0;
    const aiModifiedHunks = 0;
    let humanHunks = 0;

    for (const file of diff.files) {
      for (const hunk of file.hunks) {
        additions += hunk.addedLines.length;
        deletions += hunk.removedLines.length;

        // Without actual contributor detection, we count as human
        // In production, this would use ContributorDetector
        humanHunks++;
      }
    }

    return {
      files: diff.files.length,
      additions,
      deletions,
      aiHunks,
      aiModifiedHunks,
      humanHunks,
    };
  }

  // ==================== Private Methods ====================

  private renderFileDiff(file: GitFileDiff): string {
    const lines: string[] = [];
    const c = this.options.useColor;

    // File header
    const header = this.getFileHeader(file);
    lines.push(c ? chalk.bold.white(header) : header);
    lines.push(c ? chalk.dim('─'.repeat(60)) : '─'.repeat(60));

    // Binary file
    if (file.isBinary) {
      lines.push(c ? chalk.yellow('Binary file') : 'Binary file');
      lines.push('');
      return lines.join('\n');
    }

    // Hunks
    for (const hunk of file.hunks) {
      lines.push(this.renderHunk(hunk));
    }

    lines.push('');
    return lines.join('\n');
  }

  private renderHunk(hunk: GitHunk): string {
    const lines: string[] = [];
    const c = this.options.useColor;

    // Hunk header
    lines.push(c ? chalk.cyan(hunk.header) : hunk.header);

    // Contributor badge (if enabled)
    if (this.options.showContributor) {
      // Placeholder - would use actual detection
      const badge = this.getContributorBadge('human');
      lines.push(badge);
    }

    // Content lines
    const contentLines = hunk.content.split('\n');

    for (const line of contentLines) {
      if (line.startsWith('@@')) {
        continue; // Already rendered
      }

      if (line.startsWith('+') && !line.startsWith('+++')) {
        lines.push(c ? chalk.green(line) : line);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        lines.push(c ? chalk.red(line) : line);
      } else {
        lines.push(c ? chalk.dim(line) : line);
      }
    }

    return lines.join('\n');
  }

  private getFileHeader(file: GitFileDiff): string {
    const icon = this.getChangeIcon(file.changeType);
    let header = `${icon} ${file.filePath}`;

    if (file.changeType === 'renamed' && file.oldFilePath) {
      header = `${icon} ${file.oldFilePath} → ${file.filePath}`;
    }

    return header;
  }

  private getChangeIcon(changeType: GitFileDiff['changeType']): string {
    switch (changeType) {
      case 'added':
        return '✚';
      case 'deleted':
        return '✖';
      case 'modified':
        return '✎';
      case 'renamed':
        return '➜';
      case 'copied':
        return '⎘';
    }
  }

  private getContributorBadge(contributor: ContributorType): string {
    const c = this.options.useColor;

    switch (contributor) {
      case 'ai':
        return c ? chalk.magenta.bold('🤖 AI Generated') : '[AI Generated]';
      case 'ai_modified':
        return c ? chalk.yellow.bold('🤖✎ AI + Human Modified') : '[AI + Human Modified]';
      case 'human':
        return c ? chalk.blue.bold('👤 Human') : '[Human]';
    }
  }

  private renderFileDiffMarkdown(file: GitFileDiff): string {
    const lines: string[] = [];

    // File header
    const icon = this.getChangeIcon(file.changeType);
    lines.push(`## ${icon} ${file.filePath}`);
    lines.push('');

    // Binary file
    if (file.isBinary) {
      lines.push('*Binary file*');
      lines.push('');
      return lines.join('\n');
    }

    // Hunks
    for (const hunk of file.hunks) {
      lines.push('```diff');
      lines.push(hunk.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }
}
