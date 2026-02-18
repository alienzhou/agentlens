import * as vscode from 'vscode';
import * as path from 'node:path';
import { BlameService } from './blame-service.js';
import { ContributorService, type LineContributorResult } from './contributor-service.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('line-hover');

/**
 * Line Hover Provider - Shows detailed information on hover
 *
 * Displays different information based on code state:
 * - Committed code: git blame info (author, time, commit message)
 * - Uncommitted AI code: Agent name, Session ID, User prompt, Report Issue button
 * - Uncommitted Human code: "Human Edit, Not committed yet"
 * 
 * Developer Mode:
 * When enabled, shows additional debug information including similarity scores,
 * confidence levels, and candidate filtering statistics.
 */
export class LineHoverProvider implements vscode.HoverProvider {
  constructor(
    private blameService: BlameService,
    private contributorService: ContributorService
  ) {}

  /**
   * Check if developer mode is enabled
   */
  private isDeveloperMode(): boolean {
    const config = vscode.workspace.getConfiguration('agentLens');
    return config.get<boolean>('developerMode', false);
  }

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
    const fileName = path.basename(filePath);
    const line = position.line;
    const lineText = document.lineAt(line).text;

    log.debug('Hover requested', {
      file: fileName,
      line,
      isDirty: document.isDirty,
    });

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
      // Git blame failed (file is new/untracked) - treat as uncommitted
      const document = vscode.workspace.textDocuments.find((doc) => doc.fileName === filePath);
      const lineText = document?.lineAt(line).text ?? '';
      return this.provideUncommittedHover(filePath, lineText, line);
    }

    // Check if this is an uncommitted line
    const isUncommitted =
      blameInfo.commitHash === '0000000000000000000000000000000000000000' ||
      blameInfo.commitHash.startsWith('^');

    if (isUncommitted) {
      // Line is saved but not committed - use contributor detection
      const document = vscode.workspace.textDocuments.find((doc) => doc.fileName === filePath);
      const lineText = document?.lineAt(line).text ?? '';
      return this.provideUncommittedHover(filePath, lineText, line);
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
      return this.createHumanHover(filePath, lineText, line);
    }

    if (result.contributor === 'human') {
      return this.createHumanHover(filePath, lineText, line, result);
    }

    // AI-generated code
    if (!result.matchedRecord) {
      return this.createHumanHover(filePath, lineText, line, result);
    }

    const developerMode = this.isDeveloperMode();
    const agentName = this.contributorService.getAgentDisplayName(result.matchedRecord.agent);
    const markdown = new vscode.MarkdownString();
    markdown.supportThemeIcons = true;
    
    // Basic information: Agent name + time (GitLens style)
    const fullTime = this.formatFullTime(result.matchedRecord.timestamp);
    markdown.appendMarkdown(`🤖 **${agentName}**, ${fullTime}\n\n`);

    // User prompt (show as Task, most important context)
    if (result.matchedRecord.userPrompt) {
      // Truncate long prompts
      const promptPreview = result.matchedRecord.userPrompt.length > 200
        ? result.matchedRecord.userPrompt.substring(0, 200) + '...'
        : result.matchedRecord.userPrompt;
      markdown.appendMarkdown(`**Task**: "${promptPreview}"\n\n`);
    }

    // Uncommitted changes label
    markdown.appendMarkdown(`Uncommitted changes\n\n`);

    // Diff preview for the current line
    if (lineText && lineText.trim()) {
      markdown.appendCodeblock(`+ ${lineText}`, 'diff');
      markdown.appendMarkdown('\n');
    }

    // Session ID with copy button
    if (result.matchedRecord.sessionId) {
      const shortSessionId = result.matchedRecord.sessionId.substring(0, 13);
      const copySessionArgs = encodeURIComponent(JSON.stringify([result.matchedRecord.sessionId]));
      markdown.appendMarkdown(`Session: \`${shortSessionId}\` `);
      markdown.appendMarkdown(`[$(copy)](command:agentlens.copySessionId?${copySessionArgs} "Copy session ID")\n\n`);
    }

    // Developer mode extra information
    if (developerMode) {
      markdown.appendMarkdown(`---\n\n`);
      markdown.appendMarkdown(`🔍 **Debug Info**\n\n`);
      
      // Similarity and confidence
      const similarityPercent = (result.similarity * 100).toFixed(1);
      const confidencePercent = (result.confidence * 100).toFixed(1);
      markdown.appendMarkdown(`• Similarity: **${similarityPercent}%**\n\n`);
      markdown.appendMarkdown(`• Confidence: **${confidencePercent}%**\n\n`);
      
      // Contributor type
      const contributorLabel = result.contributor === 'ai' ? 'Pure AI' : 
                               result.contributor === 'ai_modified' ? 'AI Modified' : 'Human';
      markdown.appendMarkdown(`• Type: ${contributorLabel}\n\n`);
      
      // Tool name if available
      if (result.matchedRecord.toolName) {
        markdown.appendMarkdown(`• Tool: ${result.matchedRecord.toolName}\n\n`);
      }
    }

    // Add Report Issue button
    const reportParams = this.buildReportParams(filePath, lineText, line, result);
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`[🐛 Report Issue](command:agentlens.reportIssue?${encodeURIComponent(JSON.stringify(reportParams))})`);

    markdown.isTrusted = true;
    return new vscode.Hover(markdown);
  }

  /**
   * Create hover for human-edited code
   */
  private createHumanHover(
    filePath: string,
    lineText: string,
    line: number,
    result?: LineContributorResult
  ): vscode.Hover {
    const developerMode = this.isDeveloperMode();
    const markdown = new vscode.MarkdownString();
    markdown.supportThemeIcons = true;
    
    markdown.appendMarkdown(`👤 **Human Edit**, just now\n\n`);
    markdown.appendMarkdown(`Uncommitted changes\n\n`);

    // Diff preview for the current line
    if (lineText && lineText.trim()) {
      markdown.appendCodeblock(`+ ${lineText}`, 'diff');
      markdown.appendMarkdown('\n');
    }

    // Working Tree label
    markdown.appendMarkdown(`Working Tree\n\n`);

    // Developer mode extra information
    if (developerMode && result) {
      markdown.appendMarkdown(`---\n\n`);
      markdown.appendMarkdown(`🔍 **Debug Info**\n\n`);
      
      // Show why it was classified as human
      if (result.similarity === 0) {
        markdown.appendMarkdown(`• No matching AI records found\n\n`);
      } else {
        const similarityPercent = (result.similarity * 100).toFixed(1);
        markdown.appendMarkdown(`• Best similarity: ${similarityPercent}% (below threshold)\n\n`);
      }
      
      const confidencePercent = (result.confidence * 100).toFixed(1);
      markdown.appendMarkdown(`• Confidence: ${confidencePercent}%\n\n`);
      
      // Unchanged flag
      if (result.unchanged) {
        markdown.appendMarkdown(`• Status: Unchanged from HEAD\n\n`);
      }
    }

    // Add Report Issue button for human edits too (in case of wrong detection)
    const reportParams = this.buildReportParams(filePath, lineText, line, result ?? {
      contributor: 'human',
      similarity: 0,
      confidence: 1,
    });
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`[🐛 Report Issue](command:agentlens.reportIssue?${encodeURIComponent(JSON.stringify(reportParams))})`);

    markdown.isTrusted = true;
    return new vscode.Hover(markdown);
  }

  /**
   * Build parameters for Report Issue command
   */
  private buildReportParams(
    filePath: string,
    lineText: string,
    line: number,
    result: LineContributorResult
  ): Record<string, unknown> {
    // Generate a simple hunk ID based on file path and line
    const hunkId = `${filePath}:${line}`;

    return {
      hunkId,
      filePath,
      lineRange: [line, line] as [number, number],
      addedLines: [lineText],
      contributor: result.contributor,
      similarity: result.similarity,
      confidence: result.confidence,
      matchedRecord: result.matchedRecord,
      // Candidates will be populated by the service if available
      candidates: [],
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
}
