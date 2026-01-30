import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  type AgentRecord,
  type ContributorType,
  FileStorage,
  type CodeChangeRecord,
  type SessionSource,
  AGENT_CONFIGS,
  LevenshteinMatcher,
  SIMILARITY_CONFIG,
  DATA_DIR_NAME,
} from '@agent-blame/core';
import { createModuleLogger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = createModuleLogger('contributor-service');

/**
 * Contributor detection result for a line
 */
export interface LineContributorResult {
  contributor: ContributorType;
  similarity: number;
  confidence: number;
  matchedRecord?: {
    agent: string;
    sessionId: string;
    userPrompt?: string;
    timestamp: number;
    toolName?: string; // Edit/Write/MultiEdit
  };
  /** Flag indicating this line's content exists in HEAD (not actually modified) */
  unchanged?: boolean;
}

/**
 * Extended agent record with additional metadata for display
 */
interface ExtendedAgentRecord extends AgentRecord {
  toolName?: string; // Edit/Write/MultiEdit
}

/**
 * Contributor Service - Detects AI vs Human contributors for uncommitted code
 *
 * Reads from .agent-blame/data/hooks/changes.jsonl and uses ContributorDetector
 * to match code lines with AI-generated records.
 */
export class ContributorService {
  private cache: Map<string, ExtendedAgentRecord[]> = new Map();
  private sessionCache: Map<string, { userPrompt?: string }> = new Map();
  private cacheTimestamp: number = 0;
  private readonly cacheTTL = 5000; // 5 seconds
  private readonly matcher: LevenshteinMatcher;

  constructor(private workspaceRoot: string) {
    this.matcher = new LevenshteinMatcher();
  }

  /**
   * Detect contributor for a specific line in a file
   */
  async detectLineContributor(
    filePath: string,
    lineContent: string,
    lineNumber: number
  ): Promise<LineContributorResult | null> {
    const fileName = path.basename(filePath);
    log.debug('Detecting contributor', {
      file: fileName,
      line: lineNumber,
      content: lineContent.substring(0, 50),
    });

    // Get agent records for this file
    const agentRecords = await this.getAgentRecordsForFile(filePath);
    if (agentRecords.length === 0) {
      log.debug('No agent records for file', { file: fileName });
      return null;
    }

    log.debug('Agent records found', {
      file: fileName,
      count: agentRecords.length,
    });

    // Check if this line at this position has unchanged content from git HEAD
    // If content is the same at the same line number, it's not modified
    const isUnchangedFromHead = await this.lineUnchangedFromHead(filePath, lineContent, lineNumber);

    // If line content is unchanged at the same position, it's not a modified line
    // Return a special result indicating the line is unchanged
    if (isUnchangedFromHead) {
      log.debug('Line unchanged from HEAD', {
        file: fileName,
        line: lineNumber,
        content: lineContent.substring(0, 30),
      });
      return {
        contributor: 'human',
        similarity: 0,
        confidence: 1,
        matchedRecord: undefined,
        // Special flag to indicate this line exists in HEAD (unchanged content)
        unchanged: true,
      };
    }

    // Find best matching record by comparing line content
    let bestMatch: ExtendedAgentRecord | undefined;
    let bestSimilarity = 0;

    for (const record of agentRecords) {
      // Check if this line is in the record's addedLines
      for (const addedLine of record.addedLines) {
        const similarity = this.calculateLineSimilarity(lineContent, addedLine);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = record;
        }
      }
    }

    // Determine contributor type based on thresholds from core config
    const thresholdPureAi = SIMILARITY_CONFIG.THRESHOLD_PURE_AI;
    const thresholdAiModified = SIMILARITY_CONFIG.THRESHOLD_AI_MODIFIED;

    // Log match result with environment context
    log.debug('Similarity match result', {
      file: fileName,
      line: lineNumber,
      content: lineContent.substring(0, 30),
      similarity: bestSimilarity.toFixed(3),
      thresholdAi: thresholdPureAi,
      thresholdModified: thresholdAiModified,
      hasMatch: !!bestMatch,
      matchedAgent: bestMatch?.sessionSource.agent,
    });

    if (bestSimilarity >= thresholdPureAi) {
      log.info('Contributor detected: AI', {
        file: fileName,
        line: lineNumber,
        similarity: bestSimilarity.toFixed(3),
        agent: bestMatch?.sessionSource.agent,
      });
      return {
        contributor: 'ai',
        similarity: bestSimilarity,
        confidence: this.calculateConfidence(bestSimilarity, 'ai'),
        matchedRecord: bestMatch
          ? {
              agent: bestMatch.sessionSource.agent,
              sessionId: bestMatch.sessionSource.sessionId,
              userPrompt: bestMatch.sessionSource.metadata?.userPrompt,
              timestamp: bestMatch.timestamp,
              toolName: bestMatch.toolName,
            }
          : undefined,
      };
    }

    if (bestSimilarity >= thresholdAiModified) {
      log.info('Contributor detected: AI Modified', {
        file: fileName,
        line: lineNumber,
        similarity: bestSimilarity.toFixed(3),
        agent: bestMatch?.sessionSource.agent,
      });
      return {
        contributor: 'ai_modified',
        similarity: bestSimilarity,
        confidence: this.calculateConfidence(bestSimilarity, 'ai_modified'),
        matchedRecord: bestMatch
          ? {
              agent: bestMatch.sessionSource.agent,
              sessionId: bestMatch.sessionSource.sessionId,
              userPrompt: bestMatch.sessionSource.metadata?.userPrompt,
              timestamp: bestMatch.timestamp,
              toolName: bestMatch.toolName,
            }
          : undefined,
      };
    }

    log.debug('Contributor detected: Human', {
      file: fileName,
      line: lineNumber,
      similarity: bestSimilarity.toFixed(3),
    });

    return {
      contributor: 'human',
      similarity: bestSimilarity,
      confidence: this.calculateConfidence(bestSimilarity, 'human'),
    };
  }

  /**
   * Get agent records for a specific file (with caching)
   */
  private async getAgentRecordsForFile(filePath: string): Promise<ExtendedAgentRecord[]> {
    const allRecords = await this.getAllAgentRecords();
    return allRecords.filter((record) => record.filePath === filePath);
  }

  /**
   * Get all agent records from changes.jsonl (with caching)
   */
  private async getAllAgentRecords(): Promise<ExtendedAgentRecord[]> {
    const now = Date.now();
    const cacheKey = 'all';

    // Check cache
    if (this.cache.has(cacheKey) && now - this.cacheTimestamp < this.cacheTTL) {
      return this.cache.get(cacheKey)!;
    }

    // Read from file
    const records = await this.loadAgentRecords();
    this.cache.set(cacheKey, records);
    this.cacheTimestamp = now;

    return records;
  }

  /**
   * Load agent records from changes.jsonl
   */
  private async loadAgentRecords(): Promise<ExtendedAgentRecord[]> {
    const dataPath = path.join(this.workspaceRoot, DATA_DIR_NAME, 'data', 'hooks', 'changes.jsonl');

    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      const lines = content.trim().split('\n');
      const records: ExtendedAgentRecord[] = [];

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const change = JSON.parse(line) as CodeChangeRecord;
          if (!change.success || !change.newContent) {
            continue;
          }

          // Calculate addedLines from oldContent and newContent
          const addedLines = this.calculateAddedLines(change.oldContent || '', change.newContent);

          // Try to get userPrompt from session cache
          let userPrompt: string | undefined;
          if (this.sessionCache.has(change.sessionId)) {
            userPrompt = this.sessionCache.get(change.sessionId)?.userPrompt;
          } else {
            // Try to load from session file
            userPrompt = await this.loadUserPromptFromSession(change.sessionId);
            this.sessionCache.set(change.sessionId, { userPrompt });
          }

          // Convert to AgentRecord
          const sessionSource: SessionSource = {
            agent: change.agent,
            sessionId: change.sessionId,
            qaIndex: 1, // Default, as CodeChangeRecord doesn't have this
            timestamp: change.timestamp,
            metadata: {
              userPrompt,
            },
          };

          const record: ExtendedAgentRecord = {
            id: `${change.sessionId}-${String(change.timestamp)}`,
            sessionSource,
            filePath: change.filePath,
            content: change.newContent,
            addedLines,
            timestamp: change.timestamp,
            toolName: change.toolName,
          };

          records.push(record);
        } catch {
          // Skip invalid lines
        }
      }

      log.debug('Agent records loaded from file', {
        dataPath: path.relative(this.workspaceRoot, dataPath),
        totalRecords: records.length,
        files: [...new Set(records.map(r => path.basename(r.filePath)))],
        agents: [...new Set(records.map(r => r.sessionSource.agent))],
      });

      return records;
    } catch (error) {
      // File doesn't exist or can't be read
      log.debug('No agent records file found', {
        dataPath: path.relative(this.workspaceRoot, dataPath),
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Calculate added lines by diffing oldContent and newContent
   *
   * For Write tool (no oldContent), we try to get the git HEAD version of the file
   * to compare against. This ensures we only mark truly NEW lines as AI-added.
   */
  private calculateAddedLines(oldContent: string, newContent: string): string[] {
    const newLines = newContent.split('\n');

    // If no oldContent (Write tool), return all non-empty lines
    // The actual filtering will be done at match time using git HEAD comparison
    if (!oldContent || oldContent.trim() === '') {
      return newLines.filter((line) => line.trim() !== '');
    }

    const oldLines = oldContent.split('\n');

    // Simple line-by-line diff
    const addedLines: string[] = [];
    let oldIndex = 0;
    let newIndex = 0;

    while (newIndex < newLines.length) {
      if (oldIndex >= oldLines.length) {
        // All remaining lines are added
        addedLines.push(...newLines.slice(newIndex));
        break;
      }

      if (oldLines[oldIndex] === newLines[newIndex]) {
        // Lines match, move both forward
        oldIndex++;
        newIndex++;
      } else {
        // Check if this is an addition (new line not in old)
        let foundInOld = false;
        for (let i = oldIndex; i < oldLines.length; i++) {
          if (oldLines[i] === newLines[newIndex]) {
            foundInOld = true;
            oldIndex = i + 1;
            newIndex++;
            break;
          }
        }

        if (!foundInOld) {
          // This is an added line
          addedLines.push(newLines[newIndex]!);
          newIndex++;
        }
      }
    }

    return addedLines;
  }

  /**
   * Get file content from git HEAD (last commit)
   * Returns null if file doesn't exist in HEAD or git command fails
   */
  private async getGitHeadContent(filePath: string): Promise<string | null> {
    try {
      // Convert absolute path to relative path for git command
      const relativePath = path.relative(this.workspaceRoot, filePath);
      const { stdout } = await execAsync(`git show HEAD:"${relativePath}"`, {
        cwd: this.workspaceRoot,
      });
      return stdout;
    } catch {
      // File doesn't exist in HEAD or git error
      return null;
    }
  }

  /**
   * Check if a line at a specific line number has the same content in git HEAD
   * This helps distinguish between "AI wrote this new line" vs "AI kept this existing line unchanged"
   */
  private gitHeadCache: Map<string, string[]> = new Map();

  private async lineUnchangedFromHead(
    filePath: string,
    lineContent: string,
    lineNumber: number
  ): Promise<boolean> {
    const fileName = path.basename(filePath);

    // Get or build cache for this file
    if (!this.gitHeadCache.has(filePath)) {
      const headContent = await this.getGitHeadContent(filePath);
      if (headContent) {
        const lines = headContent.split('\n');
        this.gitHeadCache.set(filePath, lines);
        log.debug('HEAD content cached', { file: fileName, lines: lines.length });
      } else {
        // File is new, no lines exist in HEAD
        this.gitHeadCache.set(filePath, []);
        log.debug('File not in HEAD (new file)', { file: fileName });
      }
    }

    const headLines = this.gitHeadCache.get(filePath)!;

    // Check if the same line number exists in HEAD and has the same content
    if (lineNumber >= 0 && lineNumber < headLines.length) {
      const headLineContent = headLines[lineNumber];
      const isUnchanged = headLineContent?.trim() === lineContent.trim();

      // Log comparison for debugging environment issues
      if (isUnchanged) {
        log.debug('HEAD comparison: unchanged', {
          file: fileName,
          line: lineNumber,
          content: lineContent.substring(0, 30),
        });
      } else {
        log.debug('HEAD comparison: changed', {
          file: fileName,
          line: lineNumber,
          headContent: headLineContent?.substring(0, 30),
          currentContent: lineContent.substring(0, 30),
        });
      }

      return isUnchanged;
    }

    // Line doesn't exist at this position in HEAD
    log.debug('Line not in HEAD (new line)', {
      file: fileName,
      line: lineNumber,
      headLines: headLines.length,
    });
    return false;
  }

  /**
   * Calculate similarity between two lines using Levenshtein algorithm
   */
  private calculateLineSimilarity(line1: string, line2: string): number {
    return this.matcher.calculate(line1, line2);
  }

  /**
   * Calculate confidence score based on similarity thresholds
   */
  private calculateConfidence(similarity: number, contributor: ContributorType): number {
    const thresholdPureAi = SIMILARITY_CONFIG.THRESHOLD_PURE_AI;
    const thresholdAiModified = SIMILARITY_CONFIG.THRESHOLD_AI_MODIFIED;

    switch (contributor) {
      case 'ai':
        // Higher similarity = higher confidence for AI
        return Math.min(
          1,
          ((similarity - thresholdPureAi) / (1 - thresholdPureAi)) * 0.5 + 0.5
        );
      case 'ai_modified': {
        // Middle range has lower confidence
        const range = thresholdPureAi - thresholdAiModified;
        const position = (similarity - thresholdAiModified) / range;
        return 0.5 + position * 0.3;
      }
      case 'human':
        // Lower similarity = higher confidence for human
        if (similarity === 0) {
          return 1;
        }
        return Math.max(0.3, 1 - similarity / thresholdAiModified);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
    this.gitHeadCache.clear();
  }

  /**
   * Load userPrompt from session file
   */
  private async loadUserPromptFromSession(sessionId: string): Promise<string | undefined> {
    try {
      // Try to load from HookSessionData first
      const sessionsFile = path.join(
        this.workspaceRoot,
        DATA_DIR_NAME,
        'data',
        'hooks',
        'sessions.json'
      );
      const content = await fs.readFile(sessionsFile, 'utf-8');
      const sessions = JSON.parse(content) as Record<string, { userPrompt?: string }>;
      const session = sessions[sessionId];
      if (session?.userPrompt) {
        return session.userPrompt;
      }

      // Try to load from SessionSource file
      const storage = new FileStorage(this.workspaceRoot);
      const sessionSource = await storage.getSession(sessionId);
      return sessionSource?.metadata?.userPrompt;
    } catch {
      return undefined;
    }
  }

  /**
   * Get agent display name
   */
  getAgentDisplayName(agent: string): string {
    if (agent in AGENT_CONFIGS) {
      return AGENT_CONFIGS[agent as keyof typeof AGENT_CONFIGS].name;
    }
    return agent;
  }
}
