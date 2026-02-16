
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'API';

export interface LogEntry {
    id: string;
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
    context?: string; // e.g. 'nse-client', 'api-route'
}

// In-memory store (Note: will reset on server restart/redeploy)
const MAX_LOGS = 1000;
let logs: LogEntry[] = [];

export const logger = {
    log: (level: LogLevel, message: string, data?: any, context?: string) => {
        const entry: LogEntry = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            context,
        };

        // Add to beginning
        logs.unshift(entry);

        // Trim
        if (logs.length > MAX_LOGS) {
            logs = logs.slice(0, MAX_LOGS);
        }

        // Also console log for server stdout
        console.log(`[${entry.timestamp}] [${level}] [${context || 'global'}] ${message}`, data ? JSON.stringify(data) : '');
    },

    info: (message: string, data?: any, context?: string) => logger.log('INFO', message, data, context),
    warn: (message: string, data?: any, context?: string) => logger.log('WARN', message, data, context),
    error: (message: string, data?: any, context?: string) => logger.log('ERROR', message, data, context),
    debug: (message: string, data?: any, context?: string) => logger.log('DEBUG', message, data, context),
    api: (message: string, data?: any, context?: string) => logger.log('API', message, data, context),

    getLogs: (limit: number = 100) => {
        return logs.slice(0, limit);
    },

    clear: () => {
        logs = [];
    }
};
