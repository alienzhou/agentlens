/**
 * Report Service for Agent Blame
 *
 * Core business logic for generating and managing issue reports.
 * This service is platform-agnostic and can be used in both CLI and VS Code contexts.
 */

import { nanoid } from 'nanoid';
import type {
  ReportIssue,
  ReportCandidate,
  ReportMatchedRecord,
  UserFeedback,
  GenerateReportOptions,
  ReportDebugInfo,
} from './types.js';
import type { PerformanceMetrics } from '../performance/performance-tracker.js';
import type { AgentRecord, ContributorResult } from '../detection/contributor-detector.js';
import { DEFAULT_REPORT_OPTIONS, DEVELOPER_REPORT_OPTIONS } from './types.js';

/**
 * Generate a unique report ID
 * Format: {timestamp}-{8-character nanoid}
 */
export function generateReportId(timestamp: number): string {
  return `${timestamp}-${nanoid(8)}`;
}

/**
 * Format timestamp to human-readable string
 * Format: "YYYY-MM-DD HH:mm:ss"
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format date to directory name
 * Format: "YYYY-MM-DD"
 */
export function formatDateForDirectory(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extended hunk information for report generation
 */
export interface ExtendedHunkInfo {
  /** File path (relative) */
  filePath: string;
  /** Line range [start, end] */
  lineRange: [number, number];
  /** Added lines content */
  addedLines: string[];
}

/**
 * Extended match result for report generation
 */
export interface ExtendedMatchResult extends ContributorResult {
  /** Agent type (if available) */
  agent?: string;
}

/**
 * Generate a report issue from the given data
 *
 * @param hunk - The git hunk being reported
 * @param matchResult - The contributor detection result
 * @param candidates - All candidate agent records considered
 * @param environment - Environment information
 * @param options - Report generation options
 * @param performance - Optional performance metrics
 * @param userFeedback - Optional user feedback
 * @returns The generated report issue
 */
export function generateReport(
  hunk: ExtendedHunkInfo,
  matchResult: ExtendedMatchResult,
  candidates: AgentRecord[],
  environment: {
    agentLensVersion: string;
    vscodeVersion: string;
    platform: string;
  },
  options: GenerateReportOptions = {},
  performance?: PerformanceMetrics,
  userFeedback?: UserFeedback
): ReportIssue {
  const opts = options.developerMode
    ? { ...DEVELOPER_REPORT_OPTIONS, ...options }
    : { ...DEFAULT_REPORT_OPTIONS, ...options };

  const timestamp = Date.now();
  const reportId = generateReportId(timestamp);
  const hunkContent = hunk.addedLines.join('\n');

  // Build matched record info if available
  let matchedRecord: ReportMatchedRecord | undefined;
  if (matchResult.matchedRecord) {
    const record = matchResult.matchedRecord;
    matchedRecord = {
      recordId: record.id,
      timestamp: record.timestamp,
      timestampHuman: formatTimestamp(record.timestamp),
      sessionId: record.sessionSource.sessionId,
      agent: record.sessionSource.agent,
      content: record.addedLines.join('\n'),
    };
  }

  // Build candidates list
  const reportCandidates: ReportCandidate[] = candidates
    .slice(0, opts.maxCandidates)
    .map((candidate) => ({
      recordId: candidate.id,
      similarity: calculateSimilarity(hunk.addedLines, candidate.addedLines),
      timestamp: candidate.timestamp,
      timestampHuman: formatTimestamp(candidate.timestamp),
      contentPreview: candidate.addedLines.join('\n').slice(0, opts.maxPreviewLength),
    }));

  // Build debug info if in developer mode
  let debug: ReportDebugInfo | undefined;
  if (opts.developerMode && performance) {
    debug = {
      filterSteps: {
        total: performance.dataLoading.recordCount,
        afterFilePathFilter: performance.filtering.filePathCandidates,
        afterTimeWindowFilter: performance.filtering.timeWindowCandidates,
        afterLengthFilter: performance.filtering.lengthCandidates,
      },
      allCandidates: candidates.map((c) => ({
        recordId: c.id,
        similarity: calculateSimilarity(hunk.addedLines, c.addedLines),
        timestamp: c.timestamp,
      })),
    };
  }

  return {
    reportId,
    timestamp,
    timestampHuman: formatTimestamp(timestamp),

    file: {
      path: hunk.filePath,
      lineRange: hunk.lineRange,
    },

    hunk: {
      content: hunkContent,
      lineCount: hunk.addedLines.length,
      charCount: hunkContent.length,
    },

    matchResult: {
      contributor: matchResult.contributor,
      similarity: matchResult.similarity,
      confidence: matchResult.confidence,
      matchedRecord,
    },

    candidates: reportCandidates,

    sessionId: matchResult.matchedRecord?.sessionSource.sessionId,
    agent: matchResult.agent ?? matchResult.matchedRecord?.sessionSource.agent,

    userFeedback,

    environment,

    performance,

    debug,
  };
}

/**
 * Simple similarity calculation for candidates
 * This is a simplified version - the actual matching uses LevenshteinMatcher
 */
function calculateSimilarity(lines1: string[], lines2: string[]): number {
  const content1 = lines1.join('\n');
  const content2 = lines2.join('\n');

  if (content1 === content2) {
    return 1;
  }

  if (content1.length === 0 || content2.length === 0) {
    return 0;
  }

  // Simple Jaccard similarity for quick estimation
  const words1 = new Set(content1.split(/\s+/));
  const words2 = new Set(content2.split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Serialize report to JSON string
 */
export function serializeReport(report: ReportIssue): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Parse report from JSON string
 */
export function parseReport(json: string): ReportIssue {
  return JSON.parse(json) as ReportIssue;
}

/**
 * Get the file name for a report
 * Format: report-{reportId}.json
 */
export function getReportFileName(reportId: string): string {
  return `report-${reportId}.json`;
}

/**
 * Get the directory path for a report based on timestamp
 * Format: reports/{YYYY-MM-DD}/
 */
export function getReportDirectoryName(timestamp: number): string {
  return formatDateForDirectory(timestamp);
}

/**
 * Validate report structure
 */
export function validateReport(report: unknown): report is ReportIssue {
  if (typeof report !== 'object' || report === null) {
    return false;
  }

  const r = report as Record<string, unknown>;

  // Required fields
  if (typeof r.reportId !== 'string') return false;
  if (typeof r.timestamp !== 'number') return false;
  if (typeof r.timestampHuman !== 'string') return false;

  // File info
  if (typeof r.file !== 'object' || r.file === null) return false;
  const file = r.file as Record<string, unknown>;
  if (typeof file.path !== 'string') return false;
  if (!Array.isArray(file.lineRange) || file.lineRange.length !== 2) return false;

  // Hunk info
  if (typeof r.hunk !== 'object' || r.hunk === null) return false;
  const hunk = r.hunk as Record<string, unknown>;
  if (typeof hunk.content !== 'string') return false;
  if (typeof hunk.lineCount !== 'number') return false;
  if (typeof hunk.charCount !== 'number') return false;

  // Match result
  if (typeof r.matchResult !== 'object' || r.matchResult === null) return false;
  const matchResult = r.matchResult as Record<string, unknown>;
  if (typeof matchResult.contributor !== 'string') return false;
  if (typeof matchResult.similarity !== 'number') return false;
  if (typeof matchResult.confidence !== 'number') return false;

  // Candidates
  if (!Array.isArray(r.candidates)) return false;

  // Environment
  if (typeof r.environment !== 'object' || r.environment === null) return false;
  const env = r.environment as Record<string, unknown>;
  if (typeof env.agentLensVersion !== 'string') return false;
  if (typeof env.vscodeVersion !== 'string') return false;
  if (typeof env.platform !== 'string') return false;

  return true;
}
