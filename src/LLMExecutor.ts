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

export class LLMExecutorError extends Error {
    readonly code: 'INVALID_JSON' | 'INVALID_SHAPE' | 'PROVIDER_ERROR';

    constructor(code: LLMExecutorError['code'], message: string) {
        super(message);
        this.name = 'LLMExecutorError';
        this.code = code;
    }
}

export class LLMExecutor {
    async trigger(): Promise<ExecutorOutput> {
        throw new LLMExecutorError('PROVIDER_ERROR', 'LLMExecutor trigger not implemented yet');
    }

    async init(): Promise<ExecutorOutput> {
        throw new LLMExecutorError('PROVIDER_ERROR', 'LLMExecutor init not implemented yet');
    }
}