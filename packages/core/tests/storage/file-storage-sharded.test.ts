import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileStorage, type CodeChangeRecord, type PromptRecord } from '../../src/storage/file-storage.js';

describe('FileStorage - Sharded Storage', () => {
  let tempDir: string;
  let storage: FileStorage;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-blame-sharded-test-'));
    storage = new FileStorage(tempDir);
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // ==================== Helper Functions ====================

  const createTestChange = (overrides?: Partial<CodeChangeRecord>): CodeChangeRecord => ({
    sessionId: 'session-123',
    agent: 'claude-code',
    timestamp: Date.now(),
    toolName: 'Edit',
    filePath: '/test/file.ts',
    newContent: 'const a = 1;',
    success: true,
    ...overrides,
  });

  const createTestPrompt = (overrides?: Partial<PromptRecord>): PromptRecord => ({
    sessionId: 'session-123',
    prompt: 'Add a function to calculate sum',
    timestamp: Date.now(),
    ...overrides,
  });

  const getDateString = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ==================== Directory Structure Tests ====================

  describe('Directory Structure', () => {
    it('should create sharded directory structure on initialization', async () => {
      const hookDataPath = storage.getHookDataPath();
      
      const changesDir = path.join(hookDataPath, 'changes');
      const promptsDir = path.join(hookDataPath, 'prompts');
      const logsDir = path.join(hookDataPath, 'logs');
      const reportsDir = path.join(hookDataPath, 'reports');

      await expect(fs.access(changesDir)).resolves.toBeUndefined();
      await expect(fs.access(promptsDir)).resolves.toBeUndefined();
      await expect(fs.access(logsDir)).resolves.toBeUndefined();
      await expect(fs.access(reportsDir)).resolves.toBeUndefined();
    });
  });

  // ==================== Code Change Sharding Tests ====================

  describe('appendCodeChange - Sharded Write', () => {
    it('should write code change to date-based sharded file', async () => {
      const now = Date.now();
      const change = createTestChange({ timestamp: now });

      await storage.appendCodeChange(change);

      const dateStr = getDateString(now);
      const changesDir = path.join(storage.getHookDataPath(), 'changes');
      const shardFile = path.join(changesDir, `${dateStr}.jsonl`);

      const content = await fs.readFile(shardFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const savedChange = JSON.parse(lines[0]!) as CodeChangeRecord;
      expect(savedChange.sessionId).toBe('session-123');
      expect(savedChange.agent).toBe('claude-code');
      expect(savedChange.filePath).toBe('/test/file.ts');
    });

    it('should auto-generate recordId if not provided', async () => {
      const change = createTestChange();

      await storage.appendCodeChange(change);

      const dateStr = getDateString(change.timestamp);
      const shardFile = path.join(storage.getHookDataPath(), 'changes', `${dateStr}.jsonl`);
      const content = await fs.readFile(shardFile, 'utf-8');
      const savedChange = JSON.parse(content.trim()) as CodeChangeRecord;

      expect(savedChange.id).toBeDefined();
      expect(savedChange.id).toMatch(/^\d+-[A-Za-z0-9_-]{8}$/);
    });

    it('should preserve existing recordId if provided', async () => {
      const change = createTestChange({ id: 'custom-id-123' });

      await storage.appendCodeChange(change);

      const dateStr = getDateString(change.timestamp);
      const shardFile = path.join(storage.getHookDataPath(), 'changes', `${dateStr}.jsonl`);
      const content = await fs.readFile(shardFile, 'utf-8');
      const savedChange = JSON.parse(content.trim()) as CodeChangeRecord;

      expect(savedChange.id).toBe('custom-id-123');
    });

    it('should write multiple changes to the same day shard', async () => {
      const today = Date.now();
      const change1 = createTestChange({ timestamp: today, sessionId: 'session-1' });
      const change2 = createTestChange({ timestamp: today + 1000, sessionId: 'session-2' });
      const change3 = createTestChange({ timestamp: today + 2000, sessionId: 'session-3' });

      await storage.appendCodeChange(change1);
      await storage.appendCodeChange(change2);
      await storage.appendCodeChange(change3);

      const dateStr = getDateString(today);
      const shardFile = path.join(storage.getHookDataPath(), 'changes', `${dateStr}.jsonl`);
      const content = await fs.readFile(shardFile, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);

      const sessions = lines.map(line => (JSON.parse(line) as CodeChangeRecord).sessionId);
      expect(sessions).toContain('session-1');
      expect(sessions).toContain('session-2');
      expect(sessions).toContain('session-3');
    });

    it('should write changes to different day shards', async () => {
      const today = Date.now();
      const yesterday = today - 24 * 60 * 60 * 1000;
      const twoDaysAgo = today - 2 * 24 * 60 * 60 * 1000;

      await storage.appendCodeChange(createTestChange({ timestamp: today, sessionId: 'today' }));
      await storage.appendCodeChange(createTestChange({ timestamp: yesterday, sessionId: 'yesterday' }));
      await storage.appendCodeChange(createTestChange({ timestamp: twoDaysAgo, sessionId: 'two-days-ago' }));

      const changesDir = path.join(storage.getHookDataPath(), 'changes');
      const files = await fs.readdir(changesDir);
      
      expect(files).toHaveLength(3);
      expect(files).toContain(`${getDateString(today)}.jsonl`);
      expect(files).toContain(`${getDateString(yesterday)}.jsonl`);
      expect(files).toContain(`${getDateString(twoDaysAgo)}.jsonl`);
    });
  });

  // ==================== Prompt Sharding Tests ====================

  describe('appendPrompt - Sharded Write', () => {
    it('should write prompt to date-based sharded file', async () => {
      const now = Date.now();
      const prompt = createTestPrompt({ timestamp: now });

      await storage.appendPrompt(prompt);

      const dateStr = getDateString(now);
      const promptsDir = path.join(storage.getHookDataPath(), 'prompts');
      const shardFile = path.join(promptsDir, `${dateStr}.jsonl`);

      const content = await fs.readFile(shardFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const savedPrompt = JSON.parse(lines[0]!) as PromptRecord;
      expect(savedPrompt.sessionId).toBe('session-123');
      expect(savedPrompt.prompt).toBe('Add a function to calculate sum');
    });

    it('should write multiple prompts to different shards', async () => {
      const today = Date.now();
      const yesterday = today - 24 * 60 * 60 * 1000;

      await storage.appendPrompt(createTestPrompt({ timestamp: today, prompt: 'prompt-today' }));
      await storage.appendPrompt(createTestPrompt({ timestamp: yesterday, prompt: 'prompt-yesterday' }));

      const promptsDir = path.join(storage.getHookDataPath(), 'prompts');
      const files = await fs.readdir(promptsDir);

      expect(files).toHaveLength(2);
    });
  });

  // ==================== Read Operations Tests ====================

  describe('getRecentCodeChanges - Sharded Read', () => {
    it('should read changes from multiple day shards', async () => {
      const today = Date.now();
      const yesterday = today - 24 * 60 * 60 * 1000;
      const twoDaysAgo = today - 2 * 24 * 60 * 60 * 1000;

      await storage.appendCodeChange(createTestChange({ timestamp: today, sessionId: 'today' }));
      await storage.appendCodeChange(createTestChange({ timestamp: yesterday, sessionId: 'yesterday' }));
      await storage.appendCodeChange(createTestChange({ timestamp: twoDaysAgo, sessionId: 'two-days-ago' }));

      const recentChanges = await storage.getRecentCodeChanges(3);

      expect(recentChanges).toHaveLength(3);
      const sessions = recentChanges.map(c => c.sessionId);
      expect(sessions).toContain('today');
      expect(sessions).toContain('yesterday');
      expect(sessions).toContain('two-days-ago');
    });

    it('should only read changes within specified time window', async () => {
      const today = Date.now();
      const yesterday = today - 24 * 60 * 60 * 1000;
      const twoDaysAgo = today - 2 * 24 * 60 * 60 * 1000;
      const threeDaysAgo = today - 3 * 24 * 60 * 60 * 1000;

      await storage.appendCodeChange(createTestChange({ timestamp: today, sessionId: 'today' }));
      await storage.appendCodeChange(createTestChange({ timestamp: yesterday, sessionId: 'yesterday' }));
      await storage.appendCodeChange(createTestChange({ timestamp: twoDaysAgo, sessionId: 'two-days-ago' }));
      await storage.appendCodeChange(createTestChange({ timestamp: threeDaysAgo, sessionId: 'three-days-ago' }));

      // Only read last 2 days
      const recentChanges = await storage.getRecentCodeChanges(2);

      expect(recentChanges).toHaveLength(2);
      const sessions = recentChanges.map(c => c.sessionId);
      expect(sessions).toContain('today');
      expect(sessions).toContain('yesterday');
      expect(sessions).not.toContain('two-days-ago');
      expect(sessions).not.toContain('three-days-ago');
    });

    it('should return empty array when no shards exist', async () => {
      const recentChanges = await storage.getRecentCodeChanges(7);
      expect(recentChanges).toEqual([]);
    });

    it('should handle missing shard files gracefully', async () => {
      // Only write for today, not yesterday
      const today = Date.now();
      await storage.appendCodeChange(createTestChange({ timestamp: today, sessionId: 'today' }));

      // Request 3 days (yesterday and day before will be missing)
      const recentChanges = await storage.getRecentCodeChanges(3);

      expect(recentChanges).toHaveLength(1);
      expect(recentChanges[0]!.sessionId).toBe('today');
    });

    it('should skip invalid JSON lines', async () => {
      const today = Date.now();
      const dateStr = getDateString(today);
      const shardFile = path.join(storage.getHookDataPath(), 'changes', `${dateStr}.jsonl`);

      // Write valid and invalid lines
      const validChange = createTestChange({ timestamp: today, sessionId: 'valid' });
      await fs.writeFile(shardFile, 
        JSON.stringify(validChange) + '\n' +
        'invalid json line\n' +
        '{ broken: json }\n'
      );

      const recentChanges = await storage.getRecentCodeChanges(1);

      expect(recentChanges).toHaveLength(1);
      expect(recentChanges[0]!.sessionId).toBe('valid');
    });
  });

  describe('getCodeChangesBySession', () => {
    it('should retrieve all changes for a specific session across shards', async () => {
      const today = Date.now();
      const yesterday = today - 24 * 60 * 60 * 1000;

      // Session A has changes on both days
      await storage.appendCodeChange(createTestChange({ timestamp: today, sessionId: 'session-A', filePath: '/a1.ts' }));
      await storage.appendCodeChange(createTestChange({ timestamp: yesterday, sessionId: 'session-A', filePath: '/a2.ts' }));
      
      // Session B has changes only today
      await storage.appendCodeChange(createTestChange({ timestamp: today, sessionId: 'session-B', filePath: '/b1.ts' }));

      const sessionAChanges = await storage.getCodeChangesBySession('session-A');

      expect(sessionAChanges).toHaveLength(2);
      expect(sessionAChanges.map(c => c.filePath)).toContain('/a1.ts');
      expect(sessionAChanges.map(c => c.filePath)).toContain('/a2.ts');
    });

    it('should return empty array for non-existent session', async () => {
      await storage.appendCodeChange(createTestChange({ sessionId: 'existing' }));

      const changes = await storage.getCodeChangesBySession('non-existent');
      expect(changes).toEqual([]);
    });
  });

  describe('getLatestPromptBefore', () => {
    it('should find the latest prompt before a given timestamp', async () => {
      const baseTime = Date.now();
      
      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: baseTime - 3000,
        prompt: 'First prompt',
      }));
      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: baseTime - 2000,
        prompt: 'Second prompt',
      }));
      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: baseTime - 1000,
        prompt: 'Third prompt',
      }));

      // Find the prompt before baseTime - 1500
      const prompt = await storage.getLatestPromptBefore('session-1', baseTime - 1500);
      expect(prompt).toBe('Second prompt');
    });

    it('should only consider prompts from the specified session', async () => {
      const baseTime = Date.now();

      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: baseTime - 2000,
        prompt: 'Session 1 prompt',
      }));
      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-2',
        timestamp: baseTime - 1000,
        prompt: 'Session 2 prompt',
      }));

      const prompt = await storage.getLatestPromptBefore('session-1', baseTime);
      expect(prompt).toBe('Session 1 prompt');
    });

    it('should return undefined if no matching prompt found', async () => {
      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: Date.now(),
        prompt: 'A prompt',
      }));

      const prompt = await storage.getLatestPromptBefore('session-1', Date.now() - 10000);
      expect(prompt).toBeUndefined();
    });
  });

  describe('getPromptsBySession', () => {
    it('should retrieve all prompts for a session sorted by timestamp', async () => {
      const baseTime = Date.now();

      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: baseTime + 2000,
        prompt: 'Third',
      }));
      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: baseTime,
        prompt: 'First',
      }));
      await storage.appendPrompt(createTestPrompt({
        sessionId: 'session-1',
        timestamp: baseTime + 1000,
        prompt: 'Second',
      }));

      const prompts = await storage.getPromptsBySession('session-1');

      expect(prompts).toHaveLength(3);
      expect(prompts[0]!.prompt).toBe('First');
      expect(prompts[1]!.prompt).toBe('Second');
      expect(prompts[2]!.prompt).toBe('Third');
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle empty content lines in shard files', async () => {
      const today = Date.now();
      const dateStr = getDateString(today);
      const shardFile = path.join(storage.getHookDataPath(), 'changes', `${dateStr}.jsonl`);

      const validChange = createTestChange({ timestamp: today });
      await fs.writeFile(shardFile, 
        '\n' +  // empty line at start
        JSON.stringify(validChange) + '\n' +
        '\n' +  // empty line in middle
        '   \n' // whitespace-only line
      );

      const changes = await storage.getRecentCodeChanges(1);
      expect(changes).toHaveLength(1);
    });

    it('should handle concurrent writes to the same shard', async () => {
      const today = Date.now();
      const changes = Array.from({ length: 10 }, (_, i) => 
        createTestChange({ timestamp: today, sessionId: `session-${i}` })
      );

      // Write all changes concurrently
      await Promise.all(changes.map(c => storage.appendCodeChange(c)));

      const recentChanges = await storage.getRecentCodeChanges(1);
      expect(recentChanges).toHaveLength(10);
    });

    it('should correctly handle timezone edge cases (midnight)', async () => {
      // Create a timestamp at the start of the day
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      await storage.appendCodeChange(createTestChange({ 
        timestamp: startOfDay.getTime(), 
        sessionId: 'midnight' 
      }));

      const changes = await storage.getRecentCodeChanges(1);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.sessionId).toBe('midnight');
    });
  });
});
