/**
 * Agent Blame VS Code Extension
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
import { CursorAdapter, ClaudeAdapter, getHookCore } from '@vibe-x/agent-blame';
import type { AgentAdapter } from '@vibe-x/agent-blame';
import { SUPPORTED_AGENTS } from '@agent-blame/core';
import { LineBlameController } from './blame/line-blame.js';
import { ContributorService } from './blame/contributor-service.js';
import { LineHoverProvider } from './blame/line-hover.js';
import { BlameService } from './blame/blame-service.js';
import { createLogger, getLoggerConfig, disposeLogger, createModuleLogger } from './utils/logger.js';

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
  const outputChannel = vscode.window.createOutputChannel('Agent Blame');
  context.subscriptions.push(outputChannel);

  const loggerConfig = getLoggerConfig();
  createLogger(outputChannel, workspaceRoot, loggerConfig);

  log.info('Extension activating', {
    workspaceRoot,
    logLevel: loggerConfig.level,
    logToFile: loggerConfig.logToFile,
  });

  // Initialize services
  const blameService = new BlameService();
  const contributorService = new ContributorService(workspaceRoot);
  log.info('Services initialized');

  // Initialize line blame controller
  const lineBlameController = new LineBlameController(contributorService);
  context.subscriptions.push(lineBlameController);

  // Register hover provider
  const hoverProvider = new LineHoverProvider(blameService, contributorService);
  const hoverDisposable = vscode.languages.registerHoverProvider('*', hoverProvider);
  context.subscriptions.push(hoverDisposable);

  // Register commands
  registerCommands(context);

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
function registerCommands(context: vscode.ExtensionContext): void {
  // Show Blame view
  const showBlameCmd = vscode.commands.registerCommand('agent-blame.showBlame', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    // TODO: Implement Blame view display
    vscode.window.showInformationMessage('Agent Blame view - Coming soon!');
  });

  // Connect Agent - directly call hook adapter
  const connectAgentCmd = vscode.commands.registerCommand('agent-blame.connectAgent', async () => {
    // Let user select agent
    const agentOptions = SUPPORTED_AGENTS.map((agent) => ({
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
    'agent-blame.disconnectAgent',
    async () => {
      // Let user select agent
      const agentOptions = SUPPORTED_AGENTS.map((agent) => ({
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
  const showStatusCmd = vscode.commands.registerCommand('agent-blame.showStatus', async () => {
    await showAgentStatus();
  });

  // Show help information
  const showHelpCmd = vscode.commands.registerCommand('agent-blame.showHelp', () => {
    const helpText = `
Agent Blame - AI Code Tracking Tool

Features:
- Connect/Disconnect AI Agents directly from VS Code
- View code contributor information (AI vs Human)
- Hover to see detailed blame information

Setup:
1. Use "Agent Blame: Connect Agent" command to connect
2. For Cursor: Enable "Third-party skills" in Settings

Supported Agents:
${SUPPORTED_AGENTS.map((agent) => `- ${getAgentDisplayName(agent)}`).join('\n')}
    `.trim();

    vscode.window.showInformationMessage(helpText, { modal: true });
  });

  // Copy commit hash to clipboard
  const copyCommitHashCmd = vscode.commands.registerCommand(
    'agent-blame.copyCommitHash',
    async (hash: string) => {
      await vscode.env.clipboard.writeText(hash);
      vscode.window.showInformationMessage(`Copied: ${hash}`);
    }
  );

  // Copy session ID to clipboard
  const copySessionIdCmd = vscode.commands.registerCommand(
    'agent-blame.copySessionId',
    async (sessionId: string) => {
      await vscode.env.clipboard.writeText(sessionId);
      vscode.window.showInformationMessage(`Copied: ${sessionId}`);
    }
  );

  context.subscriptions.push(
    showBlameCmd,
    connectAgentCmd,
    disconnectAgentCmd,
    showStatusCmd,
    showHelpCmd,
    copyCommitHashCmd,
    copySessionIdCmd
  );
}

/**
 * Update status bar
 */
function updateStatusBar(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(eye) Agent Blame';
  statusBarItem.tooltip = 'Agent Blame - AI Code Tracking\nClick for help';
  statusBarItem.command = 'agent-blame.showHelp';
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
