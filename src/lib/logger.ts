
/** Severity / category for each log entry. */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'API';

/**
 * A single log entry stored by the in-memory logger.
 *
 * - `message`      – short, technical summary (what happened).
 * - `description`  – plain-English explanation of *why it matters*,
 *                     aimed at anyone viewing the Developer Console.
 * - `context`      – the subsystem that produced the log
 *                     (e.g. "NSE Data Service", "Stock Scanner").
 * - `data`         – optional structured payload for debugging.
 */
export interface LogEntry {
    id: string;
    timestamp: string;
    level: LogLevel;
    message: string;
    description?: string;
    data?: any;
    context?: string;
}

// In-memory ring-buffer (resets on server restart / redeploy)
const MAX_LOGS = 1000;
let logs: LogEntry[] = [];

/**
 * Central logger used by every subsystem.
 *
 * Each helper (info / warn / error / debug / api) accepts an optional
 * `description` string that is shown front-and-center in the Developer
 * Console to give non-technical readers immediate context.
 */
export const logger = {
    log: (
        level: LogLevel,
        message: string,
        data?: any,
        context?: string,
        description?: string,
    ) => {
        const entry: LogEntry = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            level,
            message,
            description,
            data,
            context,
        };

        // Newest first
        logs.unshift(entry);

        // Keep the buffer bounded
        if (logs.length > MAX_LOGS) {
            logs = logs.slice(0, MAX_LOGS);
        }

        // Mirror to server stdout for production debugging
        console.log(
            `[${entry.timestamp}] [${level}] [${context || 'global'}] ${message}`,
            data ? JSON.stringify(data) : '',
        );
    },

    /** General informational event. */
    info: (message: string, data?: any, context?: string, description?: string) =>
        logger.log('INFO', message, data, context, description),

    /** Something unexpected but non-fatal happened. */
    warn: (message: string, data?: any, context?: string, description?: string) =>
        logger.log('WARN', message, data, context, description),

    /** A failure that prevented an operation from completing. */
    error: (message: string, data?: any, context?: string, description?: string) =>
        logger.log('ERROR', message, data, context, description),

    /** Low-level detail useful only during development. */
    debug: (message: string, data?: any, context?: string, description?: string) =>
        logger.log('DEBUG', message, data, context, description),

    /** An outgoing network / API call. */
    api: (message: string, data?: any, context?: string, description?: string) =>
        logger.log('API', message, data, context, description),

    /** Return the most recent `limit` log entries (newest first). */
    getLogs: (limit: number = 100) => {
        return logs.slice(0, limit);
    },

    /** Wipe every stored log entry. */
    clear: () => {
        logs = [];
    },
};
