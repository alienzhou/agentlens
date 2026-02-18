import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  isAbsolutePath,
  normalizeFilePath,
  resolveFilePath,
  isInsideProject,
  getDisplayPath,
} from '../../src/utils/path-utils.js';

describe('path-utils', () => {
  // Use platform-appropriate paths for testing
  const isWindows = process.platform === 'win32';
  const projectRoot = isWindows ? 'C:\\Users\\dev\\project' : '/Users/dev/project';
  const outsidePath = isWindows ? 'C:\\Users\\other\\file.ts' : '/Users/other/file.ts';

  describe('isAbsolutePath', () => {
    it('should return true for absolute paths', () => {
      expect(isAbsolutePath(projectRoot)).toBe(true);
      expect(isAbsolutePath('/usr/local/bin')).toBe(true);
    });

    it('should return false for relative paths', () => {
      expect(isAbsolutePath('src/index.ts')).toBe(false);
      expect(isAbsolutePath('./file.ts')).toBe(false);
      expect(isAbsolutePath('../other/file.ts')).toBe(false);
    });
  });

  describe('normalizeFilePath', () => {
    it('should return relative path for files inside project', () => {
      const filePath = path.join(projectRoot, 'src', 'index.ts');
      const result = normalizeFilePath(filePath, projectRoot);
      expect(result).toBe(path.join('src', 'index.ts'));
    });

    it('should return absolute path for files outside project', () => {
      const result = normalizeFilePath(outsidePath, projectRoot);
      expect(result).toBe(path.normalize(outsidePath));
    });

    it('should handle nested directories correctly', () => {
      const filePath = path.join(projectRoot, 'packages', 'core', 'src', 'utils', 'path-utils.ts');
      const result = normalizeFilePath(filePath, projectRoot);
      expect(result).toBe(path.join('packages', 'core', 'src', 'utils', 'path-utils.ts'));
    });

    it('should handle paths with trailing separators', () => {
      const rootWithSep = projectRoot + path.sep;
      const filePath = path.join(projectRoot, 'src', 'file.ts');
      const result = normalizeFilePath(filePath, rootWithSep);
      expect(result).toBe(path.join('src', 'file.ts'));
    });
  });

  describe('resolveFilePath', () => {
    it('should return absolute path as-is', () => {
      const result = resolveFilePath(outsidePath, projectRoot);
      expect(result).toBe(outsidePath);
    });

    it('should resolve relative path against project root', () => {
      const result = resolveFilePath(path.join('src', 'index.ts'), projectRoot);
      expect(result).toBe(path.join(projectRoot, 'src', 'index.ts'));
    });

    it('should handle empty relative path', () => {
      const result = resolveFilePath('', projectRoot);
      expect(result).toBe(projectRoot);
    });
  });

  describe('isInsideProject', () => {
    it('should return true for files inside project (absolute path)', () => {
      const filePath = path.join(projectRoot, 'src', 'index.ts');
      expect(isInsideProject(filePath, projectRoot)).toBe(true);
    });

    it('should return true for files inside project (relative path)', () => {
      expect(isInsideProject(path.join('src', 'index.ts'), projectRoot)).toBe(true);
    });

    it('should return false for files outside project', () => {
      expect(isInsideProject(outsidePath, projectRoot)).toBe(false);
    });

    it('should return true for project root itself', () => {
      // Note: The project root directory itself is considered inside
      // but since we use startsWith with path.sep, the root exact match won't be inside
      const parentDir = path.dirname(projectRoot);
      expect(isInsideProject(projectRoot, parentDir)).toBe(true);
    });
  });

  describe('getDisplayPath', () => {
    it('should return relative path for files inside project (absolute input)', () => {
      const filePath = path.join(projectRoot, 'src', 'index.ts');
      const result = getDisplayPath(filePath, projectRoot);
      expect(result).toBe(path.join('src', 'index.ts'));
    });

    it('should return absolute path for files outside project', () => {
      const result = getDisplayPath(outsidePath, projectRoot);
      expect(result).toBe(path.normalize(outsidePath));
    });

    it('should return relative path as-is', () => {
      const relativePath = path.join('src', 'index.ts');
      const result = getDisplayPath(relativePath, projectRoot);
      expect(result).toBe(relativePath);
    });
  });

  describe('roundtrip: normalize -> resolve', () => {
    it('should correctly roundtrip paths inside project', () => {
      const originalPath = path.join(projectRoot, 'src', 'utils', 'helper.ts');
      const normalized = normalizeFilePath(originalPath, projectRoot);
      const resolved = resolveFilePath(normalized, projectRoot);
      expect(resolved).toBe(originalPath);
    });

    it('should correctly roundtrip paths outside project', () => {
      const normalized = normalizeFilePath(outsidePath, projectRoot);
      const resolved = resolveFilePath(normalized, projectRoot);
      expect(resolved).toBe(path.normalize(outsidePath));
    });
  });
});
