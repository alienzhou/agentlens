/**
 * Report Issue types for Agent Blame
 *
 * Provides structured data for users to report matching issues,
 * enabling developers to troubleshoot and improve matching accuracy.
 */

import type { PerformanceMetrics } from '../performance/performance-tracker.js';
import type { ContributorType } from '../constants.js';

/**
 * User feedback about the matching result
 */
export interface UserFeedback {
  /** Optional comment describing the issue */
  comment?: string;
  /** Expected correct result */
  expectedResult?: 'should_be_ai' | 'should_be_human' | 'wrong_record';
}

/**
 * File information in the report
 */
export interface ReportFileInfo {
  /** Relative file path */
  path: string;
  /** Line range [start, end] */
  lineRange: [number, number];
}

/**
 * Hunk (code change) information in the report
 */
export interface ReportHunkInfo {
  /** Complete code content */
  content: string;
  /** Number of lines */
  lineCount: number;
  /** Number of characters */
  charCount: number;
}

/**
 * Matched record information in the report
 */
export interface ReportMatchedRecord {
  /** Record ID */
  recordId: string;
  /** Timestamp when the record was created */
  timestamp: number;
  /** Human-readable timestamp */
  timestampHuman: string;
  /** Session ID */
  sessionId: string;
  /** Agent type (e.g., 'cursor', 'claude-code') */
  agent: string;
  /** Complete content of the matched record */
  content: string;
}

/**
 * Match result information in the report
 */
export interface ReportMatchResult {
  /** Detected contributor type */
  contributor: ContributorType;
  /** Similarity score (0-1) */
  similarity: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Matched record details (if any) */
  matchedRecord?: ReportMatchedRecord;
}

/**
 * Candidate information in the report
 */
export interface ReportCandidate {
  /** Record ID */
  recordId: string;
  /** Similarity score (0-1) */
  similarity: number;
  /** Timestamp when the record was created */
  timestamp: number;
  /** Human-readable timestamp */
  timestampHuman: string;
  /** Content preview (first 200 characters) */
  contentPreview: string;
}

/**
 * Environment information in the report
 */
export interface ReportEnvironment {
  /** AgentLens extension version */
  agentLensVersion: string;
  /** VS Code version */
  vscodeVersion: string;
  /** Operating system platform */
  platform: string;
}

/**
 * Debug information (only included in developer mode)
 */
export interface ReportDebugInfo {
  /** Filter steps with candidate counts */
  filterSteps: {
    /** Total candidates before filtering */
    total: number;
    /** Candidates after file path filter */
    afterFilePathFilter: number;
    /** Candidates after time window filter */
    afterTimeWindowFilter: number;
    /** Candidates after length filter */
    afterLengthFilter: number;
  };
  /** Complete candidate list (optional, only in developer mode) */
  allCandidates?: Array<{
    recordId: string;
    similarity: number;
    timestamp: number;
  }>;
}

/**
 * Complete Report Issue structure
 *
 * Contains all information needed for developers to troubleshoot
 * matching issues reported by users.
 */
export interface ReportIssue {
  // ==================== Basic Information ====================

  /** Unique report ID (format: {timestamp}-{nanoid}) */
  reportId: string;
  /** Report creation timestamp */
  timestamp: number;
  /** Human-readable timestamp (e.g., "2026-02-12 08:58:46") */
  timestampHuman: string;

  // ==================== File Information ====================

  /** File information */
  file: ReportFileInfo;

  // ==================== Code Content ====================

  /** Hunk (code change) information */
  hunk: ReportHunkInfo;

  // ==================== Match Result ====================

  /** Match result information */
  matchResult: ReportMatchResult;

  // ==================== Candidates ====================

  /** Top candidates (5-10 depending on mode) */
  candidates: ReportCandidate[];

  // ==================== Session Information ====================

  /** Session ID (if available) */
  sessionId?: string;
  /** Agent type (if available) */
  agent?: string;

  // ==================== User Feedback ====================

  /** User feedback about the issue */
  userFeedback?: UserFeedback;

  // ==================== Environment ====================

  /** Environment information */
  environment: ReportEnvironment;

  // ==================== Performance Data ====================

  /** Performance metrics (from PerformanceTracker) */
  performance?: PerformanceMetrics;

  // ==================== Debug Information ====================

  /** Debug information (only included in developer mode) */
  debug?: ReportDebugInfo;
}

/**
 * Options for generating a report
 */
export interface GenerateReportOptions {
  /** Whether developer mode is enabled */
  developerMode?: boolean;
  /** Maximum number of candidates to include */
  maxCandidates?: number;
  /** Maximum content preview length */
  maxPreviewLength?: number;
}

/**
 * Default options for report generation
 */
export const DEFAULT_REPORT_OPTIONS: Required<GenerateReportOptions> = {
  developerMode: false,
  maxCandidates: 5,
  maxPreviewLength: 200,
};

/**
 * Options for developer mode report generation
 */
export const DEVELOPER_REPORT_OPTIONS: Required<GenerateReportOptions> = {
  developerMode: true,
  maxCandidates: 10,
  maxPreviewLength: 500,
};
