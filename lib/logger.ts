type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMessage {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogMessage[] = [];
  private maxLogs: number = 1000;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private addLog(level: LogLevel, component: string, message: string, data?: any) {
    const logMessage: LogMessage = {
      timestamp: this.formatTimestamp(),
      level,
      component,
      message,
      data
    };

    this.logs.unshift(logMessage);
    
    // Keep logs under the maximum limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMessage = `[${logMessage.timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
      switch (level) {
        case 'info':
          console.info(consoleMessage, data);
          break;
        case 'warn':
          console.warn(consoleMessage, data);
          break;
        case 'error':
          console.error(consoleMessage, data);
          break;
        case 'debug':
          console.debug(consoleMessage, data);
          break;
      }
    }
  }

  info(component: string, message: string, data?: any) {
    this.addLog('info', component, message, data);
  }

  warn(component: string, message: string, data?: any) {
    this.addLog('warn', component, message, data);
  }

  error(component: string, message: string, data?: any) {
    this.addLog('error', component, message, data);
  }

  debug(component: string, message: string, data?: any) {
    this.addLog('debug', component, message, data);
  }

  getLogs(level?: LogLevel): LogMessage[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = Logger.getInstance();
