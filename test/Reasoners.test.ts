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

import { Template } from '@accordproject/cicero-core';
import {
    AnthropicReasoner,
    MistralReasoner,
    OpenAIReasoner,
    SdkLoader,
    createReasoner,
} from '../src/llm';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';

// Simulate a missing optional peer: requiring the package throws, as it would
// if the consumer had not installed it.
jest.mock('@mistralai/mistralai', () => {
    throw new Error("Cannot find module '@mistralai/mistralai'");
});

const MESSAGES = [{ role: 'user' as const, content: 'hello' }];

/**
 * Builds a stand-in for the `openai` module whose client answers every chat
 * completion with `content`.
 * @param content - assistant content to return
 * @returns the fake module and the spy recording client construction
 */
function fakeOpenAIModule(content: string) {
    const constructed = jest.fn();
    class FakeOpenAI {
        chat = {
            completions: {
                create: async () => ({ choices: [{ message: { content } }] }),
            },
        };
        constructor(options: unknown) {
            constructed(options);
        }
    }
    return { module: { default: FakeOpenAI }, constructed };
}

describe('reasoner SDK loading', () => {
    test('uses an injected loader instead of importing the SDK', async () => {
        const { module, constructed } = fakeOpenAIModule('from injected loader');
        const loader = jest.fn<ReturnType<SdkLoader>, []>(async () => module);
        const reasoner = createReasoner(
            { provider: 'openai', apiKey: 'test-key', model: 'test-model' },
            { sdkLoaders: { openai: loader } }
        );

        await expect(reasoner.complete(MESSAGES)).resolves.toEqual({ content: 'from injected loader' });
        await reasoner.complete(MESSAGES);

        // The client is created once and reused.
        expect(loader).toHaveBeenCalledTimes(1);
        expect(constructed).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'test-key' }));
    });

    test.each([
        ['ollama', { provider: 'ollama' as const, model: 'llama3' }],
        ['openai-compatible', { provider: 'openai-compatible' as const, apiKey: 'k', model: 'm', customEndpoint: 'http://localhost:1234/v1' }],
    ])('%s falls back to the openai loader', async (_name, config) => {
        const { module, constructed } = fakeOpenAIModule('compatible');
        const reasoner = createReasoner(config, { sdkLoaders: { openai: async () => module } });

        await expect(reasoner.complete(MESSAGES)).resolves.toEqual({ content: 'compatible' });
        expect(constructed).toHaveBeenCalledTimes(1);
    });

    test('prefers a provider-specific loader over the openai loader', async () => {
        const ollama = fakeOpenAIModule('ollama');
        const openai = jest.fn<ReturnType<SdkLoader>, []>();
        const reasoner = createReasoner(
            { provider: 'ollama', model: 'llama3' },
            { sdkLoaders: { ollama: async () => ollama.module, openai } }
        );

        await expect(reasoner.complete(MESSAGES)).resolves.toEqual({ content: 'ollama' });
        expect(openai).not.toHaveBeenCalled();
    });

    test('ignores loaders registered for other providers', async () => {
        const anthropic = jest.fn<ReturnType<SdkLoader>, []>();
        const reasoner = createReasoner(
            { provider: 'mistral', apiKey: 'k', model: 'm' },
            { sdkLoaders: { anthropic } }
        );

        await expect(reasoner.complete(MESSAGES)).rejects.toThrow("The '@mistralai/mistralai' package is required");
        expect(anthropic).not.toHaveBeenCalled();
    });

    test('reports a rejecting injected loader', async () => {
        const reasoner = new AnthropicReasoner(
            { provider: 'anthropic', apiKey: 'k', model: 'm' },
            () => Promise.reject(new Error('chunk failed to load'))
        );

        await expect(reasoner.complete(MESSAGES)).rejects.toThrow(
            "The SDK loader supplied for the Anthropic provider failed to load '@anthropic-ai/sdk': chunk failed to load"
        );
    });

    test('loads the installed SDK by name when no loader is given', async () => {
        const fetch = jest.fn(async () => new Response(
            JSON.stringify({
                id: 'chatcmpl-1',
                object: 'chat.completion',
                created: 0,
                model: 'test-model',
                choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'from real sdk' } }],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
        ));
        const reasoner = new OpenAIReasoner({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'test-model',
            clientOptions: { fetch, maxRetries: 0 },
        });

        await expect(reasoner.complete(MESSAGES)).resolves.toEqual({ content: 'from real sdk' });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('keeps the install hint when the SDK is not installed', async () => {
        const reasoner = new MistralReasoner({ provider: 'mistral', apiKey: 'k', model: 'm' });

        await expect(reasoner.complete(MESSAGES)).rejects.toThrow(
            "The '@mistralai/mistralai' package is required to use the Mistral provider. Install it with: npm install @mistralai/mistralai"
        );
    });

    test('threads sdkLoaders from TemplateArchiveProcessor to the reasoner', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
        const loader = jest.fn<ReturnType<SdkLoader>, []>(() => Promise.reject(new Error('not available')));
        const processor = new TemplateArchiveProcessor(
            template,
            { mode: 'force', provider: { provider: 'openai', apiKey: 'k', model: 'm', retries: 0 } },
            { sdkLoaders: { openai: loader } }
        );
        const data = {
            '$class': 'io.clause.latedeliveryandpenalty@0.1.0.TemplateModel',
            'forceMajeure': true,
            'penaltyDuration': { '$class': 'org.accordproject.time@0.3.0.Duration', 'amount': 2, 'unit': 'days' },
            'penaltyPercentage': 10.5,
            'capPercentage': 55,
            'termination': { '$class': 'org.accordproject.time@0.3.0.Duration', 'amount': 15, 'unit': 'days' },
            'fractionalPart': 'days',
            'clauseId': 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8',
            '$identifier': 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8',
        };

        await expect(processor.init(data)).rejects.toThrow(
            "The SDK loader supplied for the OpenAI provider failed to load 'openai': not available"
        );
        expect(loader).toHaveBeenCalledTimes(1);
    });
});
