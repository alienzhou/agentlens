/**
 * Levenshtein distance-based similarity matcher
 *
 * Used for contributor detection to compare code hunks
 * with Agent-generated code records.
 */
export class LevenshteinMatcher {
  /**
   * Calculate similarity between two strings
   * Returns a value between 0 and 1, where 1 is identical
   */
  calculate(str1: string, str2: string): number {
    // Handle edge cases
    if (str1 === str2) {
      return 1;
    }

    if (str1.length === 0 || str2.length === 0) {
      return 0;
    }

    // Normalize strings for comparison
    const normalized1 = this.normalizeForComparison(str1);
    const normalized2 = this.normalizeForComparison(str2);

    if (normalized1 === normalized2) {
      return 1;
    }

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    // Convert distance to similarity (0-1)
    return 1 - distance / maxLength;
  }

  /**
   * Calculate similarity between two arrays of lines
   * Useful for comparing hunks line by line
   */
  calculateLines(lines1: string[], lines2: string[]): number {
    const str1 = lines1.map((l) => this.normalizeForComparison(l)).join('\n');
    const str2 = lines2.map((l) => this.normalizeForComparison(l)).join('\n');
    return this.calculate(str1, str2);
  }

  /**
   * Find the best match for a string in a list of candidates
   */
  findBestMatch(
    target: string,
    candidates: string[]
  ): { match: string; similarity: number; index: number } | null {
    if (candidates.length === 0) {
      return null;
    }

    let bestMatch = candidates[0]!;
    let bestSimilarity = this.calculate(target, bestMatch);
    let bestIndex = 0;

    for (let i = 1; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      const similarity = this.calculate(target, candidate);

      if (similarity > bestSimilarity) {
        bestMatch = candidate;
        bestSimilarity = similarity;
        bestIndex = i;
      }
    }

    return {
      match: bestMatch,
      similarity: bestSimilarity,
      index: bestIndex,
    };
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Using dynamic programming with space optimization
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Use two rows instead of full matrix for space efficiency
    let prevRow = new Array<number>(n + 1);
    let currRow = new Array<number>(n + 1);

    // Initialize first row
    for (let j = 0; j <= n; j++) {
      prevRow[j] = j;
    }

    // Fill the matrix row by row
    for (let i = 1; i <= m; i++) {
      currRow[0] = i;

      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          currRow[j] = prevRow[j - 1]!;
        } else {
          currRow[j] = Math.min(
            prevRow[j - 1]!, // substitution
            prevRow[j]!, // deletion
            currRow[j - 1]! // insertion
          ) + 1;
        }
      }

      // Swap rows
      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[n]!;
  }

  /**
   * Normalize a string for comparison
   * Removes insignificant differences
   */
  private normalizeForComparison(str: string): string {
    return (
      str
        // Remove leading/trailing whitespace from each line
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        // Collapse multiple spaces into one
        .replace(/\s+/g, ' ')
        // Remove empty lines
        .replace(/\n+/g, '\n')
        // Trim overall
        .trim()
    );
  }
}
