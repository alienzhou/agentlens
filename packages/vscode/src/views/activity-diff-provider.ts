/**
 * Activity Diff Provider
 *
 * Provides virtual document content for showing diff of code changes.
 * Used by the RECENT ACTIVITY tree view to show before/after comparison.
 */
import * as vscode from 'vscode';

/**
 * URI scheme for activity diff documents
 */
export const ACTIVITY_DIFF_SCHEME = 'agentlens-diff';

/**
 * Diff content type
 */
export type DiffContentType = 'old' | 'new';

/**
 * Stored diff content for virtual documents
 */
interface DiffContent {
  oldContent: string;
  newContent: string;
  filePath: string;
  timestamp: number;
}

/**
 * Virtual document provider for activity diff
 *
 * Provides content for URIs like:
 * - agentlens-diff:/old/{id}/{filename}
 * - agentlens-diff:/new/{id}/{filename}
 */
export class ActivityDiffProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  /** Store diff content by ID */
  private diffContents = new Map<string, DiffContent>();

  /** Counter for generating unique IDs */
  private idCounter = 0;

  /**
   * Store diff content and return the ID
   */
  storeDiffContent(filePath: string, oldContent: string, newContent: string): string {
    const id = `diff-${Date.now()}-${this.idCounter++}`;
    this.diffContents.set(id, {
      oldContent,
      newContent,
      filePath,
      timestamp: Date.now(),
    });
    return id;
  }

  /**
   * Create URI for diff content
   */
  createDiffUri(id: string, type: DiffContentType, fileName: string): vscode.Uri {
    return vscode.Uri.parse(`${ACTIVITY_DIFF_SCHEME}:/${type}/${id}/${fileName}`);
  }

  /**
   * Provide text document content for URI
   */
  provideTextDocumentContent(uri: vscode.Uri): string {
    const parts = uri.path.split('/').filter(Boolean);
    if (parts.length < 2) {
      return '';
    }

    const [type, id] = parts as [string, string];
    const content = this.diffContents.get(id);

    if (!content) {
      return '';
    }

    if (type === 'old') {
      return content.oldContent;
    } else if (type === 'new') {
      return content.newContent;
    }

    return '';
  }

  /**
   * Clean up old diff content (older than 1 hour)
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, content] of this.diffContents.entries()) {
      if (content.timestamp < oneHourAgo) {
        this.diffContents.delete(id);
      }
    }
  }

  /**
   * Clear a specific diff content
   */
  clearContent(id: string): void {
    this.diffContents.delete(id);
  }

  /**
   * Dispose the provider
   */
  dispose(): void {
    this._onDidChange.dispose();
    this.diffContents.clear();
  }
}

/**
 * Open diff view for activity change
 */
export async function openActivityDiff(
  provider: ActivityDiffProvider,
  filePath: string,
  oldContent: string,
  newContent: string,
  title?: string
): Promise<void> {
  const fileName = filePath.split('/').pop() || 'file';
  const id = provider.storeDiffContent(filePath, oldContent, newContent);

  const leftUri = provider.createDiffUri(id, 'old', fileName);
  const rightUri = provider.createDiffUri(id, 'new', fileName);

  const diffTitle = title || `${fileName} (AI Change)`;

  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, diffTitle);
}
