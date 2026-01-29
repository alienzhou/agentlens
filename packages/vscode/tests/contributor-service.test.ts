import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ContributorService } from '../src/blame/contributor-service.js';

describe('ContributorService', () => {
  let tempDir: string;
  let service: ContributorService;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-blame-test-'));
    
    // Create .agent-blame/data/hooks directory structure
    const hooksDir = path.join(tempDir, '.agent-blame', 'data', 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });
    
    // Initialize service
    service = new ContributorService(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('detectLineContributor', () => {
    it('should return null when no changes.jsonl exists', async () => {
      const result = await service.detectLineContributor('/test/file.ts', 'const a = 1;', 0);
      expect(result).toBeNull();
    });

    it('should return null when changes.jsonl is empty', async () => {
      const changesFile = path.join(tempDir, '.agent-blame', 'data', 'hooks', 'changes.jsonl');
      await fs.writeFile(changesFile, '');

      const result = await service.detectLineContributor('/test/file.ts', 'const a = 1;', 0);
      expect(result).toBeNull();
    });

    it('should detect AI contribution for exact match', async () => {
      const changesFile = path.join(tempDir, '.agent-blame', 'data', 'hooks', 'changes.jsonl');
      const testFilePath = path.join(tempDir, 'test.ts');

      const change = {
        sessionId: 'session-123',
        agent: 'claude-code',
        timestamp: Date.now(),
        toolName: 'Edit',
        filePath: testFilePath,
        oldContent: '',
        newContent: 'const a = 1;\nconst b = 2;',
        success: true,
      };

      await fs.writeFile(changesFile, JSON.stringify(change) + '\n');

      const result = await service.detectLineContributor(testFilePath, 'const a = 1;', 0);
      
      expect(result).not.toBeNull();
      expect(result!.contributor).toBe('ai');
      expect(result!.similarity).toBe(1);
      expect(result!.matchedRecord).toBeDefined();
      expect(result!.matchedRecord!.agent).toBe('claude-code');
      expect(result!.matchedRecord!.sessionId).toBe('session-123');
    });

    it('should return human for non-matching file path', async () => {
      const changesFile = path.join(tempDir, '.agent-blame', 'data', 'hooks', 'changes.jsonl');

      const change = {
        sessionId: 'session-123',
        agent: 'claude-code',
        timestamp: Date.now(),
        toolName: 'Edit',
        filePath: '/other/file.ts',
        oldContent: '',
        newContent: 'const a = 1;',
        success: true,
      };

      await fs.writeFile(changesFile, JSON.stringify(change) + '\n');

      const result = await service.detectLineContributor('/test/file.ts', 'const a = 1;', 0);
      
      // No records for this file path, so returns null
      expect(result).toBeNull();
    });

    it('should skip failed changes', async () => {
      const changesFile = path.join(tempDir, '.agent-blame', 'data', 'hooks', 'changes.jsonl');
      const testFilePath = path.join(tempDir, 'test.ts');

      const change = {
        sessionId: 'session-123',
        agent: 'claude-code',
        timestamp: Date.now(),
        toolName: 'Edit',
        filePath: testFilePath,
        oldContent: '',
        newContent: 'const a = 1;',
        success: false, // Failed change
      };

      await fs.writeFile(changesFile, JSON.stringify(change) + '\n');

      const result = await service.detectLineContributor(testFilePath, 'const a = 1;', 0);
      expect(result).toBeNull();
    });

    it('should handle multiple changes and find best match', async () => {
      const changesFile = path.join(tempDir, '.agent-blame', 'data', 'hooks', 'changes.jsonl');
      const testFilePath = path.join(tempDir, 'test.ts');

      const change1 = {
        sessionId: 'session-1',
        agent: 'cursor',
        timestamp: Date.now() - 1000,
        toolName: 'Edit',
        filePath: testFilePath,
        oldContent: '',
        newContent: 'const x = 100;',
        success: true,
      };

      const change2 = {
        sessionId: 'session-2',
        agent: 'claude-code',
        timestamp: Date.now(),
        toolName: 'Edit',
        filePath: testFilePath,
        oldContent: '',
        newContent: 'const a = 1;\nconst b = 2;',
        success: true,
      };

      await fs.writeFile(changesFile, JSON.stringify(change1) + '\n' + JSON.stringify(change2) + '\n');

      const result = await service.detectLineContributor(testFilePath, 'const a = 1;', 0);
      
      expect(result).not.toBeNull();
      expect(result!.contributor).toBe('ai');
      expect(result!.matchedRecord!.sessionId).toBe('session-2');
    });

    it('should detect human contribution for very different code', async () => {
      const changesFile = path.join(tempDir, '.agent-blame', 'data', 'hooks', 'changes.jsonl');
      const testFilePath = path.join(tempDir, 'test.ts');

      const change = {
        sessionId: 'session-123',
        agent: 'claude-code',
        timestamp: Date.now(),
        toolName: 'Edit',
        filePath: testFilePath,
        oldContent: '',
        newContent: 'function foo() { return 42; }',
        success: true,
      };

      await fs.writeFile(changesFile, JSON.stringify(change) + '\n');

      // Completely different line
      const result = await service.detectLineContributor(testFilePath, 'class Bar extends Base {}', 0);
      
      expect(result).not.toBeNull();
      expect(result!.contributor).toBe('human');
      expect(result!.similarity).toBeLessThan(0.7);
    });
  });

  describe('getAgentDisplayName', () => {
    it('should return display name for known agents', () => {
      expect(service.getAgentDisplayName('claude-code')).toBe('Claude Code');
      expect(service.getAgentDisplayName('cursor')).toBe('Cursor');
      expect(service.getAgentDisplayName('opencode')).toBe('OpenCode');
    });

    it('should return original name for unknown agents', () => {
      expect(service.getAgentDisplayName('unknown-agent')).toBe('unknown-agent');
    });
  });

  describe('clearCache', () => {
    it('should clear cache without error', () => {
      expect(() => service.clearCache()).not.toThrow();
    });
  });
});
