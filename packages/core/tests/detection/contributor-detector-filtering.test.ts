import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContributorDetector, type AgentRecord, type DetectorConfig } from '../../src/detection/contributor-detector.js';
import type { GitHunk } from '../../src/models/git-types.js';
import { createSessionSource } from '../../src/models/session-source.js';
import { FILTERING_CONFIG, SIMILARITY_CONFIG } from '../../src/constants.js';

/**
 * Tests for the 4-level filtering optimization in ContributorDetector
 * 
 * Filtering levels:
 * 1. File path filtering - Only records for the same file
 * 2. Time window filtering - Only records within the configured time window
 * 3. Content length filtering - Filter out records with significantly different length
 * 4. Levenshtein similarity - Calculate actual similarity for remaining candidates
 */
describe('ContributorDetector - 4-Level Filtering', () => {
  let detector: ContributorDetector;

  // ==================== Helper Functions ====================

  const createTestHunk = (
    addedLines: string[],
    filePath = '/test/file.ts'
  ): GitHunk => ({
    id: `${filePath}:1:1`,
    filePath,
    oldStart: 1,
    oldLines: 0,
    newStart: 1,
    newLines: addedLines.length,
    content: addedLines.map((l) => `+${l}`).join('\n'),
    addedLines,
    removedLines: [],
    header: '@@ -1,0 +1,3 @@',
  });

  const createTestRecord = (
    addedLines: string[],
    options?: {
      filePath?: string;
      timestamp?: number;
      id?: string;
    }
  ): AgentRecord => ({
    id: options?.id ?? `record_${Date.now()}_${Math.random()}`,
    sessionSource: createSessionSource('cursor', 'session_1', 1),
    filePath: options?.filePath ?? '/test/file.ts',
    content: addedLines.join('\n'),
    addedLines,
    timestamp: options?.timestamp ?? Date.now(),
  });

  beforeEach(() => {
    detector = new ContributorDetector();
  });

  // ==================== Level 1: File Path Filtering ====================

  describe('Level 1: File Path Filtering', () => {
    it('should only consider records with matching file path', () => {
      const hunk = createTestHunk(['const a = 1;', 'const b = 2;'], '/src/app.ts');
      
      const records = [
        createTestRecord(['const a = 1;', 'const b = 2;'], { filePath: '/src/app.ts' }),
        createTestRecord(['const a = 1;', 'const b = 2;'], { filePath: '/src/other.ts' }),
        createTestRecord(['const a = 1;', 'const b = 2;'], { filePath: '/lib/utils.ts' }),
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      // Should match the first record with matching file path
      expect(result.contributor).toBe('ai');
      expect(result.matchedRecord?.filePath).toBe('/src/app.ts');
      
      // Check performance metrics
      expect(result.performanceMetrics?.filtering.filePathCandidates).toBe(1);
    });

    it('should return human when no records match file path', () => {
      const hunk = createTestHunk(['const a = 1;'], '/src/app.ts');
      
      const records = [
        createTestRecord(['const a = 1;'], { filePath: '/src/other.ts' }),
        createTestRecord(['const a = 1;'], { filePath: '/lib/utils.ts' }),
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.contributor).toBe('human');
      expect(result.performanceMetrics?.filtering.filePathCandidates).toBe(0);
    });

    it('should handle case-sensitive file paths correctly', () => {
      const hunk = createTestHunk(['const a = 1;'], '/src/App.ts');
      
      const records = [
        createTestRecord(['const a = 1;'], { filePath: '/src/app.ts' }), // lowercase
        createTestRecord(['const a = 1;'], { filePath: '/src/App.ts' }), // exact match
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.matchedRecord?.filePath).toBe('/src/App.ts');
    });
  });

  // ==================== Level 2: Time Window Filtering ====================

  describe('Level 2: Time Window Filtering', () => {
    it('should filter out records outside the time window', () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;

      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      
      const records = [
        createTestRecord(['const a = 1;'], { timestamp: now }),
        createTestRecord(['const a = 1;'], { timestamp: oneDayAgo }),
        createTestRecord(['const a = 1;'], { timestamp: fiveDaysAgo }), // Outside 3-day default window
      ];

      // Default time window is 3 days
      const result = detector.detect(hunk, records, { enableTracking: true });

      // Should have 2 candidates after time window filtering
      expect(result.performanceMetrics?.filtering.timeWindowCandidates).toBe(2);
    });

    it('should use configurable time window', () => {
      const now = Date.now();
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

      // Create detector with 1-day time window
      const shortWindowDetector = new ContributorDetector({ timeWindowDays: 1 });

      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      
      const records = [
        createTestRecord(['const a = 1;'], { timestamp: now }),
        createTestRecord(['const a = 1;'], { timestamp: twoDaysAgo }), // Outside 1-day window
      ];

      const result = shortWindowDetector.detect(hunk, records, { enableTracking: true });

      // Should have only 1 candidate after time window filtering
      expect(result.performanceMetrics?.filtering.timeWindowCandidates).toBe(1);
    });

    it('should include records at the boundary of time window', () => {
      const now = Date.now();
      // Exactly 3 days ago minus 1 second (should be included)
      const justWithinWindow = now - (3 * 24 * 60 * 60 * 1000) + 1000;

      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      
      const records = [
        createTestRecord(['const a = 1;'], { timestamp: justWithinWindow }),
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.performanceMetrics?.filtering.timeWindowCandidates).toBe(1);
    });
  });

  // ==================== Level 3: Content Length Filtering ====================

  describe('Level 3: Content Length Filtering', () => {
    it('should filter out records with significantly different content length', () => {
      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      
      // Short content (12 chars)
      // With 50% tolerance, acceptable range is ~8 to ~18 chars
      const records = [
        createTestRecord(['const a = 1;']), // Same length - match
        createTestRecord(['const a = 1; // short comment']), // ~30 chars - too long
        createTestRecord(['const veryLongVariableName = "This is a very long string content that exceeds tolerance";']), // Much longer - filtered
        createTestRecord(['a=1']), // Very short - might be filtered depending on tolerance
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      // Length filtering should reduce candidates
      expect(result.performanceMetrics?.filtering.lengthCandidates).toBeLessThan(
        result.performanceMetrics?.filtering.timeWindowCandidates ?? 0
      );
    });

    it('should use configurable length tolerance', () => {
      // Create detector with strict tolerance (10%)
      const strictDetector = new ContributorDetector({ lengthTolerance: 0.1 });

      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      
      const records = [
        createTestRecord(['const a = 1;']), // Exact match
        createTestRecord(['const a = 1; // comment']), // ~20% longer - filtered with 10% tolerance
      ];

      const result = strictDetector.detect(hunk, records, { enableTracking: true });

      // With strict tolerance, only exact match should remain
      expect(result.performanceMetrics?.filtering.lengthCandidates).toBe(1);
    });

    it('should handle empty content gracefully', () => {
      const hunk = createTestHunk([''], '/test/file.ts');
      
      const records = [
        createTestRecord(['']),
        createTestRecord(['const a = 1;']),
      ];

      // Should not crash and should return human for empty hunk
      const result = detector.detect(hunk, records);
      expect(result.contributor).toBe('human');
    });

    it('should correctly calculate length ratio', () => {
      // Hunk with 100 chars
      const longCode = 'const example = { name: "test", value: 42, enabled: true, items: [1, 2, 3] };';
      const hunk = createTestHunk([longCode], '/test/file.ts');
      
      // Record with similar length (within 50% tolerance)
      const similarLengthCode = 'const example = { name: "demo", value: 99, enabled: false, items: [4, 5] };';
      // Record with very different length (outside tolerance)
      const veryShortCode = 'x=1';

      const records = [
        createTestRecord([similarLengthCode]),
        createTestRecord([veryShortCode]),
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      // Similar length should pass, very short should be filtered
      expect(result.performanceMetrics?.filtering.lengthCandidates).toBe(1);
    });
  });

  // ==================== Level 4: Levenshtein Similarity ====================

  describe('Level 4: Levenshtein Similarity', () => {
    it('should calculate similarity for remaining candidates', () => {
      const hunk = createTestHunk(['const a = 1;', 'const b = 2;'], '/test/file.ts');
      
      const records = [
        createTestRecord(['const a = 1;', 'const b = 2;']), // Exact match
        createTestRecord(['const a = 1;', 'const b = 3;']), // Slightly different
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.contributor).toBe('ai');
      expect(result.similarity).toBe(1); // Exact match
      expect(result.performanceMetrics?.similarity.levenshteinCallCount).toBe(2);
    });

    it('should track Levenshtein performance metrics', () => {
      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      
      const records = [
        createTestRecord(['const a = 1;']),
        createTestRecord(['const b = 2;']),
        createTestRecord(['const c = 3;']),
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.performanceMetrics?.similarity.levenshteinCallCount).toBe(3);
      expect(result.performanceMetrics?.similarity.levenshteinTotalMs).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics?.similarity.avgLevenshteinMs).toBeGreaterThanOrEqual(0);
    });

    it('should find best match among multiple candidates', () => {
      const hunk = createTestHunk(['const sum = a + b;'], '/test/file.ts');
      
      const records = [
        createTestRecord(['const total = x + y;'], { id: 'poor-match' }),
        createTestRecord(['const sum = a + b;'], { id: 'exact-match' }),
        createTestRecord(['const sum = x + y;'], { id: 'partial-match' }),
      ];

      const result = detector.detect(hunk, records);

      expect(result.matchedRecord?.id).toBe('exact-match');
      expect(result.similarity).toBe(1);
    });
  });

  // ==================== Combined Filtering Flow ====================

  describe('Combined Filtering Flow', () => {
    it('should progressively reduce candidates through all 4 levels', () => {
      const now = Date.now();
      const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;
      
      const hunk = createTestHunk(['const a = 1;'], '/src/app.ts');
      
      const records = [
        // Level 1 filtered: wrong file path
        createTestRecord(['const a = 1;'], { filePath: '/src/other.ts' }),
        createTestRecord(['const a = 1;'], { filePath: '/lib/utils.ts' }),
        
        // Level 2 filtered: outside time window
        createTestRecord(['const a = 1;'], { filePath: '/src/app.ts', timestamp: fiveDaysAgo }),
        
        // Level 3 filtered: content too long
        createTestRecord(['const a = 1; const b = 2; const c = 3; const d = 4; const e = 5;'], { filePath: '/src/app.ts' }),
        
        // Passes all filters
        createTestRecord(['const a = 1;'], { filePath: '/src/app.ts', id: 'match-1' }),
        createTestRecord(['const a = 2;'], { filePath: '/src/app.ts', id: 'match-2' }),
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      // Verify progressive filtering
      const metrics = result.performanceMetrics;
      expect(metrics?.filtering.filePathCandidates).toBe(4); // 4 with correct path
      expect(metrics?.filtering.timeWindowCandidates).toBe(3); // 3 within time window
      expect(metrics?.filtering.lengthCandidates).toBe(2); // 2 with similar length
      expect(metrics?.similarity.levenshteinCallCount).toBe(2); // 2 similarity calculations
    });

    it('should short-circuit when candidates become 0', () => {
      const hunk = createTestHunk(['const a = 1;'], '/src/app.ts');
      
      // No records match the file path
      const records = [
        createTestRecord(['const a = 1;'], { filePath: '/src/other.ts' }),
      ];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.contributor).toBe('human');
      expect(result.performanceMetrics?.filtering.filePathCandidates).toBe(0);
      // Time window and length filtering should not be recorded
      expect(result.performanceMetrics?.filtering.timeWindowCandidates).toBe(0);
      expect(result.performanceMetrics?.filtering.lengthCandidates).toBe(0);
    });

    it('should handle large number of candidates efficiently', () => {
      const hunk = createTestHunk(['const target = 42;'], '/src/app.ts');
      
      // Create 100 records, most will be filtered
      const records: AgentRecord[] = [];
      
      // 50 wrong file path
      for (let i = 0; i < 50; i++) {
        records.push(createTestRecord([`const v${i} = ${i};`], { filePath: '/src/other.ts' }));
      }
      
      // 30 outside time window
      const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 30; i++) {
        records.push(createTestRecord([`const v${i} = ${i};`], { 
          filePath: '/src/app.ts',
          timestamp: oldTimestamp 
        }));
      }
      
      // 15 too different in length
      for (let i = 0; i < 15; i++) {
        records.push(createTestRecord([
          `const longVariable${i} = "This is a very long string that exceeds length tolerance for filtering purposes";`
        ], { filePath: '/src/app.ts' }));
      }
      
      // 5 actual candidates (including exact match)
      for (let i = 0; i < 4; i++) {
        records.push(createTestRecord([`const value${i} = ${i};`], { filePath: '/src/app.ts' }));
      }
      records.push(createTestRecord(['const target = 42;'], { filePath: '/src/app.ts' }));

      const result = detector.detect(hunk, records, { enableTracking: true });

      // Verify filtering reduces work
      expect(result.performanceMetrics?.filtering.filePathCandidates).toBe(50); // 100 - 50 wrong path
      expect(result.performanceMetrics?.filtering.timeWindowCandidates).toBe(20); // 50 - 30 old
      expect(result.performanceMetrics?.filtering.lengthCandidates).toBeLessThanOrEqual(5); // After length filter
      
      // Should still find the exact match
      expect(result.contributor).toBe('ai');
      expect(result.similarity).toBe(1);
    });
  });

  // ==================== Performance Tracking ====================

  describe('Performance Tracking', () => {
    it('should not track performance when tracking is disabled', () => {
      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      const records = [createTestRecord(['const a = 1;'])];

      const result = detector.detect(hunk, records); // No enableTracking option

      expect(result.performanceMetrics).toBeUndefined();
    });

    it('should track complete performance metrics when enabled', () => {
      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      const records = [createTestRecord(['const a = 1;'])];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.totalMs).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics?.filtering).toBeDefined();
      expect(result.performanceMetrics?.similarity).toBeDefined();
      expect(result.performanceMetrics?.result).toBeDefined();
    });

    it('should include context information in metrics', () => {
      const hunk = createTestHunk(
        ['line1', 'line2', 'line3'], 
        '/src/components/App.tsx'
      );
      const records = [createTestRecord(['line1', 'line2', 'line3'])];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.performanceMetrics?.filePath).toBe('/src/components/App.tsx');
      expect(result.performanceMetrics?.hunkLineCount).toBe(3);
    });

    it('should record result metrics', () => {
      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      const records = [createTestRecord(['const a = 1;'])];

      const result = detector.detect(hunk, records, { enableTracking: true });

      expect(result.performanceMetrics?.result.matched).toBe(true);
      expect(result.performanceMetrics?.result.bestSimilarity).toBe(1);
      expect(result.performanceMetrics?.result.candidatesProcessed).toBe(1);
    });
  });

  // ==================== Configuration Tests ====================

  describe('Configuration', () => {
    it('should respect all configuration options', () => {
      const config: DetectorConfig = {
        thresholdPureAi: 0.95,
        thresholdAiModified: 0.8,
        timeWindowDays: 7,
        lengthTolerance: 0.3,
        performanceThreshold: 1000,
      };

      const customDetector = new ContributorDetector(config);
      
      // Create a case that would be 'ai' with default thresholds but 'ai_modified' with custom
      const hunk = createTestHunk(['const a = 1;'], '/test/file.ts');
      const records = [createTestRecord(['const a = 2;'])]; // ~92% similar

      const result = customDetector.detect(hunk, records);

      // With 95% threshold, 92% similarity would be 'ai_modified', not 'ai'
      expect(result.contributor).not.toBe('ai');
    });

    it('should use default configuration values', () => {
      expect(FILTERING_CONFIG.DEFAULT_TIME_WINDOW_DAYS).toBe(3);
      expect(FILTERING_CONFIG.DEFAULT_LENGTH_TOLERANCE).toBe(0.5);
      expect(SIMILARITY_CONFIG.THRESHOLD_PURE_AI).toBe(0.9);
      expect(SIMILARITY_CONFIG.THRESHOLD_AI_MODIFIED).toBe(0.7);
    });
  });
});
