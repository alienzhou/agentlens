import * as vscode from 'vscode';
import { BlameService } from './blame-service.js';
import { ContributorService } from './contributor-service.js';

/**
 * Line Hover Provider - Shows detailed information on hover
 *
 * Displays different information based on code state:
 * - Committed code: git blame info (author, time, commit message)
 * - Uncommitted AI code: Agent name, Session ID, User prompt
 * - Uncommitted Human code: "Human Edit, Not committed yet"
 */
export class LineHoverProvider implements vscode.HoverProvider {
  constructor(
    private blameService: BlameService,
    private contributorService: ContributorService
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Only support file scheme
    if (document.uri.scheme !== 'file') {
      return null;
    }

    const filePath = document.fileName;
    const line = position.line;
    const lineText = document.lineAt(line).text;

    // Check if file is dirty (uncommitted changes)
    if (document.isDirty) {
      // Uncommitted code - use contributor detection
      return this.provideUncommittedHover(filePath, lineText, line);
    }

    // Committed code - use git blame
    return this.provideCommittedHover(filePath, line);
  }

  /**
   * Provide hover for committed code (git blame)
   */
  private async provideCommittedHover(
    filePath: string,
    line: number
  ): Promise<vscode.Hover | null> {
    const blameInfo = await this.blameService.getBlameForLine(filePath, line);
    if (!blameInfo) {
      return null;
    }

    // Check if this is an uncommitted line
    const isUncommitted =
      blameInfo.commitHash === '0000000000000000000000000000000000000000' ||
      blameInfo.commitHash.startsWith('^');

    if (isUncommitted) {
      // This shouldn't happen if document.isDirty check worked, but handle it anyway
      return null;
    }

    // Format hover content
    const relativeTime = this.formatRelativeTime(blameInfo.timestamp);
    const shortHash = blameInfo.commitHash.substring(0, 7);

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${blameInfo.author}**, ${relativeTime}\n\n`);
    if (blameInfo.commitMessage) {
      markdown.appendMarkdown(`${blameInfo.commitMessage}\n\n`);
    }
    markdown.appendMarkdown(`\`${shortHash}\``);
    markdown.isTrusted = true;

    return new vscode.Hover(markdown);
  }

  /**
   * Provide hover for uncommitted code (contributor detection)
   */
  private async provideUncommittedHover(
    filePath: string,
    lineText: string,
    line: number
  ): Promise<vscode.Hover | null> {
    const result = await this.contributorService.detectLineContributor(filePath, lineText, line);
    if (!result) {
      // No match found, assume human
      return this.createHumanHover();
    }

    if (result.contributor === 'human') {
      return this.createHumanHover();
    }

    // AI-generated code
    if (!result.matchedRecord) {
      return this.createHumanHover();
    }

    const agentName = this.contributorService.getAgentDisplayName(result.matchedRecord.agent);
    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`🤖 **${agentName}**\n\n`);

    if (result.matchedRecord.sessionId) {
      const shortSessionId = result.matchedRecord.sessionId.substring(0, 13);
      markdown.appendMarkdown(`Session: \`${shortSessionId}\`\n\n`);
    }

    if (result.matchedRecord.userPrompt) {
      markdown.appendMarkdown(`Prompt: "${result.matchedRecord.userPrompt}"`);
    }

    markdown.isTrusted = true;
    return new vscode.Hover(markdown);
  }

  /**
   * Create hover for human-edited code
   */
  private createHumanHover(): vscode.Hover {
    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`👤 **Human Edit**\n\n`);
    markdown.appendMarkdown(`Not committed yet`);
    markdown.isTrusted = true;
    return new vscode.Hover(markdown);
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
      return years === 1 ? '1 year ago' : `${String(years)} years ago`;
    }
    if (months > 0) {
      return months === 1 ? '1 month ago' : `${String(months)} months ago`;
    }
    if (weeks > 0) {
      return weeks === 1 ? '1 week ago' : `${String(weeks)} weeks ago`;
    }
    if (days > 0) {
      return days === 1 ? '1 day ago' : `${String(days)} days ago`;
    }
    if (hours > 0) {
      return hours === 1 ? '1 hour ago' : `${String(hours)} hours ago`;
    }
    if (minutes > 0) {
      return minutes === 1 ? '1 minute ago' : `${String(minutes)} minutes ago`;
    }
    return 'just now';
  }
}
