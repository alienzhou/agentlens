import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateReport,
  generateReportId,
  formatTimestamp,
  formatDateForDirectory,
  serializeReport,
  parseReport,
  getReportFileName,
  getReportDirectoryName,
  validateReport,
  type ExtendedHunkInfo,
  type ExtendedMatchResult,
} from '../../src/report/report-service.js';
import type { AgentRecord } from '../../src/detection/contributor-detector.js';
import type { PerformanceMetrics } from '../../src/performance/performance-tracker.js';
import { createSessionSource } from '../../src/models/session-source.js';

describe('Report Service', () => {
  // ==================== Helper Functions ====================

  const createTestHunk = (
    addedLines: string[] = ['const a = 1;', 'const b = 2;'],
    filePath = '/src/app.ts'
  ): ExtendedHunkInfo => ({
    filePath,
    lineRange: [10, 12] as [number, number],
    addedLines,
  });

  const createTestMatchResult = (
    overrides?: Partial<ExtendedMatchResult>
  ): ExtendedMatchResult => ({
    hunkId: 'hunk-1',
    contributor: 'ai',
    similarity: 0.95,
    confidence: 0.85,
    matchedRecord: createTestAgentRecord(),
    agent: 'cursor',
    ...overrides,
  });

  const createTestAgentRecord = (
    overrides?: Partial<AgentRecord>
  ): AgentRecord => ({
    id: 'record-123',
    sessionSource: createSessionSource('cursor', 'session-abc', 1),
    filePath: '/src/app.ts',
    content: 'const a = 1;\nconst b = 2;',
    addedLines: ['const a = 1;', 'const b = 2;'],
    timestamp: Date.now() - 60000, // 1 minute ago
    ...overrides,
  });

  const createTestEnvironment = () => ({
    agentLensVersion: '0.1.0',
    vscodeVersion: '1.85.0',
    platform: 'darwin',
  });

  const createTestPerformanceMetrics = (): PerformanceMetrics => ({
    totalMs: 125,
    warning: false,
    threshold: 500,
    dataLoading: {
      loadAllRecordsMs: 25,
      recordCount: 100,
      fileSizeKB: 50,
    },
    filtering: {
      filePathFilterMs: 5,
      filePathCandidates: 50,
      timeWindowFilterMs: 3,
      timeWindowCandidates: 30,
      lengthFilterMs: 2,
      lengthCandidates: 15,
    },
    similarity: {
      levenshteinTotalMs: 45,
      levenshteinCallCount: 15,
      avgLevenshteinMs: 3,
      maxLevenshteinMs: 8,
      avgContentLength: 150,
      maxContentLength: 300,
    },
    result: {
      bestSimilarity: 0.95,
      candidatesProcessed: 15,
      matched: true,
    },
    timestamp: Date.now(),
    filePath: '/src/app.ts',
    hunkLineCount: 5,
  });

  // ==================== ID Generation Tests ====================

  describe('generateReportId', () => {
    it('should generate unique report IDs', () => {
      const timestamp = Date.now();
      const id1 = generateReportId(timestamp);
      const id2 = generateReportId(timestamp);

      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in report ID', () => {
      const timestamp = 1707696000000; // Fixed timestamp
      const id = generateReportId(timestamp);

      expect(id).toMatch(/^1707696000000-[A-Za-z0-9_-]{8}$/);
    });

    it('should generate 8-character nanoid suffix', () => {
      const id = generateReportId(Date.now());
      const parts = id.split('-');
      const suffix = parts[parts.length - 1];

      expect(suffix).toHaveLength(8);
    });
  });

  // ==================== Timestamp Formatting Tests ====================

  describe('formatTimestamp', () => {
    it('should format timestamp to human-readable string', () => {
      // 2026-02-12 08:00:00 UTC+8
      const timestamp = new Date('2026-02-12T00:00:00Z').getTime();
      const formatted = formatTimestamp(timestamp);

      // Should be in format YYYY-MM-DD HH:mm:ss
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should handle different timestamps correctly', () => {
      const midnight = new Date('2026-01-01T00:00:00').getTime();
      const formatted = formatTimestamp(midnight);

      expect(formatted).toContain('2026-01-01');
      expect(formatted).toContain('00:00:00');
    });
  });

  describe('formatDateForDirectory', () => {
    it('should format date for directory name', () => {
      const timestamp = new Date('2026-02-12T08:00:00').getTime();
      const dateStr = formatDateForDirectory(timestamp);

      expect(dateStr).toBe('2026-02-12');
    });

    it('should pad single-digit months and days', () => {
      const timestamp = new Date('2026-01-05T08:00:00').getTime();
      const dateStr = formatDateForDirectory(timestamp);

      expect(dateStr).toBe('2026-01-05');
    });
  });

  // ==================== Report Generation Tests ====================

  describe('generateReport', () => {
    it('should generate a valid report with all required fields', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const candidates = [createTestAgentRecord()];
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, candidates, environment);

      // Basic info
      expect(report.reportId).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.timestampHuman).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

      // File info
      expect(report.file.path).toBe('/src/app.ts');
      expect(report.file.lineRange).toEqual([10, 12]);

      // Hunk info
      expect(report.hunk.content).toBe('const a = 1;\nconst b = 2;');
      expect(report.hunk.lineCount).toBe(2);
      expect(report.hunk.charCount).toBeGreaterThan(0);

      // Match result
      expect(report.matchResult.contributor).toBe('ai');
      expect(report.matchResult.similarity).toBe(0.95);
      expect(report.matchResult.confidence).toBe(0.85);

      // Environment
      expect(report.environment).toEqual(environment);
    });

    it('should include matched record details when available', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const candidates = [createTestAgentRecord()];
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, candidates, environment);

      expect(report.matchResult.matchedRecord).toBeDefined();
      expect(report.matchResult.matchedRecord!.recordId).toBe('record-123');
      expect(report.matchResult.matchedRecord!.sessionId).toBe('session-abc');
      expect(report.matchResult.matchedRecord!.agent).toBe('cursor');
    });

    it('should handle no matched record gracefully', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult({ 
        matchedRecord: undefined, 
        contributor: 'human' 
      });
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);

      expect(report.matchResult.matchedRecord).toBeUndefined();
      expect(report.matchResult.contributor).toBe('human');
    });

    it('should include candidates with similarity and preview', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const candidates = [
        createTestAgentRecord({ id: 'record-1' }),
        createTestAgentRecord({ id: 'record-2' }),
        createTestAgentRecord({ id: 'record-3' }),
      ];
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, candidates, environment);

      expect(report.candidates).toHaveLength(3);
      expect(report.candidates[0]!.recordId).toBe('record-1');
      expect(report.candidates[0]!.similarity).toBeGreaterThanOrEqual(0);
      expect(report.candidates[0]!.contentPreview).toBeDefined();
    });

    it('should limit candidates to maxCandidates option', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const candidates = Array.from({ length: 20 }, (_, i) =>
        createTestAgentRecord({ id: `record-${i}` })
      );
      const environment = createTestEnvironment();

      const report = generateReport(
        hunk,
        matchResult,
        candidates,
        environment,
        { maxCandidates: 5 }
      );

      expect(report.candidates).toHaveLength(5);
    });

    it('should include user feedback when provided', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();
      const userFeedback = {
        comment: 'This was manually written code',
        expectedResult: 'should_be_human' as const,
      };

      const report = generateReport(
        hunk,
        matchResult,
        [],
        environment,
        {},
        undefined,
        userFeedback
      );

      expect(report.userFeedback).toEqual(userFeedback);
    });

    it('should include performance metrics when provided', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();
      const performance = createTestPerformanceMetrics();

      const report = generateReport(
        hunk,
        matchResult,
        [],
        environment,
        {},
        performance
      );

      expect(report.performance).toBeDefined();
      expect(report.performance!.totalMs).toBe(125);
      expect(report.performance!.filtering.filePathCandidates).toBe(50);
    });

    it('should include debug info in developer mode', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const candidates = [createTestAgentRecord()];
      const environment = createTestEnvironment();
      const performance = createTestPerformanceMetrics();

      const report = generateReport(
        hunk,
        matchResult,
        candidates,
        environment,
        { developerMode: true },
        performance
      );

      expect(report.debug).toBeDefined();
      expect(report.debug!.filterSteps).toBeDefined();
      expect(report.debug!.filterSteps.total).toBe(100);
      expect(report.debug!.filterSteps.afterFilePathFilter).toBe(50);
      expect(report.debug!.filterSteps.afterTimeWindowFilter).toBe(30);
      expect(report.debug!.filterSteps.afterLengthFilter).toBe(15);
      expect(report.debug!.allCandidates).toBeDefined();
    });

    it('should NOT include debug info in normal mode', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();
      const performance = createTestPerformanceMetrics();

      const report = generateReport(
        hunk,
        matchResult,
        [],
        environment,
        { developerMode: false },
        performance
      );

      expect(report.debug).toBeUndefined();
    });

    it('should use developer options in developer mode', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const candidates = Array.from({ length: 20 }, (_, i) =>
        createTestAgentRecord({ id: `record-${i}` })
      );
      const environment = createTestEnvironment();
      const performance = createTestPerformanceMetrics();

      const report = generateReport(
        hunk,
        matchResult,
        candidates,
        environment,
        { developerMode: true },
        performance
      );

      // Developer mode should have 10 candidates by default
      expect(report.candidates).toHaveLength(10);
    });
  });

  // ==================== Serialization Tests ====================

  describe('serializeReport', () => {
    it('should serialize report to JSON string', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);
      const json = serializeReport(report);

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should produce formatted JSON', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);
      const json = serializeReport(report);

      // Should have indentation (pretty printed)
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('parseReport', () => {
    it('should parse JSON string back to report', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();

      const original = generateReport(hunk, matchResult, [], environment);
      const json = serializeReport(original);
      const parsed = parseReport(json);

      expect(parsed.reportId).toBe(original.reportId);
      expect(parsed.file.path).toBe(original.file.path);
      expect(parsed.matchResult.contributor).toBe(original.matchResult.contributor);
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseReport('invalid json')).toThrow();
    });
  });

  // ==================== File Name & Directory Tests ====================

  describe('getReportFileName', () => {
    it('should generate correct file name', () => {
      const reportId = '1707696000000-abc12345';
      const fileName = getReportFileName(reportId);

      expect(fileName).toBe('report-1707696000000-abc12345.json');
    });
  });

  describe('getReportDirectoryName', () => {
    it('should return date-based directory name', () => {
      const timestamp = new Date('2026-02-12T08:00:00').getTime();
      const dirName = getReportDirectoryName(timestamp);

      expect(dirName).toBe('2026-02-12');
    });
  });

  // ==================== Validation Tests ====================

  describe('validateReport', () => {
    it('should validate a valid report', () => {
      const hunk = createTestHunk();
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);

      expect(validateReport(report)).toBe(true);
    });

    it('should reject null', () => {
      expect(validateReport(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateReport('string')).toBe(false);
      expect(validateReport(123)).toBe(false);
      expect(validateReport([])).toBe(false);
    });

    it('should reject missing reportId', () => {
      const report = {
        timestamp: Date.now(),
        timestampHuman: '2026-02-12 08:00:00',
        file: { path: '/test.ts', lineRange: [1, 2] },
        hunk: { content: 'test', lineCount: 1, charCount: 4 },
        matchResult: { contributor: 'human', similarity: 0, confidence: 1 },
        candidates: [],
        environment: { agentBlameVersion: '0.1.0', vscodeVersion: '1.85.0', platform: 'darwin' },
      };

      expect(validateReport(report)).toBe(false);
    });

    it('should reject invalid file.lineRange', () => {
      const report = {
        reportId: 'test-123',
        timestamp: Date.now(),
        timestampHuman: '2026-02-12 08:00:00',
        file: { path: '/test.ts', lineRange: [1] }, // Invalid: should be [start, end]
        hunk: { content: 'test', lineCount: 1, charCount: 4 },
        matchResult: { contributor: 'human', similarity: 0, confidence: 1 },
        candidates: [],
        environment: { agentBlameVersion: '0.1.0', vscodeVersion: '1.85.0', platform: 'darwin' },
      };

      expect(validateReport(report)).toBe(false);
    });

    it('should reject non-array candidates', () => {
      const report = {
        reportId: 'test-123',
        timestamp: Date.now(),
        timestampHuman: '2026-02-12 08:00:00',
        file: { path: '/test.ts', lineRange: [1, 2] },
        hunk: { content: 'test', lineCount: 1, charCount: 4 },
        matchResult: { contributor: 'human', similarity: 0, confidence: 1 },
        candidates: 'not an array',
        environment: { agentBlameVersion: '0.1.0', vscodeVersion: '1.85.0', platform: 'darwin' },
      };

      expect(validateReport(report)).toBe(false);
    });

    it('should reject missing environment fields', () => {
      const report = {
        reportId: 'test-123',
        timestamp: Date.now(),
        timestampHuman: '2026-02-12 08:00:00',
        file: { path: '/test.ts', lineRange: [1, 2] },
        hunk: { content: 'test', lineCount: 1, charCount: 4 },
        matchResult: { contributor: 'human', similarity: 0, confidence: 1 },
        candidates: [],
        environment: { agentBlameVersion: '0.1.0' }, // Missing vscodeVersion and platform
      };

      expect(validateReport(report)).toBe(false);
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle empty hunk content', () => {
      const hunk = createTestHunk([]);
      const matchResult = createTestMatchResult({ contributor: 'human', similarity: 0 });
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);

      expect(report.hunk.content).toBe('');
      expect(report.hunk.lineCount).toBe(0);
      expect(report.hunk.charCount).toBe(0);
    });

    it('should handle very long content', () => {
      const longLines = Array.from({ length: 100 }, (_, i) => 
        `const variable${i} = "This is a very long line of code that exceeds normal length";`
      );
      const hunk = createTestHunk(longLines);
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);

      expect(report.hunk.lineCount).toBe(100);
      expect(report.hunk.charCount).toBeGreaterThan(5000);
    });

    it('should handle unicode content', () => {
      const unicodeLines = ['const 变量 = "你好世界";', 'const emoji = "🎉🚀";'];
      const hunk = createTestHunk(unicodeLines);
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);
      const json = serializeReport(report);
      const parsed = parseReport(json);

      expect(parsed.hunk.content).toContain('变量');
      expect(parsed.hunk.content).toContain('🎉');
    });

    it('should handle special characters in content', () => {
      const specialLines = ['const regex = /[a-z]+/g;', 'const json = {"key": "value"};'];
      const hunk = createTestHunk(specialLines);
      const matchResult = createTestMatchResult();
      const environment = createTestEnvironment();

      const report = generateReport(hunk, matchResult, [], environment);
      const json = serializeReport(report);
      
      expect(() => parseReport(json)).not.toThrow();
    });
  });
});
