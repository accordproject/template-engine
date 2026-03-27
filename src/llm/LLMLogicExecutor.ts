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

import { Template } from '@accordproject/cicero-core';
import { LLMConfig, resolveConfig } from './LLMConfig';
import { LLMProvider, LLMMessage, createLLMProvider } from './LLMProvider';
import { PromptBuilder } from './PromptBuilder';
import { ResponseParser } from './ResponseParser';
import { TriggerResponse, InitResponse } from '../TemplateArchiveProcessor';

/**
 * LLM-based template logic executor.
 *
 * This executor reads the contract text, Concerto data model,
 * current state, and incoming request — then uses a reasoning LLM
 * to produce structured output (TriggerResponse / InitResponse)
 * matching the same contract as an explicit TypeScript logic file would.
 *
 * It validates all LLM output against the Concerto model and supports
 * automatic retry with error feedback.
 */
export class LLMLogicExecutor {
    private template: Template;
    private config: LLMConfig;
    private provider: LLMProvider;
    private promptBuilder: PromptBuilder;

    /**
     * Creates an LLM logic executor for a template.
     *
     * @param {Template} template - the Accord Project template
     * @param {Partial<LLMConfig>} [config] - optional LLM configuration overrides
     */
    constructor(template: Template, config?: Partial<LLMConfig>) {
        this.template = template;
        this.config = resolveConfig(config, template);
        this.provider = createLLMProvider(this.config);
        this.promptBuilder = new PromptBuilder(template);
    }

    /**
     * Trigger the logic of a template using an LLM.
     *
     * @param {any} data - the contract data (template model instance)
     * @param {any} request - the incoming request/transaction
     * @param {any} state - the current contract state
     * @param {string} [currentTime] - optional current time override
     * @returns {Promise<TriggerResponse>} the response, new state, and events
     * @throws {Error} if the LLM fails to produce valid output after retries
     */
    async trigger(data: any, request: any, state: any, currentTime?: string): Promise<TriggerResponse> {
        const messages: LLMMessage[] = this.promptBuilder.buildTriggerPrompt(
            data, request, state, currentTime, this.config.systemPrompt
        );
        const maxRetries = this.config.retries ?? 1;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await this.provider.chat(messages, this.config);

            try {
                return ResponseParser.parseTriggerResponse(
                    response.content,
                    this.template.getModelManager()
                );
            } catch (validationError: any) {
                if (attempt < maxRetries) {
                    // Feed the error back to the LLM for self-correction
                    messages.push({
                        role: 'assistant',
                        content: response.content,
                    });
                    messages.push({
                        role: 'user',
                        content: `Your previous response had validation errors:\n${validationError.message}\n\nPlease fix the JSON and try again. Output ONLY valid JSON.`,
                    });
                } else {
                    throw new Error(
                        `LLM trigger failed after ${maxRetries + 1} attempt(s): ${validationError.message}`
                    );
                }
            }
        }

        // Should not reach here, but TypeScript needs it
        throw new Error('LLM trigger failed: unexpected end of retry loop.');
    }

    /**
     * Initialize the state of a template using an LLM.
     *
     * @param {any} data - the contract data (template model instance)
     * @param {string} [currentTime] - optional current time override
     * @returns {Promise<InitResponse>} the initial state
     * @throws {Error} if the LLM fails to produce valid output after retries
     */
    async init(data: any, currentTime?: string): Promise<InitResponse> {
        const messages: LLMMessage[] = this.promptBuilder.buildInitPrompt(
            data, currentTime, this.config.systemPrompt
        );
        const maxRetries = this.config.retries ?? 1;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await this.provider.chat(messages, this.config);

            try {
                return ResponseParser.parseInitResponse(
                    response.content,
                    this.template.getModelManager()
                );
            } catch (validationError: any) {
                if (attempt < maxRetries) {
                    messages.push({
                        role: 'assistant',
                        content: response.content,
                    });
                    messages.push({
                        role: 'user',
                        content: `Your previous response had validation errors:\n${validationError.message}\n\nPlease fix the JSON and try again. Output ONLY valid JSON.`,
                    });
                } else {
                    throw new Error(
                        `LLM init failed after ${maxRetries + 1} attempt(s): ${validationError.message}`
                    );
                }
            }
        }

        throw new Error('LLM init failed: unexpected end of retry loop.');
    }
}
