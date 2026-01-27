/**
 * Vibe Review VS Code Extension
 *
 * Features:
 * 1. Provide Blame view to display code contributor information (AI vs Human)
 * 2. Provide command palette shortcuts
 *
 * Note: Data capture is done by CLI hooks, not implemented in the extension.
 * - Claude Code: Native hooks support
 * - Cursor: Compatible with Claude Code hooks (requires enabling Third-party skills)
 *
 * References:
 * - Claude Code Hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
 * - Cursor Third Party Hooks: https://cursor.com/cn/docs/agent/third-party-hooks
 */
import * as vscode from 'vscode';

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Vibe Review extension is now active');

  // Register commands
  registerCommands(context);

  // Update status bar
  updateStatusBar(context);
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log('Vibe Review extension is now deactivated');
}

/**
 * Register commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Show Blame view
  const showBlameCmd = vscode.commands.registerCommand('vibe-review.showBlame', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    // TODO: Implement Blame view display
    vscode.window.showInformationMessage('Vibe Review Blame view - Coming soon!');
  });

  // Connect Agent (prompt user to use CLI)
  const connectAgentCmd = vscode.commands.registerCommand('vibe-review.connectAgent', async () => {
    const result = await vscode.window.showInformationMessage(
      'To connect an AI Agent, use the CLI command in terminal:',
      'Copy Command'
    );

    if (result === 'Copy Command') {
      await vscode.env.clipboard.writeText('vibe-review hook connect claude-code');
      vscode.window.showInformationMessage('Command copied! Paste in terminal to run.');
    }
  });

  // Disconnect Agent (prompt user to use CLI)
  const disconnectAgentCmd = vscode.commands.registerCommand(
    'vibe-review.disconnectAgent',
    async () => {
      const result = await vscode.window.showInformationMessage(
        'To disconnect an AI Agent, use the CLI command in terminal:',
        'Copy Command'
      );

      if (result === 'Copy Command') {
        await vscode.env.clipboard.writeText('vibe-review hook disconnect claude-code');
        vscode.window.showInformationMessage('Command copied! Paste in terminal to run.');
      }
    }
  );

  // Show help information
  const showHelpCmd = vscode.commands.registerCommand('vibe-review.showHelp', () => {
    const helpText = `
Vibe Review - AI Code Review Tool

Setup:
1. Install CLI: npm install -g @vibe-review/cli
2. Connect Agent: vibe-review hook connect claude-code
3. For Cursor: Enable "Third-party skills" in Settings

The hooks work with both Claude Code and Cursor (via compatibility).

Commands:
- vibe-review hook status    : Check connection status
- vibe-review hook list      : List supported agents
- vibe-review diff           : Show AI-generated code changes
    `.trim();

    vscode.window.showInformationMessage(helpText, { modal: true });
  });

  context.subscriptions.push(showBlameCmd, connectAgentCmd, disconnectAgentCmd, showHelpCmd);
}

/**
 * Update status bar
 */
function updateStatusBar(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(eye) Vibe Review';
  statusBarItem.tooltip = 'Vibe Review - AI Code Tracking\nClick for help';
  statusBarItem.command = 'vibe-review.showHelp';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
}
