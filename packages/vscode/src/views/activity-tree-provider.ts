/**
 * Activity Tree Provider
 *
 * Displays recent AI agent activity (code changes) in the sidebar.
 */
import * as vscode from 'vscode';
import * as path from 'node:path';
import { FileStorage, type CodeChangeRecord, type PromptRecord, resolveFilePath, isAbsolutePath } from '@agentlens/core';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('activity-tree');

/**
 * Activity record combining code change with associated prompt
 */
interface ActivityRecord {
  change: CodeChangeRecord;
  prompt?: PromptRecord;
}

/**
 * Tree item representing an activity entry
 */
export class ActivityTreeItem extends vscode.TreeItem {
  constructor(
    public readonly activity: ActivityRecord,
    public readonly workspaceRoot: string
  ) {
    const fileName = path.basename(activity.change.filePath);
    super(fileName, vscode.TreeItemCollapsibleState.None);

    this.description = this.buildDescription();
    this.tooltip = this.buildTooltip();
    this.iconPath = this.getAgentIcon();
    this.contextValue = 'activity';

    // Set command to open the file
    // Handle both relative and absolute paths:
    // - Relative paths are resolved against workspace root
    // - Absolute paths (for files outside project) are used directly
    const filePath = activity.change.filePath;
    const absoluteFilePath = isAbsolutePath(filePath) 
      ? filePath 
      : resolveFilePath(filePath, workspaceRoot);
    
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(absoluteFilePath)],
    };
  }

  private buildDescription(): string {
    const time = this.formatTime(this.activity.change.timestamp);
    const agent = this.formatAgentName(this.activity.change.agent);
    return `${agent} · ${time}`;
  }

  private buildTooltip(): string {
    const lines: string[] = [];
    const change = this.activity.change;

    lines.push(`File: ${change.filePath}`);
    lines.push(`Agent: ${this.formatAgentName(change.agent)}`);
    lines.push(`Time: ${new Date(change.timestamp).toLocaleString()}`);
    lines.push(`Tool: ${change.toolName}`);
    lines.push(`Status: ${change.success ? 'Success' : 'Failed'}`);

    if (this.activity.prompt) {
      const promptPreview = this.truncateText(this.activity.prompt.prompt, 200);
      lines.push('');
      lines.push(`Prompt: "${promptPreview}"`);
    }

    return lines.join('\n');
  }

  private getAgentIcon(): vscode.ThemeIcon {
    const agent = this.activity.change.agent.toLowerCase();
    
    if (agent.includes('claude')) {
      return new vscode.ThemeIcon('hubot');
    } else if (agent.includes('cursor')) {
      return new vscode.ThemeIcon('symbol-namespace');
    } else {
      return new vscode.ThemeIcon('robot');
    }
  }

  private formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  }

  private formatAgentName(agent: string): string {
    const lower = agent.toLowerCase();
    if (lower.includes('claude')) {
      return 'Claude';
    } else if (lower.includes('cursor')) {
      return 'Cursor';
    } else if (lower.includes('opencode')) {
      return 'OpenCode';
    } else if (lower.includes('gemini')) {
      return 'Gemini';
    }
    return agent;
  }

  private truncateText(text: string, maxLength: number): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.substring(0, maxLength - 3) + '...';
  }
}

/**
 * Separator item for grouping activities by date
 */
export class DateSeparatorItem extends vscode.TreeItem {
  constructor(date: string) {
    super(date, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'date-separator';
    this.iconPath = new vscode.ThemeIcon('calendar');
  }
}

/**
 * Tree data provider for activity panel
 */
export class ActivityTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private storage: FileStorage;
  private workspaceRoot: string;

  /** Maximum number of activities to display */
  private readonly maxItems = 50;

  /** Time window for fetching activities (days) */
  private readonly timeWindowDays = 7;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.storage = new FileStorage(workspaceRoot);
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    log.debug('Refreshing activity tree');
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // Only return items at root level
    if (element) {
      return [];
    }

    try {
      // Initialize storage
      await this.storage.initialize();

      // Get recent code changes
      const changes = await this.storage.getRecentCodeChanges(this.timeWindowDays);
      
      if (changes.length === 0) {
        return [this.createEmptyStateItem()];
      }

      // Get prompts for matching
      const prompts = await this.storage.getRecentPrompts(this.timeWindowDays);
      
      // Combine changes with prompts
      const activities = this.matchChangesWithPrompts(changes, prompts);
      
      // Sort by timestamp (most recent first)
      activities.sort((a, b) => b.change.timestamp - a.change.timestamp);
      
      // Limit items
      const limitedActivities = activities.slice(0, this.maxItems);
      
      // Create tree items
      return limitedActivities.map(activity => 
        new ActivityTreeItem(activity, this.workspaceRoot)
      );
    } catch (error) {
      log.error('Failed to load activities', error);
      return [this.createErrorStateItem()];
    }
  }

  /**
   * Match code changes with their associated prompts
   */
  private matchChangesWithPrompts(
    changes: CodeChangeRecord[],
    prompts: PromptRecord[]
  ): ActivityRecord[] {
    // Create a map of prompts by sessionId, sorted by timestamp (descending)
    const promptsBySession = new Map<string, PromptRecord[]>();
    
    for (const prompt of prompts) {
      const existing = promptsBySession.get(prompt.sessionId) ?? [];
      existing.push(prompt);
      promptsBySession.set(prompt.sessionId, existing);
    }

    // Sort prompts by timestamp within each session
    for (const sessionPrompts of promptsBySession.values()) {
      sessionPrompts.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Match each change with the most recent prompt before it
    return changes.map(change => {
      const sessionPrompts = promptsBySession.get(change.sessionId);
      
      if (!sessionPrompts) {
        return { change };
      }

      // Find the most recent prompt before this change
      const matchedPrompt = sessionPrompts.find(p => p.timestamp <= change.timestamp);
      
      return {
        change,
        prompt: matchedPrompt,
      };
    });
  }

  private createEmptyStateItem(): vscode.TreeItem {
    const item = new vscode.TreeItem('No recent activity', vscode.TreeItemCollapsibleState.None);
    item.description = 'Connect an agent to start tracking';
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
  }

  private createErrorStateItem(): vscode.TreeItem {
    const item = new vscode.TreeItem('Failed to load activity', vscode.TreeItemCollapsibleState.None);
    item.description = 'Click to retry';
    item.iconPath = new vscode.ThemeIcon('error');
    item.command = {
      command: 'agentlens.refreshActivity',
      title: 'Retry',
    };
    return item;
  }
}
