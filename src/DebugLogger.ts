/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Log levels for debug logging
 */
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

/**
 * Debug event for tracing template execution
 */
export interface DebugEvent {
    timestamp: number;
    level: LogLevel;
    category: string;
    message: string;
    data?: any;
    duration?: number;
}

/**
 * Provides debug logging and tracing for template execution
 */
export class DebugLogger {
    private static instance: DebugLogger;
    private events: DebugEvent[] = [];
    private enabled: boolean = false;
    private maxEvents: number = 1000;
    private readonly messageLogger?: (message: string) => void;

    private constructor(enabled: boolean = false, messageLogger?: (message: string) => void) {
        this.enabled = enabled;
        this.messageLogger = messageLogger;
    }

    /**
     * Get or create the singleton instance
     */
    public static getInstance(enabled: boolean = false, messageLogger?: (message: string) => void): DebugLogger {
        if (!DebugLogger.instance) {
            DebugLogger.instance = new DebugLogger(enabled, messageLogger);
        }
        return DebugLogger.instance;
    }

    /**
     * Enable or disable debug logging
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Log a debug message
     */
    public debug(category: string, message: string, data?: any): void {
        this.log(LogLevel.DEBUG, category, message, data);
    }

    /**
     * Log an info message
     */
    public info(category: string, message: string, data?: any): void {
        this.log(LogLevel.INFO, category, message, data);
    }

    /**
     * Log a warning message
     */
    public warn(category: string, message: string, data?: any): void {
        this.log(LogLevel.WARN, category, message, data);
    }

    /**
     * Log an error message
     */
    public error(category: string, message: string, data?: any): void {
        this.log(LogLevel.ERROR, category, message, data);
    }

    /**
     * Log with timing information
     */
    public async logAsync<T>(
        category: string,
        message: string,
        fn: () => Promise<T>,
        data?: any
    ): Promise<T> {
        const startTime = performance.now();
        this.info(category, `Starting: ${message}`, data);

        try {
            const result = await fn();
            const duration = performance.now() - startTime;
            this.info(category, `Completed: ${message}`, { ...data, duration: `${duration.toFixed(2)}ms` });
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.error(category, `Failed: ${message}`, { ...data, error, duration: `${duration.toFixed(2)}ms` });
            throw error;
        }
    }

    /**
     * Log with sync timing information
     */
    public logSync<T>(
        category: string,
        message: string,
        fn: () => T,
        data?: any
    ): T {
        const startTime = performance.now();
        this.info(category, `Starting: ${message}`, data);

        try {
            const result = fn();
            const duration = performance.now() - startTime;
            this.info(category, `Completed: ${message}`, { ...data, duration: `${duration.toFixed(2)}ms` });
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.error(category, `Failed: ${message}`, { ...data, error, duration: `${duration.toFixed(2)}ms` });
            throw error;
        }
    }

    /**
     * Internal log method
     */
    private log(level: LogLevel, category: string, message: string, data?: any): void {
        if (!this.enabled && level !== LogLevel.ERROR) {
            return;
        }

        const event: DebugEvent = {
            timestamp: Date.now(),
            level,
            category,
            message,
            data
        };

        this.events.push(event);

        // Keep event list size manageable
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        // Also log to console if enabled
        if (this.enabled || level === LogLevel.ERROR) {
            this.outputLog(event);
        }
    }

    /**
     * Output log message
     */
    private outputLog(event: DebugEvent): void {
        const timestamp = new Date(event.timestamp).toISOString();
        const logMessage = `[${timestamp}] [${event.level}] [${event.category}] ${event.message}`;

        if (this.messageLogger) {
            this.messageLogger(logMessage);
        } else {
            // eslint-disable-next-line no-console
            console.log(logMessage);
            if (event.data) {
                // eslint-disable-next-line no-console
                console.log(event.data);
            }
        }
    }

    /**
     * Get all logged events
     */
    public getEvents(): DebugEvent[] {
        return [...this.events];
    }

    /**
     * Get events by level
     */
    public getEventsByLevel(level: LogLevel): DebugEvent[] {
        return this.events.filter(e => e.level === level);
    }

    /**
     * Get events by category
     */
    public getEventsByCategory(category: string): DebugEvent[] {
        return this.events.filter(e => e.category === category);
    }

    /**
     * Clear all events
     */
    public clearEvents(): void {
        this.events = [];
    }

    /**
     * Generate a debug report
     */
    public generateReport(): string {
        let report = '=== Debug Report ===\n\n';
        report += `Total Events: ${this.events.length}\n`;
        report += `Errors: ${this.getEventsByLevel(LogLevel.ERROR).length}\n`;
        report += `Warnings: ${this.getEventsByLevel(LogLevel.WARN).length}\n`;
        report += `Info: ${this.getEventsByLevel(LogLevel.INFO).length}\n`;
        report += `Debug: ${this.getEventsByLevel(LogLevel.DEBUG).length}\n\n`;

        report += '=== Events ===\n';
        this.events.forEach(event => {
            const timestamp = new Date(event.timestamp).toISOString();
            report += `[${timestamp}] [${event.level}] [${event.category}] ${event.message}\n`;
            if (event.data) {
                report += `  Data: ${JSON.stringify(event.data, null, 2)}\n`;
            }
            if (event.duration) {
                report += `  Duration: ${event.duration}ms\n`;
            }
        });

        return report;
    }
}
