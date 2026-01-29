import * as path from 'node:path';
import * as fs from 'node:fs/promises';
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
  };
}

/**
 * Contributor Service - Detects AI vs Human contributors for uncommitted code
 *
 * Reads from .agent-blame/data/hooks/changes.jsonl and uses ContributorDetector
 * to match code lines with AI-generated records.
 */
export class ContributorService {
  private cache: Map<string, AgentRecord[]> = new Map();
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
    _lineNumber: number
  ): Promise<LineContributorResult | null> {
    // Get agent records for this file
    const agentRecords = await this.getAgentRecordsForFile(filePath);
    if (agentRecords.length === 0) {
      return null;
    }

    // Find best matching record by comparing line content
    let bestMatch: AgentRecord | undefined;
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

    if (bestSimilarity >= thresholdPureAi) {
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
            }
          : undefined,
      };
    }

    if (bestSimilarity >= thresholdAiModified) {
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
            }
          : undefined,
      };
    }

    return {
      contributor: 'human',
      similarity: bestSimilarity,
      confidence: this.calculateConfidence(bestSimilarity, 'human'),
    };
  }

  /**
   * Get agent records for a specific file (with caching)
   */
  private async getAgentRecordsForFile(filePath: string): Promise<AgentRecord[]> {
    const allRecords = await this.getAllAgentRecords();
    return allRecords.filter((record) => record.filePath === filePath);
  }

  /**
   * Get all agent records from changes.jsonl (with caching)
   */
  private async getAllAgentRecords(): Promise<AgentRecord[]> {
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
  private async loadAgentRecords(): Promise<AgentRecord[]> {
    const dataPath = path.join(this.workspaceRoot, DATA_DIR_NAME, 'data', 'hooks', 'changes.jsonl');

    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      const lines = content.trim().split('\n');
      const records: AgentRecord[] = [];

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

          const record: AgentRecord = {
            id: `${change.sessionId}-${String(change.timestamp)}`,
            sessionSource,
            filePath: change.filePath,
            content: change.newContent,
            addedLines,
            timestamp: change.timestamp,
          };

          records.push(record);
        } catch {
          // Skip invalid lines
        }
      }

      return records;
    } catch {
      // File doesn't exist or can't be read
      return [];
    }
  }

  /**
   * Calculate added lines by diffing oldContent and newContent
   */
  private calculateAddedLines(oldContent: string, newContent: string): string[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

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
