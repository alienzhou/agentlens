import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Blame information for a single line
 */
export interface BlameInfo {
  author: string;
  email: string;
  timestamp: number;
  commitHash: string;
  commitMessage: string;
}

/**
 * Full file blame result
 */
interface FileBlame {
  lines: BlameInfo[];
}

/**
 * Git blame service - executes git blame and manages cache
 */
export class BlameService {
  private cache: Map<string, FileBlame> = new Map();
  private readonly workspaceFolders: readonly vscode.WorkspaceFolder[];
  private gitUserNameCache: string | null = null;

  constructor() {
    this.workspaceFolders = vscode.workspace.workspaceFolders || [];
    this.setupCacheInvalidation();
  }

  /**
   * Get blame information for a specific line
   */
  async getBlameForLine(filePath: string, line: number): Promise<BlameInfo | null> {
    // Only support clean files (saved files) in V1
    const document = vscode.workspace.textDocuments.find((doc) => doc.fileName === filePath);
    if (document?.isDirty) {
      return null;
    }

    // Get full file blame (cached)
    const blame = await this.getBlame(filePath);
    if (!blame) {
      return null;
    }

    // Return line-specific info (0-indexed)
    return blame.lines[line] || null;
  }

  /**
   * Get full file blame (with cache)
   */
  private async getBlame(filePath: string): Promise<FileBlame | null> {
    // Check cache first
    const cached = this.cache.get(filePath);
    if (cached) {
      return cached;
    }

    // Execute git blame
    const blame = await this.executeGitBlame(filePath);
    if (blame) {
      this.cache.set(filePath, blame);
    }

    return blame;
  }

  /**
   * Execute git blame command
   */
  private async executeGitBlame(filePath: string): Promise<FileBlame | null> {
    try {
      // Find workspace folder for this file
      const workspaceFolder = this.workspaceFolders.find((folder) =>
        filePath.startsWith(folder.uri.fsPath)
      );
      if (!workspaceFolder) {
        return null;
      }

      // Get relative path from workspace root
      const relativePath = filePath.substring(workspaceFolder.uri.fsPath.length + 1);

      // Execute: git blame --root --incremental <file>
      const { stdout } = await execFileAsync(
        'git',
        ['blame', '--root', '--incremental', relativePath],
        {
          cwd: workspaceFolder.uri.fsPath,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        }
      );

      // Parse incremental format output
      return this.parseIncrementalOutput(stdout);
    } catch (error) {
      console.error(`Failed to execute git blame for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse git blame --incremental output
   *
   * Format (line by line):
   * <commit-hash> <orig-line> <final-line> <line-count>
   * author <author-name>
   * author-mail <author-email>
   * author-time <timestamp>
   * ...other metadata...
   * filename <file-path>
   * \t<line-content>  (content line starts with tab)
   */
  private parseIncrementalOutput(output: string): FileBlame {
    const lines: BlameInfo[] = [];
    const commits = new Map<string, Partial<BlameInfo>>();
    const lineToCommit = new Map<number, string>();

    const outputLines = output.split('\n');
    let currentLine = 0;
    let currentCommitHash = '';
    let currentStartLine = 0;
    let currentLineCount = 0;

    for (const line of outputLines) {
      // Header line: <commit-hash> <orig-line> <final-line> <line-count>
      const headerMatch = line.match(/^([a-f0-9]{40})\s+(\d+)\s+(\d+)\s+(\d+)$/);
      if (headerMatch) {
        currentCommitHash = headerMatch[1]!;
        currentStartLine = parseInt(headerMatch[3]!, 10) - 1; // final-line, convert to 0-indexed
        currentLineCount = parseInt(headerMatch[4]!, 10);

        // Initialize commit info if new
        if (!commits.has(currentCommitHash)) {
          commits.set(currentCommitHash, { commitHash: currentCommitHash });
        }

        // Map lines to commit
        for (let i = 0; i < currentLineCount; i++) {
          const lineNum = currentStartLine + i;
          lineToCommit.set(lineNum, currentCommitHash);
          currentLine = Math.max(currentLine, lineNum);
        }
        continue;
      }

      // Short header (for repeated commits): <commit-hash> <orig-line> <final-line>
      const shortHeaderMatch = line.match(/^([a-f0-9]{40})\s+(\d+)\s+(\d+)$/);
      if (shortHeaderMatch) {
        currentCommitHash = shortHeaderMatch[1]!;
        const finalLine = parseInt(shortHeaderMatch[3]!, 10) - 1;
        lineToCommit.set(finalLine, currentCommitHash);
        currentLine = Math.max(currentLine, finalLine);
        continue;
      }

      // Metadata lines
      if (currentCommitHash) {
        const commitInfo = commits.get(currentCommitHash);
        if (commitInfo) {
          if (line.startsWith('author ')) {
            commitInfo.author = line.substring(7);
          } else if (line.startsWith('author-mail ')) {
            commitInfo.email = line.substring(12).replace(/^<|>$/g, '');
          } else if (line.startsWith('author-time ')) {
            commitInfo.timestamp = parseInt(line.substring(12), 10);
          } else if (line.startsWith('summary ')) {
            commitInfo.commitMessage = line.substring(8);
          }
        }
      }
    }

    // Build lines array
    for (let i = 0; i <= currentLine; i++) {
      const commitHash = lineToCommit.get(i);
      if (commitHash) {
        const commit = commits.get(commitHash);
        // Check if this is an uncommitted line
        const isUncommitted =
          commitHash === '0000000000000000000000000000000000000000' ||
          commitHash.startsWith('^');

        if (isUncommitted) {
          // For uncommitted lines, create BlameInfo with special values
          lines[i] = {
            author: '',
            email: '',
            timestamp: 0,
            commitHash: commitHash,
            commitMessage: '',
          };
        } else if (commit && commit.author && commit.email !== undefined && commit.timestamp !== undefined) {
          // For committed lines, use actual commit data
          lines[i] = {
            author: commit.author,
            email: commit.email,
            timestamp: commit.timestamp,
            commitHash: commitHash,
            commitMessage: commit.commitMessage || '',
          };
        }
      }
    }

    return { lines };
  }

  /**
   * Clear cache for a specific file
   */
  clearCache(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get Git user name from git config
   */
  async getGitUserName(): Promise<string> {
    // Return cached value if available
    if (this.gitUserNameCache !== null) {
      return this.gitUserNameCache;
    }

    try {
      // Find workspace folder
      const workspaceFolder = this.workspaceFolders[0];
      if (!workspaceFolder) {
        this.gitUserNameCache = 'You';
        return 'You';
      }

      // Execute: git config user.name
      const { stdout } = await execFileAsync('git', ['config', 'user.name'], {
        cwd: workspaceFolder.uri.fsPath,
        maxBuffer: 1024,
      });

      const userName = stdout.trim();
      if (userName) {
        this.gitUserNameCache = userName;
        return userName;
      }
    } catch (error) {
      // Git config command failed or user.name not set
      console.error('Failed to get git user name:', error);
    }

    // Fallback to default
    this.gitUserNameCache = 'You';
    return 'You';
  }

  /**
   * Setup cache invalidation on file save
   */
  private setupCacheInvalidation(): void {
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme === 'file') {
        this.clearCache(document.fileName);
      }
    });
  }
}
