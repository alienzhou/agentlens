/**
 * Integration Tests for Agent Blame
 *
 * Tests the complete workflow from data creation through detection and reporting.
 * This validates that all components work together correctly.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { FileStorage, type CodeChangeRecord } from '../src/storage/file-storage.js';
import { CleanupManager } from '../src/storage/cleanup-manager.js';
import { ContributorDetector, type AgentRecord } from '../src/detection/contributor-detector.js';
import type { GitHunk } from '../src/models/git-types.js';
import { createSessionSource } from '../src/models/session-source.js';
import { generateReport, validateReport } from '../src/report/report-service.js';
import type { PerformanceMetrics } from '../src/performance/performance-tracker.js';

describe('Integration Tests', () => {
  let tempDir: string;
  let storage: FileStorage;
  let detector: ContributorDetector;
  let cleanupManager: CleanupManager;

  // ==================== Setup & Teardown ====================

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-blame-integration-'));
    storage = new FileStorage(tempDir);
    await storage.initialize();

    detector = new ContributorDetector();
    cleanupManager = new CleanupManager(storage.getHookDataPath());
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // ==================== Helper Functions ====================

  const getDateString = (daysAgo: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const createCodeChange = (
    overrides?: Partial<CodeChangeRecord>
  ): CodeChangeRecord => ({
    sessionId: 'session-123',
    agent: 'claude-code',
    timestamp: Date.now(),
    toolName: 'Edit',
    filePath: path.join(tempDir, 'src', 'app.ts'),
    newContent: 'const a = 1;\nconst b = 2;',
    success: true,
    ...overrides,
  });

  const createGitHunk = (
    addedLines: string[],
    filePath = path.join(tempDir, 'src', 'app.ts')
  ): GitHunk => ({
    id: `${filePath}:1:${addedLines.length}`,
    filePath,
    oldStart: 1,
    oldLines: 0,
    newStart: 1,
    newLines: addedLines.length,
    content: addedLines.map((l) => `+${l}`).join('\n'),
    addedLines,
    removedLines: [],
    header: `@@ -1,0 +1,${addedLines.length} @@`,
  });

  const convertToAgentRecords = (
    changes: CodeChangeRecord[]
  ): AgentRecord[] => {
    return changes
      .filter((c) => c.success && c.newContent)
      .map((c) => ({
        id: c.id ?? `${c.timestamp}-fallback`,
        sessionSource: createSessionSource(c.agent, c.sessionId, 1),
        filePath: c.filePath,
        content: c.newContent!,
        addedLines: c.newContent!.split('\n'),
        timestamp: c.timestamp,
      }));
  };

  // ==================== Complete Workflow Tests ====================

  describe('Complete Workflow: Storage → Detection → Report', () => {
    it('should detect AI contribution from stored code changes', async () => {
      // Step 1: Store code changes
      const codeContent = 'function calculateSum(a, b) {\n  return a + b;\n}';
      await storage.appendCodeChange(
        createCodeChange({
          filePath: path.join(tempDir, 'src', 'math.ts'),
          newContent: codeContent,
        })
      );

      // Step 2: Read back changes
      const recentChanges = await storage.getRecentCodeChanges(1);
      expect(recentChanges).toHaveLength(1);

      // Step 3: Convert to agent records
      const agentRecords = convertToAgentRecords(recentChanges);
      expect(agentRecords).toHaveLength(1);

      // Step 4: Create a git hunk representing the same code
      const hunk = createGitHunk(
        ['function calculateSum(a, b) {', '  return a + b;', '}'],
        path.join(tempDir, 'src', 'math.ts')
      );

      // Step 5: Detect contributor
      const result = detector.detect(hunk, agentRecords, { enableTracking: true });

      // Verify detection
      expect(result.contributor).toBe('ai');
      expect(result.similarity).toBeGreaterThanOrEqual(0.9);
      expect(result.matchedRecord).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();
    });

    it('should detect human contribution when no matching records', async () => {
      // Step 1: Store some code changes for a different file
      await storage.appendCodeChange(
        createCodeChange({
          filePath: path.join(tempDir, 'src', 'utils.ts'),
          newContent: 'export const VERSION = "1.0.0";',
        })
      );

      // Step 2: Read back changes
      const recentChanges = await storage.getRecentCodeChanges(1);
      const agentRecords = convertToAgentRecords(recentChanges);

      // Step 3: Create a git hunk for a different file
      const hunk = createGitHunk(
        ['const manualCode = "written by human";'],
        path.join(tempDir, 'src', 'manual.ts')
      );

      // Step 4: Detect contributor
      const result = detector.detect(hunk, agentRecords, { enableTracking: true });

      // Verify detection
      expect(result.contributor).toBe('human');
      expect(result.similarity).toBe(0);
      expect(result.performanceMetrics?.filtering.filePathCandidates).toBe(0);
    });

    it('should generate valid report from detection result', async () => {
      // Step 1: Store code changes
      const codeContent = 'const config = { debug: true };';
      await storage.appendCodeChange(
        createCodeChange({
          filePath: path.join(tempDir, 'src', 'config.ts'),
          newContent: codeContent,
        })
      );

      // Step 2: Detect
      const recentChanges = await storage.getRecentCodeChanges(1);
      const agentRecords = convertToAgentRecords(recentChanges);
      const hunk = createGitHunk(
        ['const config = { debug: true };'],
        path.join(tempDir, 'src', 'config.ts')
      );
      const detectionResult = detector.detect(hunk, agentRecords, { enableTracking: true });

      // Step 3: Generate report
      const report = generateReport(
        {
          filePath: hunk.filePath,
          lineRange: [1, 1] as [number, number],
          addedLines: hunk.addedLines,
        },
        {
          hunkId: hunk.id,
          contributor: detectionResult.contributor,
          similarity: detectionResult.similarity,
          confidence: detectionResult.confidence,
          matchedRecord: detectionResult.matchedRecord,
          agent: 'claude-code',
        },
        agentRecords,
        {
          agentBlameVersion: '0.1.0',
          vscodeVersion: '1.85.0',
          platform: 'darwin',
        },
        { developerMode: true },
        detectionResult.performanceMetrics
      );

      // Verify report
      expect(validateReport(report)).toBe(true);
      expect(report.matchResult.contributor).toBe('ai');
      expect(report.debug).toBeDefined();
      expect(report.performance).toBeDefined();
    });
  });

  // ==================== Large Dataset Tests ====================

  describe('Large Dataset: 100+ Records Across Multiple Days', () => {
    it('should handle 100 records across 10 days', async () => {
      const now = Date.now();

      // Create 100 records spread across 10 days
      for (let i = 0; i < 100; i++) {
        const daysAgo = Math.floor(i / 10);
        const timestamp = now - daysAgo * 24 * 60 * 60 * 1000;

        await storage.appendCodeChange(
          createCodeChange({
            sessionId: `session-${i}`,
            filePath: path.join(tempDir, `src/file${i % 10}.ts`),
            newContent: `const var${i} = ${i};`,
            timestamp,
          })
        );
      }

      // Verify storage
      const allChanges = await storage.getRecentCodeChanges(10);
      expect(allChanges).toHaveLength(100);

      // Verify sharding
      const changesDir = path.join(storage.getHookDataPath(), 'changes');
      const files = await fs.readdir(changesDir);
      expect(files.length).toBeGreaterThanOrEqual(1);
      expect(files.length).toBeLessThanOrEqual(10);
    });

    it('should efficiently filter large dataset through 4 levels', async () => {
      const now = Date.now();
      const targetFile = path.join(tempDir, 'src/target.ts');
      const targetContent = 'const targetVariable = "find me";';

      // Create 100 records with different characteristics
      const recordsCreated = {
        differentFile: 0,
        oldTimestamp: 0,
        differentLength: 0,
        candidates: 0,
      };

      for (let i = 0; i < 100; i++) {
        if (i < 50) {
          // 50 records for different files
          await storage.appendCodeChange(
            createCodeChange({
              sessionId: `session-${i}`,
              filePath: path.join(tempDir, `src/other${i}.ts`),
              newContent: `const var${i} = ${i};`,
              timestamp: now,
            })
          );
          recordsCreated.differentFile++;
        } else if (i < 70) {
          // 20 records for target file but old timestamps (outside 3-day window)
          await storage.appendCodeChange(
            createCodeChange({
              sessionId: `session-${i}`,
              filePath: targetFile,
              newContent: `const old${i} = ${i};`,
              timestamp: now - 5 * 24 * 60 * 60 * 1000,
            })
          );
          recordsCreated.oldTimestamp++;
        } else if (i < 85) {
          // 15 records for target file but very different content length
          await storage.appendCodeChange(
            createCodeChange({
              sessionId: `session-${i}`,
              filePath: targetFile,
              newContent: `const veryLongVariableName${i} = "This is a much longer content that should be filtered by length tolerance";`,
              timestamp: now,
            })
          );
          recordsCreated.differentLength++;
        } else {
          // 15 records that are actual candidates
          await storage.appendCodeChange(
            createCodeChange({
              sessionId: `session-${i}`,
              filePath: targetFile,
              newContent: i === 99 ? targetContent : `const similar${i} = "text";`,
              timestamp: now,
            })
          );
          recordsCreated.candidates++;
        }
      }

      // Read and convert to agent records
      const allChanges = await storage.getRecentCodeChanges(7);
      const agentRecords = convertToAgentRecords(allChanges);

      // Create hunk for target content
      const hunk = createGitHunk([targetContent], targetFile);

      // Detect with performance tracking
      const result = detector.detect(hunk, agentRecords, { enableTracking: true });

      // Verify progressive filtering
      const metrics = result.performanceMetrics;
      expect(metrics).toBeDefined();

      // Level 1: File path filter should reduce significantly
      // From 100 records, ~50 are for other files
      expect(metrics!.filtering.filePathCandidates).toBeLessThan(allChanges.length);

      // Level 2: Time window filter should reduce further
      // Some records have old timestamps
      expect(metrics!.filtering.timeWindowCandidates).toBeLessThanOrEqual(
        metrics!.filtering.filePathCandidates
      );

      // Level 3: Length filter should reduce further
      expect(metrics!.filtering.lengthCandidates).toBeLessThanOrEqual(
        metrics!.filtering.timeWindowCandidates
      );

      // Should find the exact match
      expect(result.contributor).toBe('ai');
      expect(result.similarity).toBe(1);
    });
  });

  // ==================== Cleanup Integration Tests ====================

  describe('Cleanup Integration', () => {
    it('should clean up old files while preserving recent data', async () => {
      const now = Date.now();

      // Create records for different days
      for (let daysAgo = 0; daysAgo < 15; daysAgo++) {
        const timestamp = now - daysAgo * 24 * 60 * 60 * 1000;
        await storage.appendCodeChange(
          createCodeChange({
            sessionId: `session-day-${daysAgo}`,
            timestamp,
          })
        );
      }

      // Verify all files created
      const beforeCleanup = await storage.getRecentCodeChanges(15);
      expect(beforeCleanup).toHaveLength(15);

      // Run cleanup with 7-day retention
      const cleanupResult = await cleanupManager.cleanup(7);

      // Should have removed old files
      expect(cleanupResult.filesRemoved).toBeGreaterThan(0);

      // Recent data should still be accessible
      const afterCleanup = await storage.getRecentCodeChanges(7);
      expect(afterCleanup).toHaveLength(7);

      // Old data should be gone
      const allData = await storage.getRecentCodeChanges(15);
      expect(allData.length).toBeLessThan(15);
    });
  });

  // ==================== Multi-Session Tests ====================

  describe('Multi-Session Handling', () => {
    it('should correctly attribute code from multiple sessions', async () => {
      const now = Date.now();
      const testFile = path.join(tempDir, 'src/multi.ts');

      // Session 1: Claude Code
      await storage.appendCodeChange(
        createCodeChange({
          sessionId: 'claude-session',
          agent: 'claude-code',
          filePath: testFile,
          newContent: 'function fromClaude() { return 1; }',
          timestamp: now - 1000,
        })
      );

      // Session 2: Cursor
      await storage.appendCodeChange(
        createCodeChange({
          sessionId: 'cursor-session',
          agent: 'cursor',
          filePath: testFile,
          newContent: 'function fromCursor() { return 2; }',
          timestamp: now,
        })
      );

      // Read and convert
      const changes = await storage.getRecentCodeChanges(1);
      const agentRecords = convertToAgentRecords(changes);

      // Test detection for Claude code
      const claudeHunk = createGitHunk(['function fromClaude() { return 1; }'], testFile);
      const claudeResult = detector.detect(claudeHunk, agentRecords);

      expect(claudeResult.contributor).toBe('ai');
      expect(claudeResult.matchedRecord?.sessionSource.agent).toBe('claude-code');

      // Test detection for Cursor code
      const cursorHunk = createGitHunk(['function fromCursor() { return 2; }'], testFile);
      const cursorResult = detector.detect(cursorHunk, agentRecords);

      expect(cursorResult.contributor).toBe('ai');
      expect(cursorResult.matchedRecord?.sessionSource.agent).toBe('cursor');
    });
  });

  // ==================== Prompt Tracking Integration ====================

  describe('Prompt Tracking Integration', () => {
    it('should track prompts and match them with code changes', async () => {
      const now = Date.now();
      const testFile = path.join(tempDir, 'src/prompted.ts');

      // Store prompt
      await storage.appendPrompt({
        sessionId: 'session-prompt',
        prompt: 'Create a function that calculates factorial',
        timestamp: now - 5000,
      });

      // Store code change (result of the prompt)
      await storage.appendCodeChange(
        createCodeChange({
          sessionId: 'session-prompt',
          filePath: testFile,
          newContent: 'function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }',
          timestamp: now,
        })
      );

      // Retrieve the prompt that triggered the change
      const prompt = await storage.getLatestPromptBefore('session-prompt', now);
      expect(prompt).toBe('Create a function that calculates factorial');

      // Verify session prompts
      const sessionPrompts = await storage.getPromptsBySession('session-prompt');
      expect(sessionPrompts).toHaveLength(1);
      expect(sessionPrompts[0]!.prompt).toContain('factorial');
    });
  });

  // ==================== Performance Tests ====================

  describe('Performance Benchmarks', () => {
    it('should process 100 records under 50ms', async () => {
      const now = Date.now();
      const testFile = path.join(tempDir, 'src/perf.ts');
      const targetContent = 'const target = 42;';

      // Create 100 records
      for (let i = 0; i < 100; i++) {
        await storage.appendCodeChange(
          createCodeChange({
            sessionId: `session-${i}`,
            filePath: testFile,
            newContent: i === 99 ? targetContent : `const var${i} = ${i};`,
            timestamp: now,
          })
        );
      }

      // Read records
      const changes = await storage.getRecentCodeChanges(1);
      const agentRecords = convertToAgentRecords(changes);
      expect(agentRecords).toHaveLength(100);

      // Create hunk
      const hunk = createGitHunk([targetContent], testFile);

      // Detect with timing
      const startTime = performance.now();
      const result = detector.detect(hunk, agentRecords, { enableTracking: true });
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should find the match
      expect(result.contributor).toBe('ai');
      expect(result.similarity).toBe(1);

      // Performance target: < 50ms for 100 records
      expect(duration).toBeLessThan(50);

      // Metrics should also reflect good performance
      expect(result.performanceMetrics?.totalMs).toBeLessThan(50);
    });

    it('should process 500 records under 150ms', async () => {
      const now = Date.now();
      const testFile = path.join(tempDir, 'src/perf500.ts');
      const targetContent = 'const target500 = "found";';

      // Create 500 records (spread across 5 files to make filtering effective)
      for (let i = 0; i < 500; i++) {
        const fileIndex = i % 5;
        const isTargetRecord = i === 499;
        const isTargetFile = fileIndex === 0;

        await storage.appendCodeChange(
          createCodeChange({
            sessionId: `session-${i}`,
            filePath: isTargetFile
              ? testFile
              : path.join(tempDir, `src/file${fileIndex}.ts`),
            newContent: isTargetRecord ? targetContent : `const var${i} = ${i};`,
            timestamp: now,
          })
        );
      }

      // Read records
      const changes = await storage.getRecentCodeChanges(1);
      const agentRecords = convertToAgentRecords(changes);
      expect(agentRecords).toHaveLength(500);

      // Create hunk
      const hunk = createGitHunk([targetContent], testFile);

      // Detect with timing
      const startTime = performance.now();
      const result = detector.detect(hunk, agentRecords, { enableTracking: true });
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should find a match (may be exact or similar)
      // The 500 records have 100 records for testFile (fileIndex === 0)
      // Filter will reduce to candidates, and we should get high similarity
      expect(result.similarity).toBeGreaterThan(0.5);

      // Performance target: < 150ms for 500 records
      expect(duration).toBeLessThan(150);
    });
  });

  // ==================== Error Handling Tests ====================

  describe('Error Handling', () => {
    it('should handle corrupted data gracefully', async () => {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const changesFile = path.join(
        storage.getHookDataPath(),
        'changes',
        `${dateStr}.jsonl`
      );

      // Write corrupted data
      await fs.writeFile(
        changesFile,
        'invalid json\n' +
          '{"broken": }\n' +
          JSON.stringify(
            createCodeChange({ sessionId: 'valid-session' })
          ) +
          '\n'
      );

      // Should not throw and should return valid records
      const changes = await storage.getRecentCodeChanges(1);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.sessionId).toBe('valid-session');
    });

    it('should handle missing directories gracefully', async () => {
      // Remove the changes directory
      await fs.rm(path.join(storage.getHookDataPath(), 'changes'), {
        recursive: true,
        force: true,
      });

      // Should not throw
      const changes = await storage.getRecentCodeChanges(7);
      expect(changes).toEqual([]);
    });
  });
});
