import * as vscode from 'vscode';
import * as path from 'node:path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createModuleLogger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);
const log = createModuleLogger('blame-service');

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
   * Get blame information for a line in a specific revision (e.g., HEAD)
   * Used for lines that exist in HEAD but appear as uncommitted due to file rewrite
   */
  async getBlameForLineAtRevision(
    filePath: string,
    lineContent: string,
    revision: string = 'HEAD'
  ): Promise<BlameInfo | null> {
    try {
      // Find workspace folder for this file
      const workspaceFolder = this.workspaceFolders.find((folder) =>
        filePath.startsWith(folder.uri.fsPath)
      );
      if (!workspaceFolder) {
        return null;
      }

      // Get relative path from workspace root
      const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);

      // Execute: git blame --root --incremental <revision> -- <file>
      const { stdout } = await execFileAsync(
        'git',
        ['blame', '--root', '--incremental', revision, '--', relativePath],
        {
          cwd: workspaceFolder.uri.fsPath,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        }
      );

      // Parse and find the line with matching content
      const blame = this.parseIncrementalOutput(stdout);

      // Get file content at revision to match line content
      const { stdout: fileContent } = await execFileAsync(
        'git',
        ['show', `${revision}:${relativePath}`],
        {
          cwd: workspaceFolder.uri.fsPath,
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      // Find line number in HEAD that matches the content
      const headLines = fileContent.split('\n');
      const trimmedContent = lineContent.trim();
      for (let i = 0; i < headLines.length; i++) {
        if (headLines[i]!.trim() === trimmedContent) {
          return blame.lines[i] || null;
        }
      }

      return null;
    } catch (error) {
      log.error('Failed to get blame at revision', error, {
        file: path.basename(filePath),
        revision,
        lineContent: lineContent.substring(0, 30),
      });
      return null;
    }
  }

  /**
   * Get full file blame (with cache)
   */
  private async getBlame(filePath: string): Promise<FileBlame | null> {
    // Check cache first
    const cached = this.cache.get(filePath);
    if (cached) {
      log.debug('Cache hit for git blame', { file: path.basename(filePath), lines: cached.lines.length });
      return cached;
    }

    log.debug('Cache miss, executing git blame', { file: path.basename(filePath) });

    // Execute git blame
    const blame = await this.executeGitBlame(filePath);
    if (blame) {
      this.cache.set(filePath, blame);
      // Collect unique commit hashes for context
      const commitHashes = [...new Set(blame.lines.map(l => l?.commitHash?.substring(0, 10)).filter(Boolean))];
      log.debug('Git blame completed', {
        file: path.basename(filePath),
        lines: blame.lines.length,
        commits: commitHashes,
      });
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
      const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);

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
      log.error('Failed to execute git blame', error, { file: path.basename(filePath) });
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
        log.debug('Git user name retrieved', { userName });
        return userName;
      }
    } catch (error) {
      // Git config command failed or user.name not set
      log.warn('Failed to get git user name, using fallback', { error: String(error) });
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
