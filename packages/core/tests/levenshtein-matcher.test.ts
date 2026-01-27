import { describe, it, expect } from 'vitest';
import { LevenshteinMatcher } from '../src/detection/levenshtein-matcher.js';

describe('LevenshteinMatcher', () => {
  const matcher = new LevenshteinMatcher();

  describe('calculate', () => {
    it('should return 1 for identical strings', () => {
      expect(matcher.calculate('hello', 'hello')).toBe(1);
    });

    it('should handle empty strings', () => {
      // Two empty strings are identical
      expect(matcher.calculate('', '')).toBe(1);
    });

    it('should return 0 when one string is empty', () => {
      expect(matcher.calculate('hello', '')).toBe(0);
      expect(matcher.calculate('', 'hello')).toBe(0);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = matcher.calculate('hello world', 'hello worlds');
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should return low similarity for different strings', () => {
      const similarity = matcher.calculate('hello', 'world');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should normalize whitespace differences', () => {
      const similarity = matcher.calculate('  hello  world  ', 'hello world');
      expect(similarity).toBe(1);
    });

    it('should handle multiline strings', () => {
      const str1 = 'line1\nline2\nline3';
      const str2 = 'line1\nline2\nline3';
      expect(matcher.calculate(str1, str2)).toBe(1);
    });
  });

  describe('calculateLines', () => {
    it('should compare arrays of lines', () => {
      const lines1 = ['const a = 1;', 'const b = 2;'];
      const lines2 = ['const a = 1;', 'const b = 2;'];
      expect(matcher.calculateLines(lines1, lines2)).toBe(1);
    });

    it('should detect differences in lines', () => {
      const lines1 = ['const a = 1;', 'const b = 2;'];
      const lines2 = ['const a = 1;', 'const b = 3;'];
      const similarity = matcher.calculateLines(lines1, lines2);
      expect(similarity).toBeGreaterThan(0.9);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('findBestMatch', () => {
    it('should find the best matching candidate', () => {
      const result = matcher.findBestMatch('hello world', [
        'goodbye world',
        'hello there',
        'hello world!',
      ]);

      expect(result).not.toBeNull();
      expect(result!.match).toBe('hello world!');
      expect(result!.index).toBe(2);
      expect(result!.similarity).toBeGreaterThan(0.9);
    });

    it('should return null for empty candidates', () => {
      const result = matcher.findBestMatch('hello', []);
      expect(result).toBeNull();
    });
  });
});
