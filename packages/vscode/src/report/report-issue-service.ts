/**
 * Report Issue Service for VS Code
 *
 * Handles the VS Code-specific aspects of report generation,
 * including clipboard operations and file saving.
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
  type ReportIssue,
  type UserFeedback,
  type PerformanceMetrics,
  type AgentRecord,
  generateReport,
  serializeReport,
  getReportFileName,
  getReportDirectoryName,
  DATA_DIR_NAME,
} from '@vibe-x/agentlens-core';
import type { LineContributorResult } from '../blame/contributor-service.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('report-issue-service');

/**
 * Extended contributor result with additional context for report generation
 */
export interface ExtendedContributorResult extends LineContributorResult {
  /** Hunk ID (generated from file path and line range) */
  hunkId: string;
  /** File path */
  filePath: string;
  /** Line range */
  lineRange: [number, number];
  /** Added lines content */
  addedLines: string[];
  /** All candidate records considered */
  candidates?: AgentRecord[];
  /** Performance metrics */
  performance?: PerformanceMetrics;
}

/**
 * Report Issue Service for VS Code extension
 */
export class ReportIssueService {
  private readonly reportsDir: string;
  private readonly extensionVersion: string;

  constructor(
    private workspaceRoot: string,
    extensionVersion: string = '0.1.0'
  ) {
    this.reportsDir = path.join(workspaceRoot, DATA_DIR_NAME, 'data', 'hooks', 'reports');
    this.extensionVersion = extensionVersion;
  }

  /**
   * Generate a report from contributor result and user feedback
   */
  async generateReportFromResult(
    result: ExtendedContributorResult,
    userFeedback?: UserFeedback
  ): Promise<ReportIssue> {
    const config = vscode.workspace.getConfiguration('agentLens');
    const developerMode = config.get<boolean>('developerMode', false);

    // Build environment info
    const environment = {
      agentLensVersion: this.extensionVersion,
      vscodeVersion: vscode.version,
      platform: process.platform,
    };

    // Build hunk info
    const hunk = {
      filePath: result.filePath,
      lineRange: result.lineRange,
      addedLines: result.addedLines,
    };

    // Build match result
    const matchResult = {
      hunkId: result.hunkId,
      contributor: result.contributor,
      similarity: result.similarity,
      confidence: result.confidence,
      matchedRecord: result.matchedRecord ? this.convertToAgentRecord(result) : undefined,
      agent: result.matchedRecord?.agent,
    };

    // Generate the report using core service
    const report = generateReport(
      hunk,
      matchResult,
      result.candidates ?? [],
      environment,
      { developerMode },
      result.performance,
      userFeedback
    );

    log.info('Report generated', {
      reportId: report.reportId,
      file: path.basename(result.filePath),
      contributor: result.contributor,
      similarity: result.similarity.toFixed(3),
      developerMode,
    });

    return report;
  }

  /**
   * Convert LineContributorResult to AgentRecord format
   */
  private convertToAgentRecord(result: LineContributorResult): AgentRecord | undefined {
    if (!result.matchedRecord) {
      return undefined;
    }

    return {
      id: `${result.matchedRecord.sessionId}-${result.matchedRecord.timestamp}`,
      sessionSource: {
        agent: result.matchedRecord.agent,
        sessionId: result.matchedRecord.sessionId,
        qaIndex: 1,
        timestamp: result.matchedRecord.timestamp,
        metadata: {
          userPrompt: result.matchedRecord.userPrompt,
        },
      },
      filePath: '', // Not needed for report
      content: '',
      addedLines: [],
      timestamp: result.matchedRecord.timestamp,
    };
  }

  /**
   * Save report to local file system
   * Returns the file path where the report was saved
   */
  async saveReport(report: ReportIssue): Promise<string> {
    const dateDir = getReportDirectoryName(report.timestamp);
    const dirPath = path.join(this.reportsDir, dateDir);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    const fileName = getReportFileName(report.reportId);
    const filePath = path.join(dirPath, fileName);

    const content = serializeReport(report);
    await fs.writeFile(filePath, content, 'utf-8');

    log.info('Report saved', {
      reportId: report.reportId,
      filePath: path.relative(this.workspaceRoot, filePath),
    });

    return filePath;
  }

  /**
   * Copy report to clipboard
   */
  async copyToClipboard(report: ReportIssue): Promise<void> {
    const json = serializeReport(report);
    await vscode.env.clipboard.writeText(json);

    log.info('Report copied to clipboard', {
      reportId: report.reportId,
      size: json.length,
    });
  }

  /**
   * Interactive flow to collect user feedback
   */
  async collectUserFeedback(): Promise<UserFeedback | undefined> {
    // Step 1: Optional comment
    const comment = await vscode.window.showInputBox({
      prompt: 'Describe the issue (optional)',
      placeHolder: 'e.g., This code was written by me manually',
    });

    // User cancelled
    if (comment === undefined) {
      return undefined;
    }

    // Step 2: Expected result
    const expectedResult = await vscode.window.showQuickPick(
      [
        { label: 'Should be AI', value: 'should_be_ai' as const },
        { label: 'Should be Human', value: 'should_be_human' as const },
        { label: 'Wrong record matched', value: 'wrong_record' as const },
        { label: 'Skip', value: undefined },
      ],
      {
        placeHolder: 'Expected correct result (optional)',
      }
    );

    // User cancelled
    if (expectedResult === undefined) {
      return undefined;
    }

    // Build user feedback if any input was provided
    if (comment || expectedResult.value) {
      return {
        comment: comment || undefined,
        expectedResult: expectedResult.value,
      };
    }

    return undefined;
  }

  /**
   * Interactive flow to select action (copy or save)
   */
  async selectAction(): Promise<'copy' | 'save' | undefined> {
    const action = await vscode.window.showQuickPick(
      [
        { label: '📋 Copy to clipboard', value: 'copy' as const },
        { label: '💾 Save to local', value: 'save' as const },
      ],
      {
        placeHolder: 'Select action',
      }
    );

    return action?.value;
  }

  /**
   * Execute the complete report issue flow
   */
  async executeReportFlow(result: ExtendedContributorResult): Promise<void> {
    try {
      // Step 1: Collect user feedback
      const userFeedback = await this.collectUserFeedback();

      // User cancelled the entire flow
      if (userFeedback === undefined && !await this.confirmContinueWithoutFeedback()) {
        return;
      }

      // Step 2: Generate report
      const report = await this.generateReportFromResult(result, userFeedback ?? undefined);

      // Step 3: Select action
      const action = await this.selectAction();

      if (!action) {
        return;
      }

      // Step 4: Execute action
      if (action === 'copy') {
        await this.copyToClipboard(report);
        vscode.window.showInformationMessage('Report copied to clipboard');
      } else if (action === 'save') {
        const filePath = await this.saveReport(report);
        const relativePath = path.relative(this.workspaceRoot, filePath);
        vscode.window.showInformationMessage(`Report saved: ${relativePath}`);
      }
    } catch (error) {
      log.error('Failed to generate report', error);
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to generate report: ${message}`);
    }
  }

  /**
   * Confirm if user wants to continue without feedback
   */
  private async confirmContinueWithoutFeedback(): Promise<boolean> {
    const result = await vscode.window.showQuickPick(
      [
        { label: 'Yes', description: 'Continue without feedback' },
        { label: 'No', description: 'Cancel' },
      ],
      {
        placeHolder: 'Continue generating report without feedback?',
      }
    );

    return result?.label === 'Yes';
  }
}
