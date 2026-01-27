import { describe, it, expect } from 'vitest';
import { ContributorDetector, type AgentRecord } from '../src/detection/contributor-detector.js';
import type { GitHunk } from '../src/models/git-types.js';
import { createSessionSource } from '../src/models/session-source.js';

describe('ContributorDetector', () => {
  const detector = new ContributorDetector();

  const createTestHunk = (addedLines: string[], filePath = 'test.ts'): GitHunk => ({
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

  const createTestRecord = (addedLines: string[], filePath = 'test.ts'): AgentRecord => ({
    id: 'record_1',
    sessionSource: createSessionSource('cursor', 'session_1', 1),
    filePath,
    content: addedLines.join('\n'),
    addedLines,
    timestamp: Date.now(),
  });

  describe('detect', () => {
    it('should return human contribution when no records exist', () => {
      const hunk = createTestHunk(['const a = 1;', 'const b = 2;']);
      const result = detector.detect(hunk, []);

      expect(result.contributor).toBe('human');
      expect(result.similarity).toBe(0);
      expect(result.confidence).toBe(1);
    });

    it('should return human contribution for different file paths', () => {
      const hunk = createTestHunk(['const a = 1;'], 'file1.ts');
      const record = createTestRecord(['const a = 1;'], 'file2.ts');

      const result = detector.detect(hunk, [record]);

      expect(result.contributor).toBe('human');
    });

    it('should detect AI contribution for identical code', () => {
      const code = ['const a = 1;', 'const b = 2;', 'const c = 3;'];
      const hunk = createTestHunk(code);
      const record = createTestRecord(code);

      const result = detector.detect(hunk, [record]);

      expect(result.contributor).toBe('ai');
      expect(result.similarity).toBe(1);
      expect(result.matchedRecord).toBe(record);
    });

    it('should detect AI+modified for similar code', () => {
      const hunk = createTestHunk([
        'const a = 1;',
        'const b = 2;',
        'const c = 3;',
        'const d = 4;', // Added by human
      ]);
      const record = createTestRecord(['const a = 1;', 'const b = 2;', 'const c = 3;']);

      const result = detector.detect(hunk, [record]);

      // Similarity should be between 70% and 90%
      expect(result.similarity).toBeGreaterThanOrEqual(0.7);
      expect(result.similarity).toBeLessThan(0.9);
      expect(result.contributor).toBe('ai_modified');
    });

    it('should detect human contribution for very different code', () => {
      const hunk = createTestHunk(['function foo() {}', 'function bar() {}']);
      const record = createTestRecord(['const x = 1;', 'const y = 2;']);

      const result = detector.detect(hunk, [record]);

      expect(result.contributor).toBe('human');
      expect(result.similarity).toBeLessThan(0.7);
    });
  });

  describe('batchDetect', () => {
    it('should detect multiple hunks', () => {
      const hunks = [
        createTestHunk(['const a = 1;'], 'file1.ts'),
        createTestHunk(['const b = 2;'], 'file2.ts'),
      ];
      const records = [createTestRecord(['const a = 1;'], 'file1.ts')];

      const results = detector.batchDetect(hunks, records);

      expect(results).toHaveLength(2);
      expect(results[0]!.contributor).toBe('ai');
      expect(results[1]!.contributor).toBe('human');
    });
  });

  describe('getSummary', () => {
    it('should provide accurate summary statistics', () => {
      const results = [
        { hunkId: '1', contributor: 'ai' as const, similarity: 0.95, confidence: 0.8 },
        { hunkId: '2', contributor: 'ai' as const, similarity: 0.92, confidence: 0.75 },
        { hunkId: '3', contributor: 'ai_modified' as const, similarity: 0.8, confidence: 0.6 },
        { hunkId: '4', contributor: 'human' as const, similarity: 0.3, confidence: 0.9 },
      ];

      const summary = detector.getSummary(results);

      expect(summary.total).toBe(4);
      expect(summary.ai).toBe(2);
      expect(summary.aiModified).toBe(1);
      expect(summary.human).toBe(1);
      expect(summary.averageSimilarity).toBeCloseTo(0.7425);
    });
  });
});
