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
import { LLMMessage } from './LLMProvider';

const TRIGGER_SYSTEM_PROMPT = `You are a contract logic engine for the Accord Project. Your role is to evaluate contract clauses and produce deterministic, legally-sound outputs based on the contract text and data model.

Given:
1. CONTRACT TEXT — the natural language of the contract clause/template
2. DATA MODEL — the Concerto schema defining all types (template data, request, response, state, events)
3. CONTRACT DATA — the current values of the contract parameters
4. CURRENT STATE — the current state of the contract (may be null for first execution)
5. REQUEST — the incoming transaction/event to process

You must produce a JSON response with EXACTLY this structure:
{
  "result": { <response object matching a Response type from the data model> },
  "state": { <new state object matching a State concept, or current state if unchanged> },
  "events": [ <array of event objects matching Event types, or empty array> ]
}

RULES:
- Every JSON object MUST include a "$class" field with the fully qualified Concerto type name (namespace@version.TypeName)
- Response objects MUST include a "$timestamp" field with an ISO 8601 date string
- Event objects MUST include a "$timestamp" field with an ISO 8601 date string
- State objects MUST include a "$identifier" field (use the contract's $identifier)
- All field values must strictly conform to their declared types in the data model
- Apply the contract terms literally and precisely — do not invent terms not in the contract
- If the contract specifies a calculation, perform it accurately
- If the contract specifies conditions, evaluate them against the request data
- Output ONLY valid JSON — no markdown fences, no explanation, no commentary`;

const INIT_SYSTEM_PROMPT = `You are a contract logic engine for the Accord Project. Your role is to determine the initial state of a contract based on its text and data model.

Given:
1. CONTRACT TEXT — the natural language of the contract clause/template
2. DATA MODEL — the Concerto schema defining all types
3. CONTRACT DATA — the contract parameters

You must produce the INITIAL STATE for this contract as a JSON response with this structure:
{
  "state": { <initial state object matching a State concept from the data model> }
}

RULES:
- The state object MUST include a "$class" field with the fully qualified Concerto type name
- The state object MUST include a "$identifier" field (use the contract data's $identifier)
- Initialize all state fields to their logical starting values (e.g., counters to 0, flags to false)
- Only include fields that are defined in the State concept from the data model
- Output ONLY valid JSON — no markdown fences, no explanation, no commentary`;

/**
 * Builds structured prompts for LLM-based contract logic execution.
 * Extracts contract text, data model, and constructs system + user messages.
 */
export class PromptBuilder {
    private template: Template;

    constructor(template: Template) {
        this.template = template;
    }

    /**
     * Get the contract text from the template.
     */
    private getContractText(): string {
        try {
            return this.template.getTemplate();
        } catch {
            return '(Contract text not available)';
        }
    }

    /**
     * Get the Concerto model definitions as a single string.
     */
    private getModelText(): string {
        const modelManager = this.template.getModelManager();
        const modelFiles = modelManager.getModels();
        return modelFiles
            .map((mf: any) => {
                const content = mf.content || mf.definitions || '';
                const name = mf.name || mf.namespace || 'model';
                return `// --- ${name} ---\n${content}`;
            })
            .join('\n\n');
    }

    /**
     * Build the user prompt content for a trigger operation.
     */
    private buildTriggerUserContent(data: any, request: any, state: any, currentTime?: string): string {
        let content = '';

        content += '## CONTRACT TEXT\n';
        content += this.getContractText();
        content += '\n\n';

        content += '## DATA MODEL (Concerto)\n';
        content += this.getModelText();
        content += '\n\n';

        content += '## CONTRACT DATA\n';
        content += JSON.stringify(data, null, 2);
        content += '\n\n';

        content += '## CURRENT STATE\n';
        content += state ? JSON.stringify(state, null, 2) : 'null (no state initialized yet)';
        content += '\n\n';

        content += '## REQUEST\n';
        content += JSON.stringify(request, null, 2);
        content += '\n\n';

        if (currentTime) {
            content += `## CURRENT TIME\n${currentTime}\n\n`;
        }

        content += 'Evaluate the contract logic based on the contract text and produce the JSON response with result, state, and events.';

        return content;
    }

    /**
     * Build the user prompt content for an init operation.
     */
    private buildInitUserContent(data: any, currentTime?: string): string {
        let content = '';

        content += '## CONTRACT TEXT\n';
        content += this.getContractText();
        content += '\n\n';

        content += '## DATA MODEL (Concerto)\n';
        content += this.getModelText();
        content += '\n\n';

        content += '## CONTRACT DATA\n';
        content += JSON.stringify(data, null, 2);
        content += '\n\n';

        if (currentTime) {
            content += `## CURRENT TIME\n${currentTime}\n\n`;
        }

        content += 'Determine the initial state for this contract and produce the JSON response with the state object.';

        return content;
    }

    /**
     * Build the full message array for a trigger operation.
     * @param {any} data - contract data
     * @param {any} request - incoming request
     * @param {any} state - current contract state
     * @param {string} [currentTime] - current time override
     * @param {string} [systemPromptOverride] - optional custom system prompt
     * @returns {LLMMessage[]} array of messages for the LLM
     */
    buildTriggerPrompt(data: any, request: any, state: any, currentTime?: string, systemPromptOverride?: string): LLMMessage[] {
        return [
            {
                role: 'system',
                content: systemPromptOverride || TRIGGER_SYSTEM_PROMPT,
            },
            {
                role: 'user',
                content: this.buildTriggerUserContent(data, request, state, currentTime),
            },
        ];
    }

    /**
     * Build the full message array for an init operation.
     * @param {any} data - contract data
     * @param {string} [currentTime] - current time override
     * @param {string} [systemPromptOverride] - optional custom system prompt
     * @returns {LLMMessage[]} array of messages for the LLM
     */
    buildInitPrompt(data: any, currentTime?: string, systemPromptOverride?: string): LLMMessage[] {
        return [
            {
                role: 'system',
                content: systemPromptOverride || INIT_SYSTEM_PROMPT,
            },
            {
                role: 'user',
                content: this.buildInitUserContent(data, currentTime),
            },
        ];
    }
}
