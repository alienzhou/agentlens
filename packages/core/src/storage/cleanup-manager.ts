import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration for automatic cleanup
 */
export interface CleanupConfig {
  /** Whether auto-cleanup is enabled */
  enabled: boolean;
  /** Number of days to retain data */
  retentionDays: number;
  /** Interval between cleanup checks (in hours) */
  checkIntervalHours: number;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of files cleaned up */
  filesRemoved: number;
  /** Total bytes freed */
  bytesFreed: number;
  /** Files that were removed */
  removedFiles: string[];
  /** Any errors encountered */
  errors: Array<{ file: string; error: string }>;
}

/**
 * Default cleanup configuration
 */
export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  enabled: true,
  retentionDays: 7,
  checkIntervalHours: 24,
};

/**
 * CleanupManager handles automatic cleanup of old data files.
 * 
 * Features:
 * - Automatic cleanup on startup
 * - Periodic cleanup based on configured interval
 * - Manual cleanup via command
 * - Date-based file retention (keeps files from last N days)
 * 
 * Directory structure expected:
 * .agent-blame/data/hooks/
 * ├── changes/
 * │   ├── 2026-02-10.jsonl
 * │   └── 2026-02-11.jsonl
 * ├── prompts/
 * │   ├── 2026-02-10.jsonl
 * │   └── 2026-02-11.jsonl
 * └── logs/
 *     └── performance.jsonl
 */
export class CleanupManager {
  private lastCleanupTime = 0;
  private config: CleanupConfig;

  constructor(
    private hookDataPath: string,
    config: Partial<CleanupConfig> = {}
  ) {
    this.config = { ...DEFAULT_CLEANUP_CONFIG, ...config };
  }

  /**
   * Update cleanup configuration
   */
  updateConfig(config: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<CleanupConfig> {
    return { ...this.config };
  }

  /**
   * Try to run cleanup if conditions are met.
   * 
   * @param force - If true, skip interval check and run cleanup immediately
   * @returns Cleanup result if cleanup was performed, null if skipped
   */
  async tryCleanup(force = false): Promise<CleanupResult | null> {
    const now = Date.now();

    // Skip if disabled and not forced
    if (!this.config.enabled && !force) {
      return null;
    }

    // Skip if not enough time has passed since last cleanup
    const intervalMs = this.config.checkIntervalHours * 60 * 60 * 1000;
    if (!force && (now - this.lastCleanupTime) < intervalMs) {
      return null;
    }

    const result = await this.cleanup(this.config.retentionDays);
    this.lastCleanupTime = now;
    
    return result;
  }

  /**
   * Perform cleanup of files older than retention period.
   * 
   * @param retentionDays - Number of days to retain
   * @returns Cleanup result with statistics
   */
  async cleanup(retentionDays: number): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesRemoved: 0,
      bytesFreed: 0,
      removedFiles: [],
      errors: [],
    };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    cutoffDate.setHours(0, 0, 0, 0); // Start of the day

    // Directories to clean
    const dirsToClean = ['changes', 'prompts'];

    for (const dir of dirsToClean) {
      const dirPath = path.join(this.hookDataPath, dir);

      try {
        const files = await fs.readdir(dirPath);

        for (const file of files) {
          // Match date-based JSONL files (YYYY-MM-DD.jsonl)
          const match = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
          if (!match) {
            continue; // Skip non-date files
          }

          const fileDate = new Date(match[1]!);
          fileDate.setHours(0, 0, 0, 0);

          if (fileDate < cutoffDate) {
            const filePath = path.join(dirPath, file);
            
            try {
              // Get file size before deletion
              const stats = await fs.stat(filePath);
              const fileSize = stats.size;

              // Delete the file
              await fs.unlink(filePath);

              result.filesRemoved++;
              result.bytesFreed += fileSize;
              result.removedFiles.push(`${dir}/${file}`);
            } catch (err) {
              result.errors.push({
                file: `${dir}/${file}`,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
      } catch (err) {
        // Directory doesn't exist or can't be read - not an error
        // This is expected if no data has been written yet
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          result.errors.push({
            file: dir,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return result;
  }

  /**
   * Get statistics about current data files.
   * 
   * @returns Object with file counts and total size
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSizeKB: number;
    oldestFile: string | null;
    newestFile: string | null;
    filesByDir: Record<string, number>;
  }> {
    const stats = {
      totalFiles: 0,
      totalSizeKB: 0,
      oldestFile: null as string | null,
      newestFile: null as string | null,
      filesByDir: {} as Record<string, number>,
    };

    const dirsToScan = ['changes', 'prompts', 'logs'];
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;

    for (const dir of dirsToScan) {
      const dirPath = path.join(this.hookDataPath, dir);
      stats.filesByDir[dir] = 0;

      try {
        const files = await fs.readdir(dirPath);

        for (const file of files) {
          if (!file.endsWith('.jsonl')) {
            continue;
          }

          const filePath = path.join(dirPath, file);

          try {
            const fileStat = await fs.stat(filePath);
            stats.totalFiles++;
            stats.totalSizeKB += fileStat.size / 1024;
            stats.filesByDir[dir]++;

            // Track date range from filename
            const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
            if (dateMatch) {
              const fileDate = new Date(dateMatch[1]!);
              
              if (!oldestDate || fileDate < oldestDate) {
                oldestDate = fileDate;
                stats.oldestFile = `${dir}/${file}`;
              }
              
              if (!newestDate || fileDate > newestDate) {
                newestDate = fileDate;
                stats.newestFile = `${dir}/${file}`;
              }
            }
          } catch {
            // Skip files we can't stat
          }
        }
      } catch {
        // Directory doesn't exist - not an error
      }
    }

    stats.totalSizeKB = Math.round(stats.totalSizeKB * 100) / 100;
    
    return stats;
  }

  /**
   * Check if cleanup is due based on configuration.
   * 
   * @returns true if cleanup should be performed
   */
  isCleanupDue(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const intervalMs = this.config.checkIntervalHours * 60 * 60 * 1000;
    return (Date.now() - this.lastCleanupTime) >= intervalMs;
  }

  /**
   * Get the last cleanup timestamp.
   */
  getLastCleanupTime(): number {
    return this.lastCleanupTime;
  }

  /**
   * Reset the last cleanup time (useful for testing).
   */
  resetLastCleanupTime(): void {
    this.lastCleanupTime = 0;
  }
}
