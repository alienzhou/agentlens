/**
 * Agents Tree Provider
 *
 * Displays connected AI agents in the sidebar with their status.
 */
import * as vscode from 'vscode';
import { CursorAdapter, ClaudeAdapter } from '@agentlens/hook';
import type { AgentAdapter } from '@agentlens/hook';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('agents-tree');

/**
 * Tree item representing an agent
 */
export class AgentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly agent: AgentAdapter,
    public readonly isConnected: boolean,
    public readonly isDetected: boolean
  ) {
    super(agent.config.name, vscode.TreeItemCollapsibleState.None);

    // Set icon and description based on status
    if (isConnected) {
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      this.description = 'Connected';
      this.contextValue = 'agent-connected';
    } else if (isDetected) {
      this.iconPath = new vscode.ThemeIcon('circle-outline');
      this.description = 'Detected';
      this.contextValue = 'agent-detected';
    } else {
      this.iconPath = new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'));
      this.description = 'Not detected';
      this.contextValue = 'agent-not-detected';
    }

    this.tooltip = this.buildTooltip();
  }

  private buildTooltip(): string {
    const lines = [this.agent.config.name];
    
    if (this.isConnected) {
      lines.push('Status: Connected');
      lines.push('Click to disconnect');
    } else if (this.isDetected) {
      lines.push('Status: Detected (not connected)');
      lines.push('Click to connect');
    } else {
      lines.push('Status: Not detected');
      lines.push('Install the agent to use');
    }

    return lines.join('\n');
  }
}

/**
 * Tree data provider for agents panel
 */
export class AgentsTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private adapters: AgentAdapter[] = [
    new CursorAdapter(),
    new ClaudeAdapter(),
  ];

  /**
   * Refresh the tree view
   */
  refresh(): void {
    log.debug('Refreshing agents tree');
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentTreeItem): Promise<AgentTreeItem[]> {
    // Only return items at root level
    if (element) {
      return [];
    }

    const items: AgentTreeItem[] = [];

    for (const adapter of this.adapters) {
      try {
        const detection = await adapter.detect();
        const isConnected = await adapter.isConnected();
        
        items.push(new AgentTreeItem(adapter, isConnected, detection.detected));
      } catch (error) {
        log.warn('Failed to check agent status', { agent: adapter.agentType, error: String(error) });
        items.push(new AgentTreeItem(adapter, false, false));
      }
    }

    return items;
  }

  /**
   * Get adapter by agent type
   */
  getAdapterByType(agentType: string): AgentAdapter | undefined {
    return this.adapters.find(a => a.agentType === agentType);
  }
}
