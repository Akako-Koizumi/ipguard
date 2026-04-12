export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel: LogLevel = 'info';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, context: string, message: string, extra?: unknown): string {
  const timestamp = formatTimestamp();
  const meta = extra !== undefined ? ` ${JSON.stringify(extra)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${meta}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export function log(level: LogLevel, context: string, message: string, extra?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }
  const formatted = formatMessage(level, context, message, extra);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export function debug(context: string, message: string, extra?: unknown): void {
  log('debug', context, message, extra);
}

export function info(context: string, message: string, extra?: unknown): void {
  log('info', context, message, extra);
}

export function warn(context: string, message: string, extra?: unknown): void {
  log('warn', context, message, extra);
}

export function error(context: string, message: string, extra?: unknown): void {
  log('error', context, message, extra);
}

export function withErrorHandling<T>(
  context: string,
  operation: string,
  fn: () => T
): T | null {
  try {
    return fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(context, `${operation} failed: ${message}`, { operation });
    return null;
  }
}

export async function withAsyncErrorHandling<T>(
  context: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(context, `${operation} failed: ${message}`, { operation });
    return null;
  }
}
