import { LLMExecutor, LLMExecutorError } from '../src/LLMExecutor';

describe('LLMExecutor', () => {
    test('trigger throws typed provider error before implementation', async () => {
        const executor = new LLMExecutor();
        await expect(executor.trigger()).rejects.toBeInstanceOf(LLMExecutorError);
    });

    test('init throws typed provider error before implementation', async () => {
        const executor = new LLMExecutor();
        await expect(executor.init()).rejects.toBeInstanceOf(LLMExecutorError);
    });

    test('parseModelJson parses valid JSON', () => {
        const executor = new LLMExecutor();
        expect(executor.parseModelJson('{"state":{"ok":true}}')).toEqual({ state: { ok: true } });
    });

    test('parseModelJson throws INVALID_JSON on invalid JSON', () => {
        const executor = new LLMExecutor();
        expect(() => executor.parseModelJson('{bad json}')).toThrow(LLMExecutorError);
    });

    test('assertTriggerShape accepts valid output', () => {
        const executor = new LLMExecutor();
        const output = executor.assertTriggerShape({
            response: { accepted: true },
            state: { counter: 1 },
            emit: [{ type: 'Event' }]
        });
        expect(output.state).toEqual({ counter: 1 });
    });

    test('assertTriggerShape rejects invalid emit', () => {
        const executor = new LLMExecutor();
        expect(() => executor.assertTriggerShape({
            response: {},
            state: {},
            emit: ['bad']
        })).toThrow(LLMExecutorError);
    });

    test('assertInitShape accepts valid output', () => {
        const executor = new LLMExecutor();
        expect(executor.assertInitShape({ state: { started: true } })).toEqual({
            state: { started: true }
        });
    });
});