/* eslint-disable @typescript-eslint/no-explicit-any */

import { Template } from '@accordproject/cicero-core';
import { GroqReasoner } from './GroqReasoner';
import { LLMExecutorConfig } from './LLMConfig';
console.log("LLM EXECUTOR RUNNING");
export type TriggerResponse = {
    result: object;
    state: object;
    events: object[];
};

export type InitResponse = {
    state: object;
};

function extractJson(text: string): any {
    const raw = text.trim();

    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (match) {
            return JSON.parse(match[1]);
        }
        throw new Error(`LLM did not return valid JSON. Raw output: ${text}`);
    }
}

function assertInitShape(value: any): asserts value is InitResponse {
    if (!value || typeof value !== 'object' || !value.state || typeof value.state !== 'object') {
        throw new Error('Invalid init response shape from LLM');
    }
}

function assertTriggerShape(value: any): asserts value is TriggerResponse {
    if (!value || typeof value !== 'object') {
        throw new Error('Invalid trigger response: not an object');
    }
    if (!value.result || typeof value.result !== 'object') {
        throw new Error('Invalid trigger response: missing result');
    }
    if (!value.state || typeof value.state !== 'object') {
        throw new Error('Invalid trigger response: missing state');
    }
    if (!Array.isArray(value.events)) {
        throw new Error('Invalid trigger response: events must be an array');
    }
}

export class LLMExecutor {
    private readonly template: Template;
    private readonly config: LLMExecutorConfig;
    private readonly groq: GroqReasoner;

    constructor(template: Template, config: LLMExecutorConfig) {
        this.template = template;
        this.config = config;

        if (config.provider.provider !== 'groq') {
            throw new Error(`Unsupported provider: ${config.provider.provider}`);
        }

        this.groq = new GroqReasoner({
            apiKey: config.provider.apiKey,
            model: config.provider.model,
            baseUrl: config.provider.baseUrl,
            temperature: config.provider.temperature ?? 0,
            maxTokens: config.provider.maxTokens ?? 4096,
            topP: config.provider.topP ?? 1,
            reasoningEffort: config.provider.reasoningEffort ?? 'medium',
            timeoutMs: config.provider.timeoutMs ?? 60000
        });
    }

    private buildSharedContext() {
        const metadata = this.template.getMetadata?.();
        const templateModel = this.template.getTemplateModel?.();
        const modelManager = this.template.getModelManager?.();

        return {
            templateName: metadata?.getName?.() ?? 'unknown-template',
            templateVersion: metadata?.getVersion?.() ?? null,
            contractText: this.template.getTemplate?.() ?? '',
            templateModelType: templateModel?.getFullyQualifiedName?.() ?? null,
            modelFiles: modelManager?.getModelFiles?.().map((mf: any) => ({
                name: mf.getName?.() ?? 'unknown.cto',
                content: mf.getDefinitions?.() ?? ''
            })) ?? []
        };
    }

    private async ask(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
        const retries = this.config.provider.retries ?? 1;
        let lastError: unknown;

        for (let i = 0; i <= retries; i++) {
            try {
                return await this.groq.complete(messages);
            } catch (err) {
                lastError = err;
            }
        }

        throw lastError;
    }
    private normalizeInitResponse(response: any, data: any): InitResponse {
        const rawState = response?.state ?? {};
        const identifier =
            rawState?.$identifier ||
            data?.$identifier ||
            data?.clauseId ||
            data?.contractId ||
            'state-1';

        const normalizedState: Record<string, any> = {};

        if (rawState.$class) {
            normalizedState.$class = rawState.$class;
        }
        normalizedState.$identifier = identifier;

        for (const [key, value] of Object.entries(rawState)) {
            if (key === '$class' || key === '$identifier') {
                continue;
            }
            normalizedState[key] = value;
        }

        return {
            state: normalizedState
        };
    }

