import * as vscode from 'vscode';
import { BlameService, BlameInfo } from './blame-service.js';
import { ContributorService } from './contributor-service.js';

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
    const isDirty = editor.document.isDirty;
    const line = editor.selection.active.line;

    // Only support file scheme (not untitled, etc.)
    if (scheme !== 'file') {
      return;
    }

    try {
      let blameText: string;

      if (isDirty) {
        // File has unsaved changes - use contributor detection
        if (this.contributorService) {
          const lineText = editor.document.lineAt(line).text;
          const result = await this.contributorService.detectLineContributor(filePath, lineText, line);
          blameText = await this.formatUncommittedText(result);
        } else {
          const userName = await this.blameService.getGitUserName();
          blameText = `👤 ${userName}, just now`;
        }
      } else {
        // File is saved - check git blame
        const blameInfo = await this.blameService.getBlameForLine(filePath, line);

        if (!blameInfo) {
          // Git blame failed (file is new/untracked) - treat as uncommitted
          if (this.contributorService) {
            const lineText = editor.document.lineAt(line).text;
            const result = await this.contributorService.detectLineContributor(filePath, lineText, line);
            blameText = await this.formatUncommittedText(result);
          } else {
            const userName = await this.blameService.getGitUserName();
            blameText = `👤 ${userName}, just now`;
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
            blameText = await this.formatUncommittedText(result);
          } else {
            // Committed line - use git blame info
            blameText = await this.formatBlameText(blameInfo);
          }
        }
      }

      // Create decoration
      const range = new vscode.Range(line, Number.MAX_SAFE_INTEGER, line, Number.MAX_SAFE_INTEGER);
      const decoration: vscode.DecorationOptions = {
        range,
        renderOptions: {
          after: {
            contentText: blameText,
          },
        },
      };

      // Apply decoration
      editor.setDecorations(this.decorationType, [decoration]);
    } catch (error) {
      console.error('Failed to update blame decoration:', error);
      this.clearDecorations(editor);
    }
  }

  /**
   * Format blame text: {author}, {relative_time} • {commit_message}
   * For uncommitted lines: show Git user name
   */
  private async formatBlameText(blameInfo: BlameInfo): Promise<string> {
    // Check if this is an uncommitted line (commit hash is all zeros or starts with ^)
    const isUncommitted =
      blameInfo.commitHash === '0000000000000000000000000000000000000000' ||
      blameInfo.commitHash.startsWith('^');

    if (isUncommitted) {
      const userName = await this.blameService.getGitUserName();
      return `👤 ${userName}, just now`;
    }

    const relativeTime = this.formatRelativeTime(blameInfo.timestamp);
    return `${blameInfo.author}, ${relativeTime} • ${blameInfo.commitMessage}`;
  }

  /**
   * Format text for uncommitted code based on contributor detection
   */
  private async formatUncommittedText(
    result: import('./contributor-service.js').LineContributorResult | null
  ): Promise<string> {
    if (!result || result.contributor === 'human') {
      // Human edit - show Git user name
      const userName = await this.blameService.getGitUserName();
      return `👤 ${userName}, just now`;
    }

    // AI-generated or AI-modified code
    if (result.matchedRecord) {
      const agentName = this.contributorService!.getAgentDisplayName(result.matchedRecord.agent);
      const relativeTime = this.formatRelativeTime(result.matchedRecord.timestamp);
      return `🤖 ${agentName}, ${relativeTime}`;
    }

    // Fallback to human edit
    const userName = await this.blameService.getGitUserName();
    return `👤 ${userName}, just now`;
  }

  /**
   * Format timestamp to relative time (e.g., "3 days ago")
   */
  private formatRelativeTime(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

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
