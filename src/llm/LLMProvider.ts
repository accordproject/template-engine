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

import { LLMConfig } from './LLMConfig';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';

/**
 * A message in the LLM conversation.
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Response from an LLM provider.
 */
export interface LLMProviderResponse {
    /** The raw text content from the LLM */
    content: string;
    /** Optional token usage information */
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}

/**
 * Interface for LLM providers. Implementations must handle
 * API communication for a specific LLM service.
 */
export interface LLMProvider {
    /**
     * Send a conversation to the LLM and receive a text response.
     * @param {LLMMessage[]} messages - the conversation messages
     * @param {LLMConfig} config - the LLM configuration
     * @returns {Promise<LLMProviderResponse>} the LLM response
     */
    chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMProviderResponse>;
}

/**
 * Factory function to create an LLM provider based on configuration.
 * @param {LLMConfig} config - the LLM configuration
 * @returns {LLMProvider} an LLM provider instance
 * @throws {Error} if the provider is not supported
 */
export function createLLMProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
    case 'openai':
    case 'ollama':
    case 'custom':
        return new OpenAIProvider();
    case 'anthropic':
        return new AnthropicProvider();
    default:
        throw new Error(`Unsupported LLM provider: '${config.provider}'. Supported: openai, anthropic, ollama, custom.`);
    }
}
