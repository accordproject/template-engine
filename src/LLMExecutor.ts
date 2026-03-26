/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { LLMProviderAdapter } from './LLMProviderAdapter';
import { OpenAIAdapter } from './providers/OpenAIAdapter';

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
    private readonly adapterOverride?: LLMProviderAdapter;

    constructor(adapter?: LLMProviderAdapter) {
        this.adapterOverride = adapter;
    }

    private getAdapter(config: LLMConfig): LLMProviderAdapter {
        if (this.adapterOverride) {
            return this.adapterOverride;
        }
        if (config.provider === 'openai') {
            return new OpenAIAdapter();
        }
        throw new LLMExecutorError('PROVIDER_ERROR', `Unsupported provider: ${config.provider}`);
    }

    private buildTriggerPrompt(input: ExecutorInput): string {
        return [
            'You are executing contract logic.',
            'Return only valid JSON with this exact shape:',
            '{"response": {...}, "state": {...}, "emit": [{...}]}',
            'No markdown. No prose.',
            `Contract:\n${input.contractText}`,
            input.modelDefinitions ? `Model Definitions:\n${input.modelDefinitions}` : '',
            `Current State JSON:\n${JSON.stringify(input.state)}`,
            `Request JSON:\n${JSON.stringify(input.request)}`
        ].filter(Boolean).join('\n\n');
    }

    private buildInitPrompt(input: InitExecutorInput): string {
        return [
            'You are initializing contract state.',
            'Return only valid JSON with this exact shape:',
            '{"state": {...}}',
            'No markdown. No prose.',
            `Contract:\n${input.contractText}`,
            input.modelDefinitions ? `Model Definitions:\n${input.modelDefinitions}` : '',
            `Init Request JSON:\n${JSON.stringify(input.request)}`
        ].filter(Boolean).join('\n\n');
    }

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

    async trigger(input?: ExecutorInput, config?: LLMConfig): Promise<ExecutorOutput> {
        if (!input || !config) {
            throw new LLMExecutorError('PROVIDER_ERROR', 'Missing input/config for trigger');
        }

        const adapter = this.getAdapter(config);
        const prompt = this.buildTriggerPrompt(input);
        const raw = await adapter.completeJson(prompt, config);
        const parsed = this.parseModelJson(raw);
        return this.assertTriggerShape(parsed);
    }

    async init(input?: InitExecutorInput, config?: LLMConfig): Promise<InitOutput> {
        if (!input || !config) {
            throw new LLMExecutorError('PROVIDER_ERROR', 'Missing input/config for init');
        }

        const adapter = this.getAdapter(config);
        const prompt = this.buildInitPrompt(input);
        const raw = await adapter.completeJson(prompt, config);
        const parsed = this.parseModelJson(raw);
        return this.assertInitShape(parsed);
    }
}