type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify(this.formatMessage('debug', message, meta)));
    }
  }

  info(message: string, meta?: any) {
    console.info(JSON.stringify(this.formatMessage('info', message, meta)));
  }

  warn(message: string, meta?: any) {
    console.warn(JSON.stringify(this.formatMessage('warn', message, meta)));
  }

  error(message: string, meta?: any) {
    console.error(JSON.stringify(this.formatMessage('error', message, meta)));
  }
}

export const logger = new Logger();
