/**
 * Application Logger
 *
 * Provides structured logging for Sensie operations.
 * Logs are formatted for easy parsing and include context.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  topicId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

const LOG_COLORS = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
};

const LOG_PREFIXES = {
  debug: '[DEBUG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
};

function formatLog(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = LOG_PREFIXES[level];
  const color = LOG_COLORS[level];
  const reset = LOG_COLORS.reset;

  let logLine = `${color}${prefix}${reset} ${timestamp} [${module}] ${message}`;

  if (context && Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' ');
    logLine += ` | ${contextStr}`;
  }

  return logLine;
}

function shouldLog(level: LogLevel): boolean {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(logLevel as LogLevel);
}

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, context?: LogContext) => {
      if (shouldLog('debug')) {
        console.log(formatLog('debug', module, message, context));
      }
    },
    info: (message: string, context?: LogContext) => {
      if (shouldLog('info')) {
        console.log(formatLog('info', module, message, context));
      }
    },
    warn: (message: string, context?: LogContext) => {
      if (shouldLog('warn')) {
        console.warn(formatLog('warn', module, message, context));
      }
    },
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      if (shouldLog('error')) {
        const errorContext = error instanceof Error
          ? { ...context, errorMessage: error.message, errorStack: error.stack }
          : { ...context, error: String(error) };
        console.error(formatLog('error', module, message, errorContext));
      }
    },
  };
}

// Pre-configured loggers for common modules
export const authLogger = createLogger('auth');
export const topicsLogger = createLogger('topics');
export const learningLogger = createLogger('learning');
export const chatLogger = createLogger('chat');
export const reviewLogger = createLogger('review');
export const progressLogger = createLogger('progress');
