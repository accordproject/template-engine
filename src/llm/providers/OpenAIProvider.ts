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

/**
 * Default base URLs per provider type.
 */
const DEFAULT_BASE_URLS: Record<string, string> = {
    'openai': 'https://api.openai.com/v1',
    'ollama': 'http://localhost:11434/v1',
    'custom': 'http://localhost:8080/v1',
};

/**
 * LLM provider for OpenAI and any OpenAI-compatible API
 * (Azure OpenAI, Ollama, LM Studio, vLLM, etc.).
 *
 * Uses native fetch() — requires Node >= 18.
 */
export class OpenAIProvider implements LLMProvider {

    /**
     * Send a chat completion request to an OpenAI-compatible API.
     * @param {LLMMessage[]} messages - the conversation messages
     * @param {LLMConfig} config - the LLM configuration
     * @returns {Promise<LLMProviderResponse>} the LLM response
     */
    async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMProviderResponse> {
        const baseUrl = config.baseUrl || DEFAULT_BASE_URLS[config.provider] || DEFAULT_BASE_URLS['openai'];
        const url = `${baseUrl}/chat/completions`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // API key is optional for local providers like Ollama
        if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const body: any = {
            model: config.model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature: config.temperature ?? 0.0,
            max_tokens: config.maxTokens ?? 4096,
        };

        // Request JSON output format if supported
        body.response_format = { type: 'json_object' };

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
                throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
            }

            const data = await response.json() as any;

            if (!data.choices || data.choices.length === 0) {
                throw new Error('OpenAI API returned no choices.');
            }

            const content = data.choices[0].message?.content || '';
            const usage = data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
            } : undefined;

            return { content, usage };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