    private normalizeTriggerResponse(
        response: any,
        data: any,
        currentTime?: string
    ): TriggerResponse {
        const now = currentTime || new Date().toISOString();

        const rawResult = response?.result ?? {};
        const rawState = response?.state ?? {};
        const rawEvents = Array.isArray(response?.events) ? response.events : [];

        const normalizedResult: Record<string, any> = {};

        for (const [key, value] of Object.entries(rawResult)) {
            if (key === '$timestamp' || key === '$class') {
                continue;
            }
            normalizedResult[key] = value;
        }
        normalizedResult.$timestamp = rawResult.$timestamp || now;
        if (rawResult.$class) {
            normalizedResult.$class = rawResult.$class;
        }

        const normalizedEvents = rawEvents.map((event: any) => {
            const normalizedEvent: Record<string, any> = {};

            if (event?.$class) {
                normalizedEvent.$class = event.$class;
            }
            normalizedEvent.$timestamp = event?.$timestamp || now;

            for (const [key, value] of Object.entries(event ?? {})) {
                if (key === '$class' || key === '$timestamp') {
                    continue;
                }
                normalizedEvent[key] = value;
            }

            return normalizedEvent;
        });

        const identifier =
            rawState?.$identifier ||
            data?.$identifier ||
            data?.clauseId ||
            data?.contractId ||
            'state-1';

        const normalizedState: Record<string, any> = {};

        if (rawState.$class) {
            normalizedState.$class = rawState.$class;
        }
        normalizedState.$identifier = identifier;

        for (const [key, value] of Object.entries(rawState)) {
            if (key === '$class' || key === '$identifier') {
                continue;
            }
            normalizedState[key] = value;
        }

        return {
            result: normalizedResult,
            events: normalizedEvents,
            state: normalizedState
        };
    }


    async init(data: any, currentTime?: string, utcOffset?: number): Promise<InitResponse> {
        console.log("[LLMExecutor] INIT called");
        const context = this.buildSharedContext();

        const systemPrompt = `
        You are a generic Accord Project contract runtime executor.
        You will receive:
        - contract text
        - Concerto model definitions
        - template data

        Task:
        Compute the initial state of the contract.

        Rules:
        - Return ONLY valid JSON
        - No markdown
        - No explanation
        - Output exactly:
        {
        "state": { ... }
        }
        - The state must match the contract's state model
        - Preserve "$class" when inferable
        `;

        const userPrompt = JSON.stringify({
            operation: 'init',
            currentTime: currentTime ?? new Date().toISOString(),
            utcOffset: utcOffset ?? 0,
            data,
            context
        });

        const response = await this.ask([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);

        const parsed = extractJson(response.content);
        assertInitShape(parsed);
        return this.normalizeInitResponse(parsed, data);
    }

    async trigger(
        data: any,
        request: any,
        state?: any,
        currentTime?: string,
        utcOffset?: number
    ): Promise<TriggerResponse> {
        console.log("[LLMExecutor] TRIGGER called");
        const context = this.buildSharedContext();

        const systemPrompt = `
                              You are a generic Accord Project contract runtime executor.
                              You will receive:
                              - contract text
                              - Concerto model definitions
                              - template data
                              - current state
                              - incoming request/transaction

                              Task:
                              Evaluate contract behavior for this request.

                              Rules:
                              - Return ONLY valid JSON
                              - No markdown
                              - No explanation
                              - Output exactly:
                              {
                                "result": { ... },
                                "state": { ... },
                                "events": [ ... ]
                              }
                              - result must match a response model
                              - state must match the state model
                              - events must match declared event models
                              - preserve "$class" fields where appropriate
                              - Runtime metadata like "$timestamp" and "$identifier" may be added by runtime
                              `;

        const userPrompt = JSON.stringify({
            operation: 'trigger',
            currentTime: currentTime ?? new Date().toISOString(),
            utcOffset: utcOffset ?? 0,
            data,
            request,
            state: state ?? {},
            context
        });

        const response = await this.ask([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);

        const parsed = extractJson(response.content);
        assertTriggerShape(parsed);
        return this.normalizeTriggerResponse(parsed, data, currentTime);
    }
}