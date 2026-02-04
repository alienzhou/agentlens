import * as vscode from 'vscode';
import * as path from 'node:path';
import { BlameService, BlameInfo } from './blame-service.js';
import { ContributorService } from './contributor-service.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('line-blame');

/**
 * Display information for blame decoration
 */
interface BlameDisplayInfo {
  text: string; // Short text displayed at end of line
  hoverMessage: vscode.MarkdownString; // Detailed information shown on hover
}

/**
 * Line blame controller - handles cursor tracking and decoration rendering
 */
export class LineBlameController {
  private blameService: BlameService;
  private contributorService?: ContributorService;
  private decorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: NodeJS.Timeout | undefined;

  constructor(contributorService?: ContributorService) {
    this.blameService = new BlameService();
    this.contributorService = contributorService;
    this.decorationType = this.createDecorationType();
    this.setupListeners();
  }

  /**
   * Create text editor decoration type (only once)
   */
  private createDecorationType(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 3em',
        textDecoration: 'none',
        color: new vscode.ThemeColor('editorLineNumber.foreground'),
      },
      rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
    });
  }

  /**
   * Setup event listeners
   */
  private setupListeners(): void {
    // Listen to cursor/selection changes
    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(
      this.onSelectionChange.bind(this)
    );
    this.disposables.push(selectionDisposable);

    // Listen to active editor changes
    const editorDisposable = vscode.window.onDidChangeActiveTextEditor(
      this.onActiveEditorChange.bind(this)
    );
    this.disposables.push(editorDisposable);
  }

  /**
   * Handle selection change (cursor movement)
   */
  private onSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce: 250ms
    this.debounceTimer = setTimeout(() => {
      void this.updateBlameDecoration(event.textEditor);
    }, 250);
  }

  /**
   * Handle active editor change
   */
  private onActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (editor) {
      // Clear previous decorations
      this.clearDecorations(editor);
      // Update for new editor
      void this.updateBlameDecoration(editor);
    }
  }

  /**
   * Update blame decoration for current line
   */
  private async updateBlameDecoration(editor: vscode.TextEditor): Promise<void> {
    const scheme = editor.document.uri.scheme;
    const filePath = editor.document.fileName;
    const fileName = path.basename(filePath);
    const isDirty = editor.document.isDirty;
    const line = editor.selection.active.line;

    // Only support file scheme (not untitled, etc.)
    if (scheme !== 'file') {
      return;
    }

    log.debug('Updating blame decoration', {
      file: fileName,
      line,
      isDirty,
    });

    try {
      let displayInfo: BlameDisplayInfo;
      let displaySource = ''; // For logging what path was taken

      if (isDirty) {
        // File has unsaved changes - use contributor detection
        if (this.contributorService) {
          const lineText = editor.document.lineAt(line).text;
          const result = await this.contributorService.detectLineContributor(filePath, lineText, line);
          displayInfo = await this.formatUncommittedText(result, filePath, lineText);
          displaySource = `dirty:${result?.contributor ?? 'no-match'}${result?.unchanged ? ':unchanged' : ''}`;
        } else {
          const lineText = editor.document.lineAt(line).text;
          const userName = await this.blameService.getGitUserName();
          displayInfo = this.createHumanDisplayInfo(userName, lineText);
          displaySource = 'dirty:no-service';
        }
      } else {
        // File is saved - check git blame
        const blameInfo = await this.blameService.getBlameForLine(filePath, line);

        if (!blameInfo) {
          // Git blame failed (file is new/untracked) - treat as uncommitted
          if (this.contributorService) {
            const lineText = editor.document.lineAt(line).text;
            const result = await this.contributorService.detectLineContributor(filePath, lineText, line);
            displayInfo = await this.formatUncommittedText(result, filePath, lineText);
            displaySource = `no-blame:${result?.contributor ?? 'no-match'}`;
          } else {
            const lineText = editor.document.lineAt(line).text;
            const userName = await this.blameService.getGitUserName();
            displayInfo = this.createHumanDisplayInfo(userName, lineText);
            displaySource = 'no-blame:no-service';
          }
        } else {
          // Check if this line is uncommitted (saved but not git committed)
          const isUncommitted =
            blameInfo.commitHash === '0000000000000000000000000000000000000000' ||
            blameInfo.commitHash.startsWith('^');

          if (isUncommitted && this.contributorService) {
            // Uncommitted line - use contributor detection
            const lineText = editor.document.lineAt(line).text;
            const result = await this.contributorService.detectLineContributor(filePath, lineText, line);
            displayInfo = await this.formatUncommittedText(result, filePath, lineText);
            displaySource = `uncommitted:${result?.contributor ?? 'no-match'}${result?.unchanged ? ':unchanged' : ''}`;
          } else {
            // Committed line - use git blame info
            displayInfo = await this.formatBlameText(blameInfo);
            displaySource = `committed:${blameInfo.author}`;
          }
        }
      }

      log.debug('Decoration applied', {
        file: fileName,
        line,
        source: displaySource,
        text: displayInfo.text.substring(0, 40),
      });

      // Create decoration
      const range = new vscode.Range(line, Number.MAX_SAFE_INTEGER, line, Number.MAX_SAFE_INTEGER);
      const decoration: vscode.DecorationOptions = {
        range,
        hoverMessage: displayInfo.hoverMessage,
        renderOptions: {
          after: {
            contentText: displayInfo.text,
          },
        },
      };

      // Apply decoration
      editor.setDecorations(this.decorationType, [decoration]);
    } catch (error) {
      log.error('Failed to update blame decoration', error, {
        file: fileName,
        line,
        isDirty,
      });
      this.clearDecorations(editor);
    }
  }

  /**
   * Format blame text: {author}, {relative_time} • {commit_message}
   * For uncommitted lines: show Git user name
   */
  private async formatBlameText(blameInfo: BlameInfo): Promise<BlameDisplayInfo> {
    // Check if this is an uncommitted line (commit hash is all zeros or starts with ^)
    const isUncommitted =
      blameInfo.commitHash === '0000000000000000000000000000000000000000' ||
      blameInfo.commitHash.startsWith('^');

    if (isUncommitted) {
      const userName = await this.blameService.getGitUserName();
      return this.createHumanDisplayInfo(userName, '');
    }

    const relativeTime = this.formatRelativeTime(blameInfo.timestamp);
    const fullTime = this.formatFullTime(blameInfo.timestamp);
    const shortHash = blameInfo.commitHash.substring(0, 7);
    const text = `${blameInfo.author}, ${relativeTime} • ${blameInfo.commitMessage}`;

    // Create GitLens-style hover message
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportThemeIcons = true;

    // Author + full time
    markdown.appendMarkdown(`**${blameInfo.author}**, ${fullTime}\n\n`);

    // Commit message
    if (blameInfo.commitMessage) {
      markdown.appendMarkdown(`${blameInfo.commitMessage}\n\n`);
    }

    // Commit hash + copy button
    const copyHashArgs = encodeURIComponent(JSON.stringify([shortHash]));
    markdown.appendMarkdown(`\`${shortHash}\` `);
    markdown.appendMarkdown(`[$(copy)](command:agent-blame.copyCommitHash?${copyHashArgs} "Copy commit hash")`);

    return {
      text,
      hoverMessage: markdown,
    };
  }

  /**
   * Format text for uncommitted code based on contributor detection
   */
  private async formatUncommittedText(
    result: import('./contributor-service.js').LineContributorResult | null,
    filePath?: string,
    lineContent?: string
  ): Promise<BlameDisplayInfo> {
    // Special case: line exists in HEAD (content unchanged)
    // Try to get historical blame info from HEAD
    if (result?.unchanged && filePath && lineContent) {
      const headBlame = await this.blameService.getBlameForLineAtRevision(filePath, lineContent, 'HEAD');
      if (headBlame && headBlame.author) {
        const relativeTime = this.formatRelativeTime(headBlame.timestamp);
        const fullTime = this.formatFullTime(headBlame.timestamp);
        const shortHash = headBlame.commitHash.substring(0, 7);
        const text = `${headBlame.author}, ${relativeTime} • ${headBlame.commitMessage}`;

        // Create GitLens-style hover message
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        markdown.supportThemeIcons = true;

        markdown.appendMarkdown(`**${headBlame.author}**, ${fullTime}\n\n`);
        if (headBlame.commitMessage) {
          markdown.appendMarkdown(`${headBlame.commitMessage}\n\n`);
        }

        // Commit hash + copy button
        const copyHashArgs = encodeURIComponent(JSON.stringify([shortHash]));
        markdown.appendMarkdown(`\`${shortHash}\` `);
        markdown.appendMarkdown(`[$(copy)](command:agent-blame.copyCommitHash?${copyHashArgs} "Copy commit hash")`);

        return {
          text,
          hoverMessage: markdown,
        };
      }
    }

    if (!result || result.contributor === 'human') {
      // Human edit - show Git user name
      const userName = await this.blameService.getGitUserName();
      return this.createHumanDisplayInfo(userName, lineContent || '');
    }

    // AI-generated or AI-modified code
    if (result.matchedRecord) {
      const agentName = this.contributorService!.getAgentDisplayName(result.matchedRecord.agent);
      const relativeTime = this.formatRelativeTime(result.matchedRecord.timestamp);
      const fullTime = this.formatFullTime(result.matchedRecord.timestamp);
      const text = `🤖 ${agentName}, ${relativeTime}`;

      // Create GitLens-style hover message
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;
      markdown.supportThemeIcons = true;

      // Agent name + full time
      markdown.appendMarkdown(`🤖 **${agentName}**, ${fullTime}\n\n`);

      // User prompt (show task description first, as it's the most important context)
      if (result.matchedRecord.userPrompt) {
        // Truncate long prompts for display
        const promptDisplay = result.matchedRecord.userPrompt.length > 200
          ? result.matchedRecord.userPrompt.substring(0, 200) + '...'
          : result.matchedRecord.userPrompt;
        markdown.appendMarkdown(`**Task**: "${promptDisplay}"\n\n`);
      }

      // Uncommitted changes label
      markdown.appendMarkdown(`Uncommitted changes\n\n`);

      // Simple diff preview
      if (lineContent && lineContent.trim()) {
        markdown.appendCodeblock(`+ ${lineContent}`, 'diff');
        markdown.appendMarkdown('\n');
      }

      // Session ID + copy button
      if (result.matchedRecord.sessionId) {
        const shortSessionId = result.matchedRecord.sessionId.substring(0, 13);
        const copySessionArgs = encodeURIComponent(JSON.stringify([result.matchedRecord.sessionId]));
        markdown.appendMarkdown(`Session: \`${shortSessionId}\` `);
        markdown.appendMarkdown(`[$(copy)](command:agent-blame.copySessionId?${copySessionArgs} "Copy session ID")\n\n`);
      }

      return {
        text,
        hoverMessage: markdown,
      };
    }

    // Fallback to human edit
    const userName = await this.blameService.getGitUserName();
    return this.createHumanDisplayInfo(userName, lineContent || '');
  }

  /**
   * Create display info for human-edited code
   */
  private createHumanDisplayInfo(userName: string, lineContent: string): BlameDisplayInfo {
    const text = `👤 ${userName}, uncommitted`;

    // Create GitLens-style hover message
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportThemeIcons = true;

    // User name + "just now"
    markdown.appendMarkdown(`👤 **${userName}**, just now\n\n`);

    // Uncommitted changes label
    markdown.appendMarkdown(`Uncommitted changes\n\n`);

    // Simple diff preview
    if (lineContent && lineContent.trim()) {
      markdown.appendCodeblock(`+ ${lineContent}`, 'diff');
      markdown.appendMarkdown('\n');
    }

    // Working Tree label
    markdown.appendMarkdown(`Working Tree`);

    return {
      text,
      hoverMessage: markdown,
    };
  }

  /**
   * Normalize timestamp to seconds
   * Hook records use milliseconds (Date.now()), Git blame uses seconds (Unix timestamp)
   */
  private normalizeTimestamp(timestamp: number): number {
    // If timestamp > 10^12 (around year 2001 in milliseconds), treat as milliseconds
    if (timestamp > 1e12) {
      return Math.floor(timestamp / 1000);
    }
    return timestamp;
  }

  /**
   * Format timestamp to relative time (e.g., "3 days ago")
   */
  private formatRelativeTime(timestamp: number): string {
    const normalizedTs = this.normalizeTimestamp(timestamp);
    const now = Math.floor(Date.now() / 1000);
    const diff = now - normalizedTs;

    const seconds = diff;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) {
      return years === 1 ? '1 year ago' : String(years) + ' years ago';
    }
    if (months > 0) {
      return months === 1 ? '1 month ago' : String(months) + ' months ago';
    }
    if (weeks > 0) {
      return weeks === 1 ? '1 week ago' : String(weeks) + ' weeks ago';
    }
    if (days > 0) {
      return days === 1 ? '1 day ago' : String(days) + ' days ago';
    }
    if (hours > 0) {
      return hours === 1 ? '1 hour ago' : String(hours) + ' hours ago';
    }
    if (minutes > 0) {
      return minutes === 1 ? '1 minute ago' : String(minutes) + ' minutes ago';
    }
    return 'just now';
  }

  /**
   * Format timestamp to full time display: relative time (exact time)
   * e.g., "yesterday (Jan 27 23:23)"
   */
  private formatFullTime(timestamp: number): string {
    const normalizedTs = this.normalizeTimestamp(timestamp);
    const relativeTime = this.formatRelativeTime(timestamp);
    const date = new Date(normalizedTs * 1000);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${relativeTime} (${formattedDate})`;
  }

  /**
   * Clear decorations for editor
   */
  private clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.decorationType, []);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.decorationType.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
