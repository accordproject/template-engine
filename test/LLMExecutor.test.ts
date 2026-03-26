import { LLMExecutor, LLMExecutorError } from '../src/LLMExecutor';

describe('LLMExecutor', () => {
    test('trigger throws typed error before implementation', async () => {
        const executor = new LLMExecutor();
        await expect(executor.trigger()).rejects.toBeInstanceOf(LLMExecutorError);
    });

    test('init throws typed error before implementation', async () => {
        const executor = new LLMExecutor();
        await expect(executor.init()).rejects.toBeInstanceOf(LLMExecutorError);
    });
});