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
 * Represents a detailed template engine error with context
 */
export class TemplateEngineError extends Error {
    public readonly code: string;
    public readonly context: Record<string, any>;
    public readonly originalError?: Error;

    constructor(code: string, message: string, context?: Record<string, any>, originalError?: Error) {
        super(message);
        this.code = code;
        this.context = context || {};
        this.originalError = originalError;
        this.name = 'TemplateEngineError';

        // Maintain proper prototype chain
        Object.setPrototypeOf(this, TemplateEngineError.prototype);
    }

    /**
     * Get a formatted error message with context
     */
    public getDetailedMessage(): string {
        let message = `[${this.code}] ${this.message}\n`;

        if (Object.keys(this.context).length > 0) {
            message += '\nContext:\n';
            Object.entries(this.context).forEach(([key, value]) => {
                message += `  ${key}: ${JSON.stringify(value)}\n`;
            });
        }

        if (this.originalError) {
            message += `\nOriginal Error: ${this.originalError.message}`;
        }

        return message;
    }

    /**
     * Convert to JSON for logging
     */
    public toJSON(): Record<string, any> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            context: this.context,
            originalError: this.originalError ? {
                name: this.originalError.name,
                message: this.originalError.message,
                stack: this.originalError.stack
            } : undefined,
            stack: this.stack
        };
    }
}

/**
 * Handles template engine errors with enhanced messages
 */
export class ErrorHandler {
    private static readonly ERROR_MESSAGES: Record<string, string> = {
        // Variable errors
        'UNDEFINED_VARIABLE': 'Variable "{variable}" is not defined in the template data model.',
        'MISSING_VARIABLE_VALUE': 'Variable "{variable}" has no value provided in the data.',
        'VARIABLE_TYPE_MISMATCH': 'Variable "{variable}" has type mismatch. Expected "{expected}" but got "{actual}".',

        // Formula errors
        'INVALID_FORMULA': 'Formula "{formula}" contains invalid JavaScript: {details}',
        'FORMULA_EVALUATION_ERROR': 'Failed to evaluate formula "{formula}": {details}',
        'EMPTY_FORMULA': 'Formula "{formula}" is empty.',

        // Conditional errors
        'INVALID_CONDITION': 'Condition in "{conditional}" is invalid: {details}',
        'CONDITION_EVALUATION_ERROR': 'Failed to evaluate condition "{conditional}": {details}',

        // Template errors
        'INVALID_TEMPLATE_STRUCTURE': 'Template has invalid structure: {details}',
        'MISSING_DATA_MODEL': 'Data model not found for template.',
        'TEMPLATE_COMPILATION_ERROR': 'Failed to compile template: {details}',

        // Data errors
        'INVALID_DATA': 'Provided data is invalid: {details}',
        'DATA_VALIDATION_ERROR': 'Data validation failed: {details}',

        // Execution errors
        'EXECUTION_ERROR': 'Template execution failed: {details}',
        'JAVASCRIPT_EVALUATION_DISABLED': 'JavaScript evaluation is disabled. Cannot execute expressions in template.',
    };

    /**
     * Create a detailed error message
     */
    public static createError(code: string, variables?: Record<string, any>, originalError?: Error): TemplateEngineError {
        let message = this.ERROR_MESSAGES[code] || `Unknown error: ${code}`;

        // Replace placeholders with provided variables
        if (variables) {
            Object.entries(variables).forEach(([key, value]) => {
                message = message.replace(`{${key}}`, String(value));
            });
        }

        return new TemplateEngineError(code, message, variables, originalError);
    }

    /**
     * Wrap and enhance an existing error
     */
    public static wrapError(error: Error, context?: Record<string, any>): TemplateEngineError {
        if (error instanceof TemplateEngineError) {
            return error;
        }

        const code = this.inferErrorCode(error);
        const message = error.message || 'Unknown error occurred';

        return new TemplateEngineError(code, message, context, error);
    }

    /**
     * Infer error code from error message
     */
    private static inferErrorCode(error: Error): string {
        const message = error.message.toLowerCase();

        if (message.includes('undefined') || message.includes('not defined')) {
            return 'UNDEFINED_VARIABLE';
        }
        if (message.includes('type') || message.includes('mismatch')) {
            return 'VARIABLE_TYPE_MISMATCH';
        }
        if (message.includes('syntax') || message.includes('invalid')) {
            return 'INVALID_FORMULA';
        }
        if (message.includes('evaluation')) {
            return 'FORMULA_EVALUATION_ERROR';
        }

        return 'EXECUTION_ERROR';
    }

    /**
     * Format error for logging
     */
    public static formatError(error: TemplateEngineError): string {
        return error.getDetailedMessage();
    }

    /**
     * Check if error is recoverable
     */
    public static isRecoverable(error: TemplateEngineError): boolean {
        const recoverableCodes = [
            'UNDEFINED_VARIABLE',
            'MISSING_VARIABLE_VALUE',
            'VARIABLE_TYPE_MISMATCH',
            'INVALID_DATA',
            'DATA_VALIDATION_ERROR'
        ];

        return recoverableCodes.includes(error.code);
    }

    /**
     * Get recovery suggestion for an error
     */
    public static getRecoverySuggestion(error: TemplateEngineError): string {
        const suggestions: Record<string, string> = {
            'UNDEFINED_VARIABLE': 'Check that the variable name matches the template data model property names.',
            'MISSING_VARIABLE_VALUE': 'Ensure all required variables are provided in the input data.',
            'VARIABLE_TYPE_MISMATCH': 'Convert the data to the correct type before passing it to the template engine.',
            'INVALID_FORMULA': 'Review the formula syntax and ensure it is valid JavaScript.',
            'INVALID_DATA': 'Verify the data structure matches the expected template data model.',
        };

        return suggestions[error.code] || 'Please review the template and data for inconsistencies.';
    }
}
