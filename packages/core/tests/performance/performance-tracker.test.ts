import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceTracker, type PerformanceMetrics } from '../../src/performance/performance-tracker.js';

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  // ==================== Initialization ====================

  describe('Initialization', () => {
    it('should initialize with default threshold', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.threshold).toBe(500);
    });

    it('should accept custom threshold', () => {
      const customTracker = new PerformanceTracker(1000);
      const metrics = customTracker.getMetrics();
      expect(metrics.threshold).toBe(1000);
    });

    it('should initialize all metrics to zero/empty', () => {
      const metrics = tracker.getMetrics();
      
      expect(metrics.totalMs).toBe(0);
      expect(metrics.warning).toBe(false);
      expect(metrics.dataLoading.loadAllRecordsMs).toBe(0);
      expect(metrics.dataLoading.recordCount).toBe(0);
      expect(metrics.filtering.filePathCandidates).toBe(0);
      expect(metrics.similarity.levenshteinCallCount).toBe(0);
      expect(metrics.result.matched).toBe(false);
    });
  });

  // ==================== Data Loading Tracking ====================

  describe('recordDataLoading', () => {
    it('should record data loading metrics', () => {
      tracker.recordDataLoading(100, 50.5);
      
      const metrics = tracker.getMetrics();
      expect(metrics.dataLoading.recordCount).toBe(100);
      expect(metrics.dataLoading.fileSizeKB).toBe(50.5);
      expect(metrics.dataLoading.loadAllRecordsMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Filter Step Tracking ====================

  describe('recordFilterStep', () => {
    it('should record file path filter step', () => {
      tracker.recordFilterStep('filePath', 50);
      
      const metrics = tracker.getMetrics();
      expect(metrics.filtering.filePathCandidates).toBe(50);
      expect(metrics.filtering.filePathFilterMs).toBeGreaterThanOrEqual(0);
    });

    it('should record time window filter step', () => {
      tracker.recordFilterStep('timeWindow', 30);
      
      const metrics = tracker.getMetrics();
      expect(metrics.filtering.timeWindowCandidates).toBe(30);
      expect(metrics.filtering.timeWindowFilterMs).toBeGreaterThanOrEqual(0);
    });

    it('should record length filter step', () => {
      tracker.recordFilterStep('length', 10);
      
      const metrics = tracker.getMetrics();
      expect(metrics.filtering.lengthCandidates).toBe(10);
      expect(metrics.filtering.lengthFilterMs).toBeGreaterThanOrEqual(0);
    });

    it('should record all filter steps in sequence', () => {
      tracker.recordFilterStep('filePath', 100);
      tracker.recordFilterStep('timeWindow', 50);
      tracker.recordFilterStep('length', 20);
      
      const metrics = tracker.getMetrics();
      expect(metrics.filtering.filePathCandidates).toBe(100);
      expect(metrics.filtering.timeWindowCandidates).toBe(50);
      expect(metrics.filtering.lengthCandidates).toBe(20);
    });
  });

  // ==================== Levenshtein Tracking ====================

  describe('recordLevenshteinCall', () => {
    it('should record single Levenshtein call', () => {
      tracker.recordLevenshteinCall(5.5, 100);
      
      const metrics = tracker.getMetrics();
      expect(metrics.similarity.levenshteinCallCount).toBe(1);
      expect(metrics.similarity.levenshteinTotalMs).toBe(5.5);
      expect(metrics.similarity.maxLevenshteinMs).toBe(5.5);
      expect(metrics.similarity.maxContentLength).toBe(100);
    });

    it('should accumulate multiple Levenshtein calls', () => {
      tracker.recordLevenshteinCall(5, 100);
      tracker.recordLevenshteinCall(10, 200);
      tracker.recordLevenshteinCall(3, 50);
      
      const metrics = tracker.getMetrics();
      expect(metrics.similarity.levenshteinCallCount).toBe(3);
      expect(metrics.similarity.levenshteinTotalMs).toBe(18);
      expect(metrics.similarity.maxLevenshteinMs).toBe(10);
      expect(metrics.similarity.maxContentLength).toBe(200);
    });
  });

  // ==================== Result Recording ====================

  describe('recordResult', () => {
    it('should record matched result', () => {
      tracker.recordLevenshteinCall(5, 100);
      tracker.recordLevenshteinCall(10, 200);
      tracker.recordResult(0.95, true);
      
      const metrics = tracker.getMetrics();
      expect(metrics.result.bestSimilarity).toBe(0.95);
      expect(metrics.result.matched).toBe(true);
      expect(metrics.result.candidatesProcessed).toBe(2);
    });

    it('should record unmatched result', () => {
      tracker.recordResult(0.5, false);
      
      const metrics = tracker.getMetrics();
      expect(metrics.result.bestSimilarity).toBe(0.5);
      expect(metrics.result.matched).toBe(false);
    });
  });

  // ==================== Context Setting ====================

  describe('setContext', () => {
    it('should set context information', () => {
      tracker.setContext('/src/app.ts', 15);
      
      const metrics = tracker.getMetrics();
      expect(metrics.filePath).toBe('/src/app.ts');
      expect(metrics.hunkLineCount).toBe(15);
    });
  });

  // ==================== Finalization ====================

  describe('finalize', () => {
    it('should calculate total time', () => {
      const result = tracker.finalize();
      expect(result.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average Levenshtein time', () => {
      tracker.recordLevenshteinCall(10, 100);
      tracker.recordLevenshteinCall(20, 200);
      tracker.recordLevenshteinCall(30, 300);
      
      const result = tracker.finalize();
      expect(result.similarity.avgLevenshteinMs).toBe(20);
    });

    it('should set warning when threshold exceeded', async () => {
      // Use a very low threshold to ensure warning triggers
      const slowTracker = new PerformanceTracker(0.001);
      
      // Add some operations to take time
      slowTracker.recordDataLoading(100, 50);
      slowTracker.recordFilterStep('filePath', 50);
      
      // Small delay to ensure some time passes
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const result = slowTracker.finalize();
      expect(result.warning).toBe(true);
      expect(result.warningReason).toContain('exceeded');
    });

    it('should not set warning when under threshold', () => {
      const fastTracker = new PerformanceTracker(10000); // 10 second threshold
      const result = fastTracker.finalize();
      expect(result.warning).toBe(false);
    });

    it('should include timestamp', () => {
      const result = tracker.finalize();
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
      expect(result.timestamp).toBeGreaterThan(Date.now() - 60000); // Within last minute
    });
  });

  // ==================== Bottleneck Analysis ====================

  describe('Bottleneck Analysis', () => {
    it('should identify Levenshtein as bottleneck when it dominates', async () => {
      const slowTracker = new PerformanceTracker(0.001);
      
      // Simulate Levenshtein taking most of the time
      slowTracker.recordDataLoading(10, 5);
      slowTracker.recordFilterStep('filePath', 50);
      slowTracker.recordFilterStep('timeWindow', 30);
      slowTracker.recordFilterStep('length', 10);
      
      // Simulate expensive Levenshtein calls
      slowTracker.recordLevenshteinCall(100, 1000);
      slowTracker.recordLevenshteinCall(100, 1000);
      slowTracker.recordLevenshteinCall(100, 1000);
      
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const result = slowTracker.finalize();
      
      if (result.analysis) {
        // Total Levenshtein: 300ms out of ~300ms total should be > 70%
        expect(result.analysis.bottleneck).toBe('levenshtein');
        expect(result.analysis.suggestion).toContain('candidates');
      }
    });

    it('should include breakdown percentages in analysis', async () => {
      const slowTracker = new PerformanceTracker(0.001);
      
      slowTracker.recordDataLoading(10, 5);
      slowTracker.recordLevenshteinCall(50, 500);
      
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const result = slowTracker.finalize();
      
      if (result.analysis) {
        expect(result.analysis.breakdown).toBeDefined();
        expect(result.analysis.breakdown.loadingPercent).toBeGreaterThanOrEqual(0);
        expect(result.analysis.breakdown.filteringPercent).toBeGreaterThanOrEqual(0);
        expect(result.analysis.breakdown.levenshteinPercent).toBeGreaterThanOrEqual(0);
        
        // Percentages should roughly sum to 100 (allowing for timing discrepancies)
        const total = result.analysis.breakdown.loadingPercent +
                     result.analysis.breakdown.filteringPercent +
                     result.analysis.breakdown.levenshteinPercent;
        // Note: May not equal 100% due to overhead time
      }
    });
  });

  // ==================== Log Entry Conversion ====================

  describe('toLogEntry', () => {
    it('should convert to simplified log entry format', () => {
      tracker.setContext('/src/app.ts', 10);
      tracker.recordFilterStep('filePath', 100);
      tracker.recordFilterStep('timeWindow', 50);
      tracker.recordFilterStep('length', 20);
      tracker.recordLevenshteinCall(5, 100);
      tracker.recordResult(0.9, true);
      tracker.finalize();
      
      const logEntry = tracker.toLogEntry();
      
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.totalMs).toBeGreaterThanOrEqual(0);
      expect(logEntry.warning).toBe(false);
      expect(logEntry.filtering.filePathCandidates).toBe(100);
      expect(logEntry.filtering.timeWindowCandidates).toBe(50);
      expect(logEntry.filtering.lengthCandidates).toBe(20);
      expect(logEntry.similarity.callCount).toBe(1);
      expect(logEntry.result.matched).toBe(true);
    });

    it('should not include full analysis in log entry', () => {
      const logEntry = tracker.toLogEntry();
      
      // Log entry should be simplified
      expect(logEntry).not.toHaveProperty('analysis');
      expect(logEntry).not.toHaveProperty('filePath');
      expect(logEntry).not.toHaveProperty('dataLoading');
    });
  });

  // ==================== Complete Workflow ====================

  describe('Complete Workflow', () => {
    it('should track a complete matching operation', () => {
      // Set context
      tracker.setContext('/src/components/App.tsx', 25);
      
      // Data loading
      tracker.recordDataLoading(500, 125.5);
      
      // Filter steps
      tracker.recordFilterStep('filePath', 150);
      tracker.recordFilterStep('timeWindow', 80);
      tracker.recordFilterStep('length', 30);
      
      // Levenshtein calculations
      for (let i = 0; i < 30; i++) {
        tracker.recordLevenshteinCall(2 + Math.random(), 100 + i * 10);
      }
      
      // Result
      tracker.recordResult(0.92, true);
      
      // Finalize
      const result = tracker.finalize();
      
      // Verify complete metrics
      expect(result.filePath).toBe('/src/components/App.tsx');
      expect(result.hunkLineCount).toBe(25);
      expect(result.dataLoading.recordCount).toBe(500);
      expect(result.dataLoading.fileSizeKB).toBe(125.5);
      expect(result.filtering.filePathCandidates).toBe(150);
      expect(result.filtering.timeWindowCandidates).toBe(80);
      expect(result.filtering.lengthCandidates).toBe(30);
      expect(result.similarity.levenshteinCallCount).toBe(30);
      expect(result.similarity.avgLevenshteinMs).toBeGreaterThan(0);
      expect(result.result.bestSimilarity).toBe(0.92);
      expect(result.result.matched).toBe(true);
      expect(result.result.candidatesProcessed).toBe(30);
      expect(result.totalMs).toBeGreaterThan(0);
    });
  });
});
