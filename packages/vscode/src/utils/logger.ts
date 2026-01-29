import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { OutputChannelTransport } from 'winston-transport-vscode';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Log level: debug | info | warn | error */
  level: string;
  /** Whether to write logs to file */
  logToFile: boolean;
  /** Log retention days */
  retentionDays: number;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  logToFile: true,
  retentionDays: 7,
};

/**
 * Global logger instance
 */
let loggerInstance: winston.Logger | null = null;

/**
 * Custom format for log output
 * Format: [timestamp] LEVEL [module] message {context}
 */
const customFormat = winston.format.printf(({ level, message, timestamp, module, ...context }) => {
  const moduleStr = module ? `[${module}]` : '';
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${moduleStr} ${message}${contextStr}`;
});

/**
 * Create a winston logger instance
 *
 * @param outputChannel VSCode output channel for log display
 * @param workspaceRoot Workspace root path for file logging
 * @param config Logger configuration
 */
export function createLogger(
  outputChannel: vscode.OutputChannel,
  workspaceRoot: string,
  config: Partial<LoggerConfig> = {}
): winston.Logger {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const logDir = path.join(workspaceRoot, '.agent-blame', 'logs');

  // Ensure log directory exists
  if (mergedConfig.logToFile && !fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const transports: winston.transport[] = [
    // VSCode OutputChannel transport
    new OutputChannelTransport({
      outputChannel,
      format: winston.format.combine(winston.format.timestamp({ format: 'HH:mm:ss.SSS' }), customFormat),
    }),
  ];

  // Add file transport if enabled
  if (mergedConfig.logToFile) {
    transports.push(
      new DailyRotateFile({
        dirname: logDir,
        filename: 'vscode-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: `${mergedConfig.retentionDays}d`,
        zippedArchive: true,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.json()
        ),
      })
    );
  }

  const logger = winston.createLogger({
    level: mergedConfig.level,
    transports,
  });

  // Store singleton instance
  loggerInstance = logger;

  return logger;
}

/**
 * Get the global logger instance
 * Returns a no-op logger if not initialized
 */
export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    // Return a no-op logger if not initialized
    return winston.createLogger({
      silent: true,
    });
  }
  return loggerInstance;
}

/**
 * Create a child logger with a module name
 *
 * @param module Module name for log context
 */
export function createModuleLogger(module: string): ModuleLogger {
  return new ModuleLogger(module);
}

/**
 * Module-specific logger wrapper
 * Adds module context to all log calls
 */
export class ModuleLogger {
  constructor(private module: string) {}

  debug(message: string, context?: Record<string, unknown>): void {
    getLogger().debug(message, { module: this.module, ...context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    getLogger().info(message, { module: this.module, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    getLogger().warn(message, { module: this.module, ...context });
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const errorContext: Record<string, unknown> = { module: this.module, ...context };
    if (error instanceof Error) {
      errorContext.error = error.message;
      errorContext.stack = error.stack;
    } else if (error) {
      errorContext.error = String(error);
    }
    getLogger().error(message, errorContext);
  }
}

/**
 * Read logger configuration from VSCode settings
 */
export function getLoggerConfig(): LoggerConfig {
  const config = vscode.workspace.getConfiguration('agentBlame');
  return {
    level: config.get<string>('logLevel', DEFAULT_CONFIG.level),
    logToFile: config.get<boolean>('logToFile', DEFAULT_CONFIG.logToFile),
    retentionDays: config.get<number>('logRetentionDays', DEFAULT_CONFIG.retentionDays),
  };
}

/**
 * Dispose the logger
 */
export function disposeLogger(): void {
  if (loggerInstance) {
    loggerInstance.close();
    loggerInstance = null;
  }
}
