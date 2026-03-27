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

import { LLMConfig } from '../LLMConfig';
import { LLMMessage, LLMProvider, LLMProviderResponse } from '../LLMProvider';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

/**
 * LLM provider for Anthropic Claude models.
 *
 * Uses native fetch() — requires Node >= 18.
 */
export class AnthropicProvider implements LLMProvider {

    /**
     * Send a message request to the Anthropic Messages API.
     * @param {LLMMessage[]} messages - the conversation messages
     * @param {LLMConfig} config - the LLM configuration
     * @returns {Promise<LLMProviderResponse>} the LLM response
     */
    async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMProviderResponse> {
        const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
        const url = `${baseUrl}/v1/messages`;

        if (!config.apiKey) {
            throw new Error('Anthropic provider requires an API key. Set it via config.apiKey or ACCORD_LLM_API_KEY environment variable.');
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': ANTHROPIC_API_VERSION,
        };

        // Anthropic separates system messages from the conversation
        const systemMessages = messages.filter(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        const body: any = {
            model: config.model,
            max_tokens: config.maxTokens ?? 4096,
            temperature: config.temperature ?? 0.0,
            messages: conversationMessages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        };

        // Add system prompt if present
        if (systemMessages.length > 0) {
            body.system = systemMessages.map(m => m.content).join('\n\n');
        }

        const controller = new AbortController();
        const timeout = config.timeout ?? 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
            }

            const data = await response.json() as any;

            if (!data.content || data.content.length === 0) {
                throw new Error('Anthropic API returned no content.');
            }

            // Anthropic returns content as an array of content blocks
            const textBlocks = data.content.filter((block: any) => block.type === 'text');
            const content = textBlocks.map((block: any) => block.text).join('');

            const usage = data.usage ? {
                promptTokens: data.usage.input_tokens || 0,
                completionTokens: data.usage.output_tokens || 0,
            } : undefined;

            return { content, usage };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
