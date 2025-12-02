import { create } from 'zustand';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

interface LogsState {
  logs: LogMessage[];
  addLog: (level: LogLevel, component: string, message: string, data?: any) => void;
  clearLogs: () => void;
  getLogs: (level?: LogLevel) => LogMessage[];
}

export const useLogs = create<LogsState>((set, get) => ({
  logs: [],
  
  addLog: (level, component, message, data) => {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data
    };

    // Log to console in development
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

    set(state => ({
      logs: [logMessage, ...state.logs].slice(0, 1000) // Keep last 1000 logs
    }));
  },

  clearLogs: () => set({ logs: [] }),
  
  getLogs: (level) => {
    const { logs } = get();
    if (level) {
      return logs.filter(log => log.level === level);
    }
    return logs;
  }
}));
