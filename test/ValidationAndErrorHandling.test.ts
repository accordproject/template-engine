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

import { ValidationEngine } from '../src/ValidationEngine';
import { ErrorHandler, TemplateEngineError } from '../src/ErrorHandler';
import { DebugLogger, LogLevel } from '../src/DebugLogger';
import { ModelManager } from '@accordproject/concerto-core';

describe('ValidationEngine', () => {
    let modelManager: ModelManager;

    beforeEach(() => {
        modelManager = new ModelManager();
    });

    test('validates template structure', () => {
        const templateDom = {
            $class: 'org.accordproject.templatemark@0.5.0.ClauseDefinition',
            name: 'test',
            template: []
        };

        const engine = new ValidationEngine(templateDom, modelManager);
        const result = engine.validate();

        expect(result.isValid).toBe(true);
    });

    test('detects invalid template structure', () => {
        const templateDom = null;

        const engine = new ValidationEngine(templateDom, modelManager);
        const result = engine.validate();

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test('reports validation errors in readable format', () => {
        const templateDom = {
            $class: 'invalid.class'
        };

        const engine = new ValidationEngine(templateDom, modelManager);
        const result = engine.validate();
        const report = engine.getReport(result);

        expect(report).toContain('✗ Template validation failed');
        expect(report).toContain('Errors');
    });
});

describe('ErrorHandler', () => {
    test('creates detailed error messages', () => {
        const error = ErrorHandler.createError('UNDEFINED_VARIABLE', {
            variable: 'amount'
        });

        expect(error).toBeInstanceOf(TemplateEngineError);
        expect(error.code).toBe('UNDEFINED_VARIABLE');
        expect(error.message).toContain('amount');
    });

    test('wraps existing errors', () => {
        const originalError = new Error('Original error message');
        const wrappedError = ErrorHandler.wrapError(originalError, { context: 'test' });

        expect(wrappedError).toBeInstanceOf(TemplateEngineError);
        expect(wrappedError.originalError).toBe(originalError);
    });

    test('identifies recoverable errors', () => {
        const error = ErrorHandler.createError('UNDEFINED_VARIABLE', { variable: 'test' });
        expect(ErrorHandler.isRecoverable(error)).toBe(true);

        const nonRecoverableError = ErrorHandler.createError('TEMPLATE_COMPILATION_ERROR', {
            details: 'Syntax error'
        });
        expect(ErrorHandler.isRecoverable(nonRecoverableError)).toBe(false);
    });

    test('provides recovery suggestions', () => {
        const error = ErrorHandler.createError('UNDEFINED_VARIABLE', { variable: 'amount' });
        const suggestion = ErrorHandler.getRecoverySuggestion(error);

        expect(suggestion).toBeTruthy();
        expect(suggestion.length).toBeGreaterThan(0);
    });

    test('formats errors for logging', () => {
        const error = ErrorHandler.createError('INVALID_DATA', {
            details: 'Data is missing required fields'
        });
        const formatted = ErrorHandler.formatError(error);

        expect(formatted).toContain('[INVALID_DATA]');
        expect(formatted).toContain('INVALID_DATA');
    });
});

describe('DebugLogger', () => {
    test('logs messages at different levels', () => {
        const logger = DebugLogger.getInstance(true);
        logger.clearEvents();

        logger.debug('test', 'Debug message');
        logger.info('test', 'Info message');
        logger.warn('test', 'Warning message');
        logger.error('test', 'Error message');

        const events = logger.getEvents();
        expect(events.length).toBe(4);
        expect(events[0].level).toBe(LogLevel.DEBUG);
        expect(events[3].level).toBe(LogLevel.ERROR);
    });

    test('filters events by level', () => {
        const logger = DebugLogger.getInstance(true);
        logger.clearEvents();

        logger.debug('test', 'Debug');
        logger.warn('test', 'Warning');
        logger.error('test', 'Error');

        const errors = logger.getEventsByLevel(LogLevel.ERROR);
        expect(errors.length).toBe(1);
    });

    test('filters events by category', () => {
        const logger = DebugLogger.getInstance(true);
        logger.clearEvents();

        logger.info('parser', 'Parse started');
        logger.info('evaluator', 'Evaluation started');
        logger.info('parser', 'Parse completed');

        const parserEvents = logger.getEventsByCategory('parser');
        expect(parserEvents.length).toBe(2);
    });

    test('logs with timing information', () => {
        const logger = DebugLogger.getInstance(true);
        logger.clearEvents();

        const result = logger.logSync('test', 'Sync operation', () => {
            return 42;
        });

        expect(result).toBe(42);
        const events = logger.getEvents();
        expect(events.length).toBe(2); // Starting and Completed messages
    });

    test('generates debug report', () => {
        const logger = DebugLogger.getInstance(true);
        logger.clearEvents();

        logger.debug('test', 'Debug message');
        logger.error('test', 'Error message');

        const report = logger.generateReport();
        expect(report).toContain('Debug Report');
        expect(report).toContain('Total Events: 2');
        expect(report).toContain('Errors: 1');
    });
});
