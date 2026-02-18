import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { CleanupManager, type CleanupConfig, DEFAULT_CLEANUP_CONFIG } from '../../src/storage/cleanup-manager.js';

describe('CleanupManager', () => {
  let tempDir: string;
  let hookDataPath: string;
  let manager: CleanupManager;

  beforeEach(async () => {
    // Create temp directory structure
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-blame-cleanup-test-'));
    hookDataPath = path.join(tempDir, '.agent-blame', 'data', 'hooks');
    
    // Create required directories
    await fs.mkdir(path.join(hookDataPath, 'changes'), { recursive: true });
    await fs.mkdir(path.join(hookDataPath, 'prompts'), { recursive: true });
    await fs.mkdir(path.join(hookDataPath, 'logs'), { recursive: true });

    manager = new CleanupManager(hookDataPath);
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

  const createTestFile = async (
    dir: 'changes' | 'prompts',
    daysAgo: number,
    content = '{"test": true}\n'
  ): Promise<string> => {
    const dateStr = getDateString(daysAgo);
    const filePath = path.join(hookDataPath, dir, `${dateStr}.jsonl`);
    await fs.writeFile(filePath, content);
    return filePath;
  };

  // ==================== Configuration Tests ====================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = manager.getConfig();
      expect(config).toEqual(DEFAULT_CLEANUP_CONFIG);
    });

    it('should accept partial configuration', () => {
      const customManager = new CleanupManager(hookDataPath, {
        retentionDays: 14,
      });

      const config = customManager.getConfig();
      expect(config.retentionDays).toBe(14);
      expect(config.enabled).toBe(true); // default
      expect(config.checkIntervalHours).toBe(24); // default
    });

    it('should update configuration', () => {
      manager.updateConfig({ retentionDays: 30 });
      
      const config = manager.getConfig();
      expect(config.retentionDays).toBe(30);
      expect(config.enabled).toBe(true); // unchanged
    });
  });

  // ==================== Cleanup Logic Tests ====================

  describe('cleanup', () => {
    it('should remove files older than retention period', async () => {
      // Create files: today, 3 days ago, 10 days ago
      const todayFile = await createTestFile('changes', 0);
      const threeDaysFile = await createTestFile('changes', 3);
      const tenDaysFile = await createTestFile('changes', 10);

      // Retention: 7 days (so 10 days ago should be deleted)
      const result = await manager.cleanup(7);

      expect(result.filesRemoved).toBe(1);
      expect(result.removedFiles).toContain(`changes/${getDateString(10)}.jsonl`);

      // Verify files
      await expect(fs.access(todayFile)).resolves.toBeUndefined();
      await expect(fs.access(threeDaysFile)).resolves.toBeUndefined();
      await expect(fs.access(tenDaysFile)).rejects.toThrow();
    });

    it('should clean both changes and prompts directories', async () => {
      // Create old files in both directories
      await createTestFile('changes', 10);
      await createTestFile('prompts', 10);

      const result = await manager.cleanup(7);

      expect(result.filesRemoved).toBe(2);
      expect(result.removedFiles).toContain(`changes/${getDateString(10)}.jsonl`);
      expect(result.removedFiles).toContain(`prompts/${getDateString(10)}.jsonl`);
    });

    it('should keep files within retention period', async () => {
      // Create files at the boundary
      const justWithin = await createTestFile('changes', 6);
      const justOutside = await createTestFile('changes', 8);

      const result = await manager.cleanup(7);

      expect(result.filesRemoved).toBe(1);
      await expect(fs.access(justWithin)).resolves.toBeUndefined();
      await expect(fs.access(justOutside)).rejects.toThrow();
    });

    it('should skip non-date files', async () => {
      // Create a non-date file that shouldn't be touched
      const nonDateFile = path.join(hookDataPath, 'changes', 'index.json');
      await fs.writeFile(nonDateFile, '{}');

      // Create an old date file
      await createTestFile('changes', 10);

      const result = await manager.cleanup(7);

      expect(result.filesRemoved).toBe(1);
      await expect(fs.access(nonDateFile)).resolves.toBeUndefined();
    });

    it('should report bytes freed accurately', async () => {
      const content = '{"large": "content"}\n'.repeat(100);
      await createTestFile('changes', 10, content);

      const result = await manager.cleanup(7);

      expect(result.bytesFreed).toBeGreaterThan(0);
      expect(result.bytesFreed).toBe(content.length);
    });

    it('should handle missing directories gracefully', async () => {
      // Remove the changes directory
      await fs.rm(path.join(hookDataPath, 'changes'), { recursive: true });

      const result = await manager.cleanup(7);

      expect(result.filesRemoved).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for files that cannot be deleted', async () => {
      // Create a file
      await createTestFile('changes', 10);
      
      // Make the directory read-only to simulate deletion failure
      // Note: This test is skipped on Windows as permission handling differs
      if (process.platform !== 'win32') {
        const changesDir = path.join(hookDataPath, 'changes');
        await fs.chmod(changesDir, 0o444);

        const result = await manager.cleanup(7);

        // Restore permissions for cleanup
        await fs.chmod(changesDir, 0o755);

        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle multiple old files correctly', async () => {
      // Create 5 old files and 2 recent files
      await createTestFile('changes', 1);
      await createTestFile('changes', 3);
      await createTestFile('changes', 8);
      await createTestFile('changes', 15);
      await createTestFile('changes', 30);
      await createTestFile('prompts', 2);
      await createTestFile('prompts', 20);

      const result = await manager.cleanup(7);

      // Should remove: 8, 15, 30 days ago in changes + 20 days ago in prompts
      expect(result.filesRemoved).toBe(4);
    });
  });

  // ==================== tryCleanup Tests ====================

  describe('tryCleanup', () => {
    it('should skip cleanup when disabled and not forced', async () => {
      manager.updateConfig({ enabled: false });
      await createTestFile('changes', 10);

      const result = await manager.tryCleanup();

      expect(result).toBeNull();
    });

    it('should run cleanup when forced even if disabled', async () => {
      manager.updateConfig({ enabled: false });
      await createTestFile('changes', 10);

      const result = await manager.tryCleanup(true);

      expect(result).not.toBeNull();
      expect(result!.filesRemoved).toBe(1);
    });

    it('should skip cleanup when interval not elapsed', async () => {
      await createTestFile('changes', 10);

      // First cleanup
      const firstResult = await manager.tryCleanup(true);
      expect(firstResult).not.toBeNull();

      // Create another old file
      await createTestFile('prompts', 10);

      // Second cleanup immediately after - should skip
      const secondResult = await manager.tryCleanup();
      expect(secondResult).toBeNull();
    });

    it('should run cleanup when interval has elapsed', async () => {
      // Set a very short interval
      manager.updateConfig({ checkIntervalHours: 0.001 }); // ~3.6 seconds

      await createTestFile('changes', 10);

      // First cleanup
      await manager.tryCleanup(true);

      // Reset to simulate time passing
      manager.resetLastCleanupTime();

      // Create another old file
      await createTestFile('prompts', 10);

      // Now should run
      const result = await manager.tryCleanup();
      expect(result).not.toBeNull();
    });
  });

  // ==================== Statistics Tests ====================

  describe('getStats', () => {
    it('should return accurate file statistics', async () => {
      await createTestFile('changes', 0);
      await createTestFile('changes', 1);
      await createTestFile('prompts', 0);

      const stats = await manager.getStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.filesByDir['changes']).toBe(2);
      expect(stats.filesByDir['prompts']).toBe(1);
    });

    it('should identify oldest and newest files', async () => {
      await createTestFile('changes', 0);
      await createTestFile('changes', 5);
      await createTestFile('changes', 10);

      const stats = await manager.getStats();

      expect(stats.newestFile).toBe(`changes/${getDateString(0)}.jsonl`);
      expect(stats.oldestFile).toBe(`changes/${getDateString(10)}.jsonl`);
    });

    it('should calculate total size', async () => {
      const content = 'test content\n';
      await createTestFile('changes', 0, content);
      await createTestFile('changes', 1, content);

      const stats = await manager.getStats();

      expect(stats.totalSizeKB).toBeGreaterThan(0);
    });

    it('should handle empty directories', async () => {
      const stats = await manager.getStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.oldestFile).toBeNull();
      expect(stats.newestFile).toBeNull();
    });
  });

  // ==================== Utility Method Tests ====================

  describe('isCleanupDue', () => {
    it('should return false when disabled', () => {
      manager.updateConfig({ enabled: false });
      manager.resetLastCleanupTime();

      expect(manager.isCleanupDue()).toBe(false);
    });

    it('should return true when never run before', () => {
      expect(manager.isCleanupDue()).toBe(true);
    });

    it('should return false immediately after cleanup', async () => {
      await manager.tryCleanup(true);

      expect(manager.isCleanupDue()).toBe(false);
    });
  });

  describe('resetLastCleanupTime', () => {
    it('should reset the last cleanup timestamp', async () => {
      await manager.tryCleanup(true);
      expect(manager.getLastCleanupTime()).toBeGreaterThan(0);

      manager.resetLastCleanupTime();
      expect(manager.getLastCleanupTime()).toBe(0);
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle date at retention boundary correctly', async () => {
      // File exactly at the retention boundary (7 days ago)
      const boundaryFile = await createTestFile('changes', 7);

      // With 7-day retention, 7 days ago should be kept (cutoff is start of day 7 days ago)
      const result = await manager.cleanup(7);

      // The file at exactly 7 days should be kept
      expect(result.filesRemoved).toBe(0);
      await expect(fs.access(boundaryFile)).resolves.toBeUndefined();
    });

    it('should handle leap year dates', async () => {
      // Create a file with a specific leap year date
      const leapYearFile = path.join(hookDataPath, 'changes', '2024-02-29.jsonl');
      await fs.writeFile(leapYearFile, '{"test": true}\n');

      // This shouldn't cause any errors
      const result = await manager.cleanup(7);

      // File from 2024-02-29 should be cleaned (it's in the past)
      expect(result.filesRemoved).toBe(1);
    });

    it('should handle files with invalid date format', async () => {
      // Create files with invalid date formats
      await fs.writeFile(path.join(hookDataPath, 'changes', 'invalid-date.jsonl'), '{}');
      await fs.writeFile(path.join(hookDataPath, 'changes', '2024-13-45.jsonl'), '{}');
      await fs.writeFile(path.join(hookDataPath, 'changes', 'not-a-date.jsonl'), '{}');

      const result = await manager.cleanup(7);

      // Invalid date files should not be deleted
      expect(result.filesRemoved).toBe(0);
    });
  });
});
