/**
 * Performance metrics for matching operations
 */
export interface PerformanceMetrics {
  // Overall performance
  totalMs: number;                    // Total duration (ms)
  warning: boolean;                   // Whether threshold exceeded
  warningReason?: string;             // Warning reason
  threshold: number;                  // Threshold (default 500ms)
  
  // Data loading phase
  dataLoading: {
    loadAllRecordsMs: number;         // Time to load records
    recordCount: number;              // Total records loaded
    fileSizeKB: number;               // File size read
  };
  
  // Filtering phase (each step)
  filtering: {
    // File path filtering
    filePathFilterMs: number;
    filePathCandidates: number;       // Candidates after filtering
    
    // Time window filtering
    timeWindowFilterMs: number;
    timeWindowCandidates: number;
    
    // Length filtering
    lengthFilterMs: number;
    lengthCandidates: number;
  };
  
  // Similarity calculation phase
  similarity: {
    levenshteinTotalMs: number;       // Total Levenshtein time
    levenshteinCallCount: number;     // Call count (= candidate count)
    avgLevenshteinMs: number;         // Average time per call
    maxLevenshteinMs: number;         // Max time per call
    
    avgContentLength: number;         // Average content length
    maxContentLength: number;         // Max content length
  };
  
  // Matching result
  result: {
    bestSimilarity: number;           // Best similarity score
    candidatesProcessed: number;      // Candidates processed
    matched: boolean;                 // Whether matched successfully
  };
  
  // Performance analysis (auto-generated when threshold exceeded)
  analysis?: {
    bottleneck: 'loading' | 'filtering' | 'levenshtein';
    suggestion: string;
    breakdown: {
      loadingPercent: number;
      filteringPercent: number;
      levenshteinPercent: number;
    };
  };
  
  // Context information
  timestamp: number;
  filePath: string;
  hunkLineCount: number;
}

/**
 * Performance log entry (simplified version for JSONL storage)
 */
export interface PerformanceLogEntry {
  timestamp: number;
  totalMs: number;
  warning: boolean;
  filtering: {
    filePathCandidates: number;
    timeWindowCandidates: number;
    lengthCandidates: number;
  };
  similarity: {
    levenshteinTotalMs: number;
    callCount: number;
    avgMs: number;
  };
  result: {
    matched: boolean;
  };
}

/**
 * Performance tracker for monitoring matching operations
 */
export class PerformanceTracker {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private lastStepTime: number;
  private threshold: number;
  
  constructor(threshold = 500) {
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;
    this.threshold = threshold;
    
    this.metrics = {
      totalMs: 0,
      warning: false,
      threshold: this.threshold,
      dataLoading: { loadAllRecordsMs: 0, recordCount: 0, fileSizeKB: 0 },
      filtering: {
        filePathFilterMs: 0,
        filePathCandidates: 0,
        timeWindowFilterMs: 0,
        timeWindowCandidates: 0,
        lengthFilterMs: 0,
        lengthCandidates: 0,
      },
      similarity: {
        levenshteinTotalMs: 0,
        levenshteinCallCount: 0,
        avgLevenshteinMs: 0,
        maxLevenshteinMs: 0,
        avgContentLength: 0,
        maxContentLength: 0,
      },
      result: {
        bestSimilarity: 0,
        candidatesProcessed: 0,
        matched: false,
      },
      timestamp: Date.now(),
      filePath: '',
      hunkLineCount: 0,
    };
  }
  
  /**
   * Record data loading performance
   */
  recordDataLoading(recordCount: number, fileSizeKB: number): void {
    const now = performance.now();
    this.metrics.dataLoading.loadAllRecordsMs = now - this.lastStepTime;
    this.metrics.dataLoading.recordCount = recordCount;
    this.metrics.dataLoading.fileSizeKB = fileSizeKB;
    this.lastStepTime = now;
  }
  
  /**
   * Record filter step performance
   */
  recordFilterStep(
    step: 'filePath' | 'timeWindow' | 'length',
    candidatesAfter: number
  ): void {
    const now = performance.now();
    const stepMs = now - this.lastStepTime;
    
    if (step === 'filePath') {
      this.metrics.filtering.filePathFilterMs = stepMs;
      this.metrics.filtering.filePathCandidates = candidatesAfter;
    } else if (step === 'timeWindow') {
      this.metrics.filtering.timeWindowFilterMs = stepMs;
      this.metrics.filtering.timeWindowCandidates = candidatesAfter;
    } else if (step === 'length') {
      this.metrics.filtering.lengthFilterMs = stepMs;
      this.metrics.filtering.lengthCandidates = candidatesAfter;
    }
    
    this.lastStepTime = now;
  }
  
