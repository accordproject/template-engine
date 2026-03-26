/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
}

export interface ExecutorInput {
    contractText: string;
    state: Record<string, unknown>;
    request: Record<string, unknown>;
    modelDefinitions?: string;
}

export interface InitExecutorInput {
    contractText: string;
    request: Record<string, unknown>;
    modelDefinitions?: string;
}

export interface ExecutorOutput {
    response: Record<string, unknown>;
    state: Record<string, unknown>;
    emit: Record<string, unknown>[];
}

type InitOutput = {
    state: Record<string, unknown>;
};

export class LLMExecutorError extends Error {
    readonly code: 'INVALID_JSON' | 'INVALID_SHAPE' | 'PROVIDER_ERROR';

    constructor(code: LLMExecutorError['code'], message: string) {
        super(message);
        this.name = 'LLMExecutorError';
        this.code = code;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class LLMExecutor {
    parseModelJson(text: string): unknown {
        try {
            return JSON.parse(text);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown JSON parse error';
            throw new LLMExecutorError('INVALID_JSON', `Model output is not valid JSON: ${message}`);
        }
    }

    assertTriggerShape(value: unknown): ExecutorOutput {
        if (!isRecord(value)) {
            throw new LLMExecutorError('INVALID_SHAPE', 'Trigger output must be an object');
        }
        if (!isRecord(value.response)) {
            throw new LLMExecutorError('INVALID_SHAPE', 'Trigger output.response must be an object');
        }
        if (!isRecord(value.state)) {
            throw new LLMExecutorError('INVALID_SHAPE', 'Trigger output.state must be an object');
        }
        if (!Array.isArray(value.emit) || !value.emit.every((x) => isRecord(x))) {
            throw new LLMExecutorError('INVALID_SHAPE', 'Trigger output.emit must be an array of objects');
        }

        return {
            response: value.response,
            state: value.state,
            emit: value.emit
        };
    }

    assertInitShape(value: unknown): InitOutput {
        if (!isRecord(value)) {
            throw new LLMExecutorError('INVALID_SHAPE', 'Init output must be an object');
        }
        if (!isRecord(value.state)) {
            throw new LLMExecutorError('INVALID_SHAPE', 'Init output.state must be an object');
        }

        return {
            state: value.state
        };
    }

    async trigger(_input?: ExecutorInput, _config?: LLMConfig): Promise<ExecutorOutput> {
        void _input;
        void _config;
        throw new LLMExecutorError('PROVIDER_ERROR', 'LLMExecutor trigger provider call not implemented yet');
    }

    async init(_input?: InitExecutorInput, _config?: LLMConfig): Promise<InitOutput> {
        void _input;
        void _config;
        throw new LLMExecutorError('PROVIDER_ERROR', 'LLMExecutor init provider call not implemented yet');
    }
}