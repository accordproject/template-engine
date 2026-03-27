import { ResponseParser } from '../src/llm/ResponseParser';
import { PromptBuilder } from '../src/llm/PromptBuilder';
import { resolveConfig } from '../src/llm/LLMConfig';
import { createLLMProvider, LLMMessage, LLMProvider, LLMProviderResponse } from '../src/llm/LLMProvider';
import { LLMLogicExecutor } from '../src/llm/LLMLogicExecutor';
import { Template } from '@accordproject/cicero-core';

// ─────────────────────────────────────────────────────
// Mock LLM Provider for unit tests (no API key needed)
// ─────────────────────────────────────────────────────

class MockLLMProvider implements LLMProvider {
    private responses: string[];
    private callIndex = 0;
    public capturedMessages: LLMMessage[][] = [];

    constructor(responses: string[]) {
        this.responses = responses;
    }

    async chat(messages: LLMMessage[]): Promise<LLMProviderResponse> {
        this.capturedMessages.push([...messages]);
        const content = this.responses[this.callIndex] || this.responses[this.responses.length - 1];
        this.callIndex++;
        return { content, usage: { promptTokens: 100, completionTokens: 50 } };
    }
}

// ─────────────────────────────────────────────────────
// ResponseParser Tests
// ─────────────────────────────────────────────────────

describe('ResponseParser', () => {

    describe('extractJSON', () => {
        test('should parse raw JSON', () => {
            const result = ResponseParser.extractJSON('{"key": "value"}');
            expect(result.key).toBe('value');
        });

        test('should extract JSON from markdown code fences', () => {
            const raw = 'Here is the response:\n```json\n{"key": "value"}\n```\nDone.';
            const result = ResponseParser.extractJSON(raw);
            expect(result.key).toBe('value');
        });

        test('should extract JSON from plain code fences', () => {
            const raw = '```\n{"key": "value"}\n```';
            const result = ResponseParser.extractJSON(raw);
            expect(result.key).toBe('value');
        });

        test('should extract JSON from surrounding text', () => {
            const raw = 'The answer is: {"key": "value"} and that is it.';
            const result = ResponseParser.extractJSON(raw);
            expect(result.key).toBe('value');
        });

        test('should throw on invalid JSON', () => {
            expect(() => ResponseParser.extractJSON('not json at all'))
                .toThrow('Failed to extract valid JSON');
        });

        test('should handle nested JSON objects', () => {
            const raw = '{"outer": {"inner": "value"}, "arr": [1, 2, 3]}';
            const result = ResponseParser.extractJSON(raw);
            expect(result.outer.inner).toBe('value');
            expect(result.arr).toEqual([1, 2, 3]);
        });

        test('should handle whitespace-padded JSON', () => {
            const raw = '   \n  {"key": "value"}  \n   ';
            const result = ResponseParser.extractJSON(raw);
            expect(result.key).toBe('value');
        });
    });
});

// ─────────────────────────────────────────────────────
// LLMConfig Tests
// ─────────────────────────────────────────────────────

describe('resolveConfig', () => {

    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('should use defaults when no config provided', () => {
        const config = resolveConfig();
        expect(config.provider).toBe('openai');
        expect(config.model).toBe('gpt-4o');
        expect(config.temperature).toBe(0.0);
        expect(config.maxTokens).toBe(4096);
        expect(config.retries).toBe(1);
        expect(config.timeout).toBe(30000);
    });

    test('should override defaults with programmatic config', () => {
        const config = resolveConfig({
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
            apiKey: 'test-key',
        });
        expect(config.provider).toBe('anthropic');
        expect(config.model).toBe('claude-sonnet-4-20250514');
        expect(config.apiKey).toBe('test-key');
        expect(config.temperature).toBe(0.0); // from defaults
    });

    test('should read from environment variables', () => {
        process.env.ACCORD_LLM_PROVIDER = 'ollama';
        process.env.ACCORD_LLM_MODEL = 'llama3';
        process.env.ACCORD_LLM_API_KEY = 'env-key';
        process.env.ACCORD_LLM_BASE_URL = 'http://localhost:11434/v1';

        const config = resolveConfig();
        expect(config.provider).toBe('ollama');
        expect(config.model).toBe('llama3');
        expect(config.apiKey).toBe('env-key');
        expect(config.baseUrl).toBe('http://localhost:11434/v1');
    });

    test('programmatic config should override env vars', () => {
        process.env.ACCORD_LLM_PROVIDER = 'ollama';
        process.env.ACCORD_LLM_MODEL = 'llama3';

        const config = resolveConfig({
            provider: 'openai',
            model: 'gpt-4o-mini',
        });
        expect(config.provider).toBe('openai');
        expect(config.model).toBe('gpt-4o-mini');
    });
});

// ─────────────────────────────────────────────────────
// LLMProvider Factory Tests
// ─────────────────────────────────────────────────────

describe('createLLMProvider', () => {

    test('should create OpenAI provider for "openai"', () => {
        const provider = createLLMProvider({ provider: 'openai', model: 'gpt-4o' });
        expect(provider).toBeDefined();
    });

    test('should create OpenAI provider for "ollama"', () => {
        const provider = createLLMProvider({ provider: 'ollama', model: 'llama3' });
        expect(provider).toBeDefined();
    });

    test('should create OpenAI provider for "custom"', () => {
        const provider = createLLMProvider({ provider: 'custom', model: 'my-model' });
        expect(provider).toBeDefined();
    });

    test('should create Anthropic provider for "anthropic"', () => {
        const provider = createLLMProvider({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
        expect(provider).toBeDefined();
    });

    test('should throw for unsupported provider', () => {
        expect(() => createLLMProvider({ provider: 'unsupported', model: 'x' }))
            .toThrow('Unsupported LLM provider');
    });
});

// ─────────────────────────────────────────────────────
// PromptBuilder Tests
// Uses the existing typescript template archive (the PromptBuilder
// only reads contract text and model — it doesn't care about runtime)
// ─────────────────────────────────────────────────────

describe('PromptBuilder', () => {

    let template: Template;
    let promptBuilder: PromptBuilder;

    beforeAll(async () => {
        // Use the existing typescript template — PromptBuilder only reads text and model
        template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
        promptBuilder = new PromptBuilder(template);
    });

    test('should build trigger prompt with all sections', () => {
        const data = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            "forceMajeure": true,
            "penaltyPercentage": 10.5,
            "capPercentage": 55,
            "$identifier": "test-id"
        };
        const request = { goodsValue: 100 };
        const state = { "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState", "$identifier": "test-id", count: 0 };

        const messages = promptBuilder.buildTriggerPrompt(data, request, state);

        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');

        // System prompt should contain key instructions
        expect(messages[0].content).toContain('contract logic engine');
        expect(messages[0].content).toContain('$class');
        expect(messages[0].content).toContain('$timestamp');

        // User prompt should contain all sections
        const userContent = messages[1].content;
        expect(userContent).toContain('CONTRACT TEXT');
        expect(userContent).toContain('DATA MODEL');
        expect(userContent).toContain('CONTRACT DATA');
        expect(userContent).toContain('CURRENT STATE');
        expect(userContent).toContain('REQUEST');
        expect(userContent).toContain('penaltyPercentage');
        expect(userContent).toContain('goodsValue');
    });

    test('should build init prompt with contract data', () => {
        const data = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            "forceMajeure": true,
            "$identifier": "test-id"
        };

        const messages = promptBuilder.buildInitPrompt(data);

        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');

        expect(messages[0].content).toContain('initial state');
        expect(messages[1].content).toContain('CONTRACT TEXT');
        expect(messages[1].content).toContain('CONTRACT DATA');
        expect(messages[1].content).not.toContain('REQUEST');
    });

    test('should support custom system prompt override', () => {
        const customPrompt = 'You are a custom contract engine.';
        const data = { "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel", "$identifier": "x" };

        const messages = promptBuilder.buildTriggerPrompt(data, {}, {}, undefined, customPrompt);
        expect(messages[0].content).toBe(customPrompt);
    });

    test('should include current time when provided', () => {
        const data = { "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel", "$identifier": "x" };
        const messages = promptBuilder.buildTriggerPrompt(data, {}, {}, '2024-01-15T00:00:00Z');
        expect(messages[1].content).toContain('2024-01-15T00:00:00Z');
        expect(messages[1].content).toContain('CURRENT TIME');
    });
});

// ─────────────────────────────────────────────────────
// LLMLogicExecutor Tests (with mocked provider)
// Uses the existing typescript template for model validation
// ─────────────────────────────────────────────────────

describe('LLMLogicExecutor', () => {

    let template: Template;

    beforeAll(async () => {
        // Use the existing typescript template — our executor only needs the model
        // for Concerto validation. The runtime value doesn't matter since we inject
        // the mock provider directly.
        template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
    });

    test('should execute trigger with valid LLM response', async () => {
        const validResponse = JSON.stringify({
            result: {
                "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse",
                "$timestamp": new Date().toISOString(),
                penalty: 2625,
                buyerMayTerminate: true
            },
            state: {
                "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState",
                "$identifier": "test-id",
                count: 1
            },
            events: [{
                "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyEvent",
                "$timestamp": new Date().toISOString(),
                penaltyCalculated: true
            }]
        });

        const mockProvider = new MockLLMProvider([validResponse]);

        const executor = new LLMLogicExecutor(template, { provider: 'openai', model: 'gpt-4o' });
        // Inject mock provider
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (executor as any).provider = mockProvider;

        const data = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            "forceMajeure": true,
            "penaltyDuration": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 2, "unit": "days" },
            "penaltyPercentage": 10.5,
            "capPercentage": 55,
            "termination": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 15, "unit": "days" },
            "fractionalPart": "days",
            "clauseId": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
            "$identifier": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8"
        };
        const request = { goodsValue: 100 };
        const state = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState",
            "$identifier": "test-id",
            count: 0
        };

        const response = await executor.trigger(data, request, state);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response.result as any).penalty).toBe(2625);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response.state as any).count).toBe(1);
        expect(response.events).toHaveLength(1);
    });

    test('should execute init with valid LLM response', async () => {
        const validResponse = JSON.stringify({
            state: {
                "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState",
                "$identifier": "test-id",
                count: 0
            }
        });

        const mockProvider = new MockLLMProvider([validResponse]);

        const executor = new LLMLogicExecutor(template, { provider: 'openai', model: 'gpt-4o' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (executor as any).provider = mockProvider;

        const data = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            "forceMajeure": true,
            "penaltyDuration": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 2, "unit": "days" },
            "penaltyPercentage": 10.5,
            "capPercentage": 55,
            "termination": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 15, "unit": "days" },
            "fractionalPart": "days",
            "clauseId": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
            "$identifier": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8"
        };

        const response = await executor.init(data);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response.state as any).count).toBe(0);
    });

    test('should retry on invalid LLM response then succeed', async () => {
        const invalidResponse = '{"result": "not valid"}';  // Missing required fields
        const validResponse = JSON.stringify({
            result: {
                "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse",
                "$timestamp": new Date().toISOString(),
                penalty: 100,
                buyerMayTerminate: false
            },
            state: {
                "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState",
                "$identifier": "test-id",
                count: 1
            },
            events: []
        });

        const mockProvider = new MockLLMProvider([invalidResponse, validResponse]);

        const executor = new LLMLogicExecutor(template, { provider: 'openai', model: 'gpt-4o', retries: 1 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (executor as any).provider = mockProvider;

        const data = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            "forceMajeure": true,
            "penaltyDuration": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 2, "unit": "days" },
            "penaltyPercentage": 10.5,
            "capPercentage": 55,
            "termination": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 15, "unit": "days" },
            "fractionalPart": "days",
            "clauseId": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
            "$identifier": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8"
        };

        const response = await executor.trigger(data, {}, {});

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response.result as any).penalty).toBe(100);

        // Verify the mock was called twice (original + retry)
        expect(mockProvider.capturedMessages).toHaveLength(2);

        // Verify the second call includes error feedback
        const retryMessages = mockProvider.capturedMessages[1];
        expect(retryMessages.some(m => m.content.includes('validation errors'))).toBe(true);
    });

    test('should fail after exhausting retries', async () => {
        const invalidResponse = 'completely invalid nonsense';

        const mockProvider = new MockLLMProvider([invalidResponse, invalidResponse]);

        const executor = new LLMLogicExecutor(template, { provider: 'openai', model: 'gpt-4o', retries: 1 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (executor as any).provider = mockProvider;

        const data = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            "forceMajeure": true,
            "penaltyDuration": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 2, "unit": "days" },
            "penaltyPercentage": 10.5,
            "capPercentage": 55,
            "termination": { "$class": "org.accordproject.time@0.3.0.Duration", "amount": 15, "unit": "days" },
            "fractionalPart": "days",
            "clauseId": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
            "$identifier": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8"
        };

        await expect(executor.trigger(data, {}, {})).rejects.toThrow('LLM trigger failed after 2 attempt(s)');
    });
});