  /**
   * Record a single Levenshtein calculation
   */
  recordLevenshteinCall(durationMs: number, contentLength: number): void {
    this.metrics.similarity.levenshteinTotalMs += durationMs;
    this.metrics.similarity.levenshteinCallCount++;
    
    if (durationMs > this.metrics.similarity.maxLevenshteinMs) {
      this.metrics.similarity.maxLevenshteinMs = durationMs;
    }
    
    if (contentLength > this.metrics.similarity.maxContentLength) {
      this.metrics.similarity.maxContentLength = contentLength;
    }
  }
  
  /**
   * Record matching result
   */
  recordResult(bestSimilarity: number, matched: boolean): void {
    this.metrics.result.bestSimilarity = bestSimilarity;
    this.metrics.result.candidatesProcessed = this.metrics.similarity.levenshteinCallCount;
    this.metrics.result.matched = matched;
  }
  
  /**
   * Set context information
   */
  setContext(filePath: string, hunkLineCount: number): void {
    this.metrics.filePath = filePath;
    this.metrics.hunkLineCount = hunkLineCount;
  }
  
  /**
   * Finalize metrics and analyze performance
   */
  finalize(): PerformanceMetrics {
    this.metrics.totalMs = performance.now() - this.startTime;
    
    // Calculate averages
    if (this.metrics.similarity.levenshteinCallCount > 0) {
      this.metrics.similarity.avgLevenshteinMs =
        this.metrics.similarity.levenshteinTotalMs /
        this.metrics.similarity.levenshteinCallCount;
    }
    
    // Check if threshold exceeded
    if (this.metrics.totalMs > this.threshold) {
      this.metrics.warning = true;
      this.metrics.warningReason = `Performance exceeded ${this.threshold}ms threshold`;
      this.metrics.analysis = this.analyzeBottleneck();
    }
    
    return this.metrics;
  }
  
  /**
   * Get current metrics (without finalizing)
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Analyze performance bottleneck
   */
  private analyzeBottleneck(): PerformanceMetrics['analysis'] {
    const total = this.metrics.totalMs;
    const loading = this.metrics.dataLoading.loadAllRecordsMs;
    const filtering =
      this.metrics.filtering.filePathFilterMs +
      this.metrics.filtering.timeWindowFilterMs +
      this.metrics.filtering.lengthFilterMs;
    const levenshtein = this.metrics.similarity.levenshteinTotalMs;
    
    const breakdown = {
      loadingPercent: (loading / total) * 100,
      filteringPercent: (filtering / total) * 100,
      levenshteinPercent: (levenshtein / total) * 100,
    };
    
    let bottleneck: 'loading' | 'filtering' | 'levenshtein';
    let suggestion: string;
    
    if (breakdown.levenshteinPercent > 70) {
      bottleneck = 'levenshtein';
      suggestion = `Large number of candidates (${this.metrics.similarity.levenshteinCallCount}) caused slow Levenshtein matching. Consider tightening time window filter or reducing length tolerance.`;
    } else if (breakdown.loadingPercent > 50) {
      bottleneck = 'loading';
      suggestion = `Loading ${this.metrics.dataLoading.recordCount} records took ${loading.toFixed(0)}ms. Consider reducing retention days or implementing more aggressive cleanup.`;
    } else {
      bottleneck = 'filtering';
      suggestion = `Filtering took ${filtering.toFixed(0)}ms. Check if filter logic can be optimized.`;
    }
    
    return { bottleneck, suggestion, breakdown };
  }
  
  /**
   * Convert to simplified log entry for JSONL storage
   */
  toLogEntry(): PerformanceLogEntry {
    return {
      timestamp: this.metrics.timestamp,
      totalMs: this.metrics.totalMs,
      warning: this.metrics.warning,
      filtering: {
        filePathCandidates: this.metrics.filtering.filePathCandidates,
        timeWindowCandidates: this.metrics.filtering.timeWindowCandidates,
        lengthCandidates: this.metrics.filtering.lengthCandidates,
      },
      similarity: {
        levenshteinTotalMs: this.metrics.similarity.levenshteinTotalMs,
        callCount: this.metrics.similarity.levenshteinCallCount,
        avgMs: this.metrics.similarity.avgLevenshteinMs,
      },
      result: {
        matched: this.metrics.result.matched,
      },
    };
  }
}
