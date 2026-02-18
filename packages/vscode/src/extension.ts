/**
 * Agent Lens VS Code Extension
 *
 * Features:
 * 1. Provide Blame view to display code contributor information (AI vs Human)
 * 2. Provide command palette shortcuts
 * 3. Direct Agent connection management (no CLI dependency)
 *
 * References:
 * - Claude Code Hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
 * - Cursor Third Party Hooks: https://cursor.com/cn/docs/agent/third-party-hooks
 */
import * as vscode from 'vscode';
import { CursorAdapter, ClaudeAdapter, getHookCore } from '@agentlens/hook';
import type { AgentAdapter } from '@agentlens/hook';
import { SUPPORTED_AGENTS, CleanupManager, FileStorage, type ContributorType } from '@agentlens/core';
import type { CleanupConfig, CleanupResult } from '@agentlens/core';
import { LineBlameController } from './blame/line-blame.js';
import { ContributorService } from './blame/contributor-service.js';
import { LineHoverProvider } from './blame/line-hover.js';
import { ReportIssueService, type ExtendedContributorResult } from './report/report-issue-service.js';
import { BlameService } from './blame/blame-service.js';
import { createLogger, getLoggerConfig, disposeLogger, createModuleLogger } from './utils/logger.js';
import { AgentsTreeProvider, ActivityTreeProvider, ActivityTreeItem, ActivityDiffProvider, ACTIVITY_DIFF_SCHEME, openActivityDiff } from './views/index.js';

// Module logger for extension entry
const log = createModuleLogger('extension');

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext): void {
  // Get workspace root first (needed for logger)
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    console.warn('No workspace folder found');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Initialize logger
  const outputChannel = vscode.window.createOutputChannel('Agent Lens');
  context.subscriptions.push(outputChannel);

  const loggerConfig = getLoggerConfig();
  createLogger(outputChannel, workspaceRoot, loggerConfig);

  log.info('Extension activating', {
    workspaceRoot,
    logLevel: loggerConfig.level,
    logToFile: loggerConfig.logToFile,
  });

  // Initialize services
  const storage = new FileStorage(workspaceRoot);
  const blameService = new BlameService();
  const contributorService = new ContributorService(workspaceRoot);
  log.info('Services initialized');

  // Initialize cleanup manager
  const cleanupConfig = getCleanupConfig();
  const cleanupManager = new CleanupManager(
    storage.getHookDataPath(),
    cleanupConfig
  );

  // Run cleanup on startup (async, don't block activation)
  void cleanupManager.tryCleanup().then((result: CleanupResult | null) => {
    if (result && result.filesRemoved > 0) {
      log.info('Startup cleanup completed', {
        filesRemoved: result.filesRemoved,
        bytesFreed: result.bytesFreed,
      });
    }
  }).catch((err: unknown) => {
    log.warn('Startup cleanup failed', { error: String(err) });
  });

  // Set up periodic cleanup timer (check every hour, actual cleanup based on config)
  const cleanupTimer = setInterval(
    () => {
      void cleanupManager.tryCleanup().then((result: CleanupResult | null) => {
        if (result && result.filesRemoved > 0) {
          log.info('Periodic cleanup completed', {
            filesRemoved: result.filesRemoved,
            bytesFreed: result.bytesFreed,
          });
        }
      }).catch((err: unknown) => {
        log.warn('Periodic cleanup failed', { error: String(err) });
      });
    },
    60 * 60 * 1000 // Check every hour
  );

  context.subscriptions.push({
    dispose: () => clearInterval(cleanupTimer),
  });

  // Initialize line blame controller
  const lineBlameController = new LineBlameController(contributorService);
  context.subscriptions.push(lineBlameController);

  // Register hover provider
  const hoverProvider = new LineHoverProvider(blameService, contributorService);
  const hoverDisposable = vscode.languages.registerHoverProvider('*', hoverProvider);
  context.subscriptions.push(hoverDisposable);

  // Register commands
  registerCommands(context, cleanupManager, workspaceRoot);

  // Register tree view providers
  registerTreeViews(context, workspaceRoot);

  // Update status bar
  updateStatusBar(context);

  log.info('Extension activated successfully');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  log.info('Extension deactivating');
  disposeLogger();
}

/**
 * Register commands
 */
function registerCommands(
  context: vscode.ExtensionContext,
  cleanupManager: CleanupManager,
  workspaceRoot: string
): void {
  // Initialize ReportIssueService
  const reportIssueService = new ReportIssueService(workspaceRoot, '0.1.0');
  // Show Blame view
  const showBlameCmd = vscode.commands.registerCommand('agentlens.showBlame', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    // TODO: Implement Blame view display
    vscode.window.showInformationMessage('Agent Lens view - Coming soon!');
  });

  // Connect Agent - directly call hook adapter
  const connectAgentCmd = vscode.commands.registerCommand('agentlens.connectAgent', async () => {
    // Let user select agent
    const agentOptions = SUPPORTED_AGENTS.map((agent: string) => ({
      label: agent,
      description: getAgentDisplayName(agent),
    }));

    const selected = await vscode.window.showQuickPick(agentOptions, {
      placeHolder: 'Select an AI Agent to connect',
    });

    if (!selected) {
      return;
    }

    const agent = selected.label;
    await connectAgent(agent);
  });

  // Disconnect Agent - directly call hook adapter
  const disconnectAgentCmd = vscode.commands.registerCommand(
    'agentlens.disconnectAgent',
    async () => {
      // Let user select agent
      const agentOptions = SUPPORTED_AGENTS.map((agent: string) => ({
        label: agent,
        description: getAgentDisplayName(agent),
      }));

      const selected = await vscode.window.showQuickPick(agentOptions, {
        placeHolder: 'Select an AI Agent to disconnect',
      });

      if (!selected) {
        return;
      }

      const agent = selected.label;
      await disconnectAgent(agent);
    }
  );

  // Show Agent connection status
  const showStatusCmd = vscode.commands.registerCommand('agentlens.showStatus', async () => {
    await showAgentStatus();
  });

  // Show help information
  const showHelpCmd = vscode.commands.registerCommand('agentlens.showHelp', () => {
    const helpText = `
Agent Lens - AI Code Tracking Tool

Features:
- Connect/Disconnect AI Agents directly from VS Code
- View code contributor information (AI vs Human)
- Hover to see detailed blame information

Setup:
1. Use "Agent Lens: Connect Agent" command to connect
2. For Cursor: Enable "Third-party skills" in Settings

Supported Agents:
${SUPPORTED_AGENTS.map((agent: string) => `- ${getAgentDisplayName(agent)}`).join('\n')}
    `.trim();

    vscode.window.showInformationMessage(helpText, { modal: true });
  });

  // Copy commit hash to clipboard
  const copyCommitHashCmd = vscode.commands.registerCommand(
    'agentlens.copyCommitHash',
    async (hash: string) => {
      await vscode.env.clipboard.writeText(hash);
      vscode.window.showInformationMessage(`Copied: ${hash}`);
    }
  );

  // Copy session ID to clipboard
  const copySessionIdCmd = vscode.commands.registerCommand(
    'agentlens.copySessionId',
    async (sessionId: string) => {
      await vscode.env.clipboard.writeText(sessionId);
      vscode.window.showInformationMessage(`Copied: ${sessionId}`);
    }
  );

  // Manual cleanup command
  const cleanupCmd = vscode.commands.registerCommand(
    'agentlens.cleanup',
    async () => {
      log.info('Manual cleanup requested');
      
      try {
        const result = await cleanupManager.tryCleanup(true);
        
        if (result) {
          if (result.filesRemoved > 0) {
            const freedKB = Math.round(result.bytesFreed / 1024 * 100) / 100;
            vscode.window.showInformationMessage(
              `Cleanup completed: ${result.filesRemoved} files removed, ${freedKB}KB freed`
            );
            log.info('Manual cleanup completed', {
              filesRemoved: result.filesRemoved,
              bytesFreed: result.bytesFreed,
              removedFiles: result.removedFiles,
            });
          } else {
            vscode.window.showInformationMessage('No old files to clean up');
          }
          
          if (result.errors.length > 0) {
            log.warn('Cleanup encountered errors', { errors: result.errors });
          }
        }
      } catch (err) {
        log.error('Manual cleanup failed', err);
        vscode.window.showErrorMessage(
          `Cleanup failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );

  // Show cleanup stats command
  const cleanupStatsCmd = vscode.commands.registerCommand(
    'agentlens.cleanupStats',
    async () => {
      try {
        const stats = await cleanupManager.getStats();
        const config = cleanupManager.getConfig();
        
        const message = `
Data Statistics:
- Total files: ${stats.totalFiles}
- Total size: ${stats.totalSizeKB.toFixed(2)} KB
- Changes files: ${stats.filesByDir['changes'] || 0}
- Prompts files: ${stats.filesByDir['prompts'] || 0}
- Log files: ${stats.filesByDir['logs'] || 0}
${stats.oldestFile ? `- Oldest: ${stats.oldestFile}` : ''}
${stats.newestFile ? `- Newest: ${stats.newestFile}` : ''}

Cleanup Config:
- Auto cleanup: ${config.enabled ? 'Enabled' : 'Disabled'}
- Retention: ${config.retentionDays} days
- Check interval: ${config.checkIntervalHours} hours
        `.trim();
        
        vscode.window.showInformationMessage(message, { modal: true });
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to get stats: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );

  // Report Issue command
  const reportIssueCmd = vscode.commands.registerCommand(
    'agentlens.reportIssue',
    async (params: Record<string, unknown>) => {
      log.info('Report issue requested', {
        filePath: params.filePath,
        contributor: params.contributor,
      });

      try {
        // Build ExtendedContributorResult from params
        const result: ExtendedContributorResult = {
          hunkId: String(params.hunkId ?? ''),
          filePath: String(params.filePath ?? ''),
          lineRange: (params.lineRange as [number, number]) ?? [0, 0],
          addedLines: (params.addedLines as string[]) ?? [],
          contributor: (params.contributor as ContributorType) ?? 'human',
          similarity: Number(params.similarity ?? 0),
          confidence: Number(params.confidence ?? 1),
          matchedRecord: params.matchedRecord as ExtendedContributorResult['matchedRecord'],
          candidates: (params.candidates as ExtendedContributorResult['candidates']) ?? [],
          performance: params.performance as ExtendedContributorResult['performance'],
        };

        // Execute report flow
        await reportIssueService.executeReportFlow(result);
      } catch (error) {
        log.error('Failed to report issue', error);
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to report issue: ${message}`);
      }
    }
  );

  context.subscriptions.push(
    showBlameCmd,
    connectAgentCmd,
    disconnectAgentCmd,
    showStatusCmd,
    showHelpCmd,
    copyCommitHashCmd,
    copySessionIdCmd,
    cleanupCmd,
    cleanupStatsCmd,
    reportIssueCmd
  );
}

/**
 * Register tree view providers for the sidebar
 */
function registerTreeViews(context: vscode.ExtensionContext, workspaceRoot: string): void {
  // Register Activity diff provider
  const activityDiffProvider = new ActivityDiffProvider();
  const diffProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
    ACTIVITY_DIFF_SCHEME,
    activityDiffProvider
  );
  context.subscriptions.push(diffProviderDisposable);
  context.subscriptions.push(activityDiffProvider);

  // Set up periodic cleanup for diff content (every 30 minutes)
  const diffCleanupTimer = setInterval(() => {
    activityDiffProvider.cleanup();
  }, 30 * 60 * 1000);
  context.subscriptions.push({
    dispose: () => clearInterval(diffCleanupTimer),
  });

  // Register Agents tree view
  const agentsTreeProvider = new AgentsTreeProvider();
  const agentsTreeView = vscode.window.createTreeView('agentlens.agents', {
    treeDataProvider: agentsTreeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(agentsTreeView);

  // Register Activity tree view with diff provider
  const activityTreeProvider = new ActivityTreeProvider(workspaceRoot, activityDiffProvider);
  const activityTreeView = vscode.window.createTreeView('agentlens.activity', {
    treeDataProvider: activityTreeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(activityTreeView);

  // Register refresh commands
  const refreshAgentsCmd = vscode.commands.registerCommand('agentlens.refreshAgents', () => {
    agentsTreeProvider.refresh();
  });
  context.subscriptions.push(refreshAgentsCmd);

  const refreshActivityCmd = vscode.commands.registerCommand('agentlens.refreshActivity', () => {
    activityTreeProvider.refresh();
  });
  context.subscriptions.push(refreshActivityCmd);

  // Register command to open activity diff
  const openActivityDiffCmd = vscode.commands.registerCommand(
    'agentlens.openActivityDiff',
    async (args: { filePath: string; oldContent: string; newContent: string; title?: string } | ActivityTreeItem) => {
      // Handle both direct args and TreeItem (from context menu)
      if ('activity' in args) {
        // It's a TreeItem from context menu
        const change = args.activity.change;
        const fileName = change.filePath.split('/').pop() || 'file';
        const agentName = change.agent;
        const title = `${fileName} (${agentName} Change)`;
        await openActivityDiff(
          activityDiffProvider,
          change.filePath,
          change.oldContent ?? '',
          change.newContent ?? '',
          title
        );
      } else {
        // Direct call with args
        await openActivityDiff(
          activityDiffProvider,
          args.filePath,
          args.oldContent,
          args.newContent,
          args.title
        );
      }
    }
  );
  context.subscriptions.push(openActivityDiffCmd);

  // Register command to open activity file (for context menu)
  const openActivityFileCmd = vscode.commands.registerCommand(
    'agentlens.openActivityFile',
    async (item: { fileUri?: vscode.Uri } | vscode.Uri) => {
      // Handle both TreeItem (from context menu) and Uri (direct call)
      const uri = 'fileUri' in item ? item.fileUri : item;
      if (uri) {
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    }
  );
  context.subscriptions.push(openActivityFileCmd);

  log.info('Tree views registered');
}

/**
 * Update status bar
 */
function updateStatusBar(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(eye) Agent Lens';
  statusBarItem.tooltip = 'Agent Lens - AI Code Tracking\nClick for help';
  statusBarItem.command = 'agentlens.showHelp';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
}

/**
 * Get adapter for an agent type
 */
function getAdapter(agent: string): AgentAdapter | null {
  switch (agent.toLowerCase()) {
    case 'cursor':
    case 'cursor-cli':
      return new CursorAdapter();
    case 'claude':
    case 'claude-code':
      return new ClaudeAdapter();
    default:
      return null;
  }
}

/**
 * Get agent display name
 */
function getAgentDisplayName(agent: string): string {
  const adapter = getAdapter(agent);
  return adapter?.config.name || agent;
}

/**
 * Connect to an AI Agent
 */
async function connectAgent(agent: string): Promise<void> {
  log.info('Connect agent requested', { agent });

  const adapter = getAdapter(agent);

  if (!adapter) {
    log.warn('Unknown agent requested', { agent });
    vscode.window.showErrorMessage(`Unknown agent: ${agent}`);
    return;
  }

  try {
    vscode.window.showInformationMessage(`Connecting to ${adapter.config.name}...`);

    // Detect if Agent is installed
    const detection = await adapter.detect();
    log.debug('Agent detection result', { agent, detected: detection.detected, method: detection.method });

    if (!detection.detected) {
      const proceed = await vscode.window.showWarningMessage(
        `${adapter.config.name} not detected on this system. Create configuration anyway?`,
        'Yes',
        'No'
      );

      if (proceed !== 'Yes') {
        log.info('Agent connection cancelled by user', { agent });
        return;
      }
    } else {
      vscode.window.showInformationMessage(
        `${adapter.config.name} detected (${detection.method})`
      );
    }

    // Check if already connected
    const isConnected = await adapter.isConnected();
    if (isConnected) {
      log.info('Agent already connected', { agent });
      vscode.window.showInformationMessage(`Already connected to ${adapter.config.name}.`);
      return;
    }

    // Connect
    const hookCore = getHookCore();
    await adapter.connect(hookCore);

    log.info('Agent connected successfully', { agent });
    vscode.window.showInformationMessage(
      `Successfully connected to ${adapter.config.name}`,
      'View Status'
    );
  } catch (error) {
    log.error('Failed to connect agent', error, { agent });
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to connect to ${agent}: ${errorMessage}`);
  }
}

/**
 * Disconnect from an AI Agent
 */
async function disconnectAgent(agent: string): Promise<void> {
  const adapter = getAdapter(agent);

  if (!adapter) {
    vscode.window.showErrorMessage(`Unknown agent: ${agent}`);
    return;
  }

  try {
    const isConnected = await adapter.isConnected();
    if (!isConnected) {
      vscode.window.showInformationMessage(`Not connected to ${adapter.config.name}.`);
      return;
    }

    await adapter.disconnect();

    vscode.window.showInformationMessage(`Successfully disconnected from ${adapter.config.name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to disconnect from ${agent}: ${errorMessage}`);
  }
}

/**
 * Show Agent connection status
 */
async function showAgentStatus(): Promise<void> {
  const adapters: AgentAdapter[] = [new CursorAdapter(), new ClaudeAdapter()];
  const statusItems: string[] = [];

  for (const adapter of adapters) {
    try {
      const detection = await adapter.detect();
      const isConnected = await adapter.isConnected();

      let statusIcon: string;
      let statusText: string;

      if (isConnected) {
        statusIcon = '✓';
        statusText = 'Connected';
      } else if (detection.detected) {
        statusIcon = '○';
        statusText = 'Detected (not connected)';
      } else {
        statusIcon = '✗';
        statusText = 'Not detected';
      }

      statusItems.push(`${statusIcon} ${adapter.config.name}: ${statusText}`);
    } catch {
      statusItems.push(`✗ ${adapter.config.name}: Error checking status`);
    }
  }

  const statusText = `Agent Connection Status\n\n${statusItems.join('\n')}`;
  vscode.window.showInformationMessage(statusText, { modal: true });
}

/**
 * Get cleanup configuration from VSCode settings
 */
function getCleanupConfig(): CleanupConfig {
  const config = vscode.workspace.getConfiguration('agentLens');
  
  return {
    enabled: config.get<boolean>('autoCleanup.enabled', true),
    retentionDays: config.get<number>('autoCleanup.retentionDays', 7),
    checkIntervalHours: config.get<number>('autoCleanup.checkIntervalHours', 24),
  };
}
