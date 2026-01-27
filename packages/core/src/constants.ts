/**
 * Vibe Review core constants
 */

/**
 * Default data directory name
 */
export const DATA_DIR_NAME = '.vibe-review';

/**
 * Subdirectory names within the data directory
 */
export const DATA_SUBDIRS = {
  DATA: 'data',
  SESSIONS: 'sessions',
  REVIEW_UNITS: 'review-units',
  CONFIG: 'config',
} as const;

/**
 * File names for data storage
 */
export const DATA_FILES = {
  TODOS: 'todos.json',
  METADATA: 'metadata.json',
  INDEX: 'index.json',
  SETTINGS: 'settings.json',
  ADAPTERS: 'adapters.json',
} as const;

/**
 * Similarity thresholds for contributor detection
 */
export const SIMILARITY_CONFIG = {
  /** >= 90% determined as pure AI generation */
  THRESHOLD_PURE_AI: 0.9,

  /** 70-90% determined as AI generation but human modified */
  THRESHOLD_AI_MODIFIED: 0.7,

  /** Matching granularity */
  MATCHING_GRANULARITY: 'hunk' as const,

  /** Algorithm used for similarity calculation */
  ALGORITHM: 'levenshtein' as const,
} as const;

/**
 * Contributor types
 */
export type ContributorType = 'ai' | 'ai_modified' | 'human';

/**
 * Agent configuration for different platforms
 */
export const AGENT_CONFIGS = {
  cursor: {
    name: 'Cursor',
    configDir: '.cursor',
    configFile: 'hooks.json',
    hooks: {
      fileEdit: 'afterFileEdit',
      stop: 'stop',
    },
  },
  'cursor-cli': {
    name: 'Cursor CLI',
    configDir: '.cursor',
    configFile: 'hooks.json',
    hooks: {
      fileEdit: 'afterFileEdit',
      stop: 'stop',
    },
  },
  'claude-code': {
    name: 'Claude Code',
    configDir: '.claude',
    configFile: 'settings.json',
    hooks: {
      fileEdit: 'PostToolUse',
      stop: 'Stop',
    },
  },
  opencode: {
    name: 'OpenCode',
    configDir: '.opencode',
    configFile: 'config.json',
    hooks: {
      fileEdit: 'afterEdit',
      stop: 'stop',
    },
  },
  'gemini-cli': {
    name: 'Gemini CLI',
    configDir: '.gemini',
    configFile: 'config.json',
    hooks: {
      fileEdit: 'afterEdit',
      stop: 'stop',
    },
  },
} as const;

/**
 * Supported agent types (from AGENT_CONFIGS keys)
 */
export const SUPPORTED_AGENTS = Object.keys(AGENT_CONFIGS) as (keyof typeof AGENT_CONFIGS)[];
