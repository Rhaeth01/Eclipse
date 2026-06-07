/**
 * Service de logging harmonisé
 * Centralise les logs avec niveaux et formattage cohérent
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

type LogCallback = (entry: LogEntry) => void;

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: LogCallback[] = [];
  
  // Couleurs pour la console
  private readonly colors = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    reset: '\x1b[0m'
  };

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // S'abonner aux logs (pour WebSocket)
  onLog(callback: LogCallback): void {
    this.listeners.push(callback);
  }

  // Se désabonner
  offLog(callback: LogCallback): void {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  private format(module: string, message: string): string {
    return `[${module}] ${message}`;
  }

  private log(level: LogLevel, module: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      module,
      message,
      data
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notifie les listeners (WebSocket)
    this.listeners.forEach(cb => {
      try {
        cb(entry);
      } catch {}
    });

    const color = this.colors[level];
    const reset = this.colors.reset;
    const timestamp = entry.timestamp.toISOString().split('T')[1].split('.')[0];
    
    console.log(`${color}[${timestamp}]${reset} ${this.format(module, message)}`);
    
    if (data !== undefined && level !== 'info') {
      console.log(color, data, reset);
    }
  }

  debug(module: string, message: string, data?: unknown): void {
    this.log('debug', module, message, data);
  }

  info(module: string, message: string, data?: unknown): void {
    this.log('info', module, message, data);
  }

  warn(module: string, message: string, data?: unknown): void {
    this.log('warn', module, message, data);
  }

  error(module: string, message: string, data?: unknown): void {
    this.log('error', module, message, data);
  }

  getLogs(level?: LogLevel, limit = 100): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter(l => l.level === level);
    }
    return filtered.slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }
}

export const logger = Logger.getInstance();
