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

/**
 * Configuration for the LLM-based logic executor.
 */
export interface LLMConfig {
    /** LLM provider: 'openai' | 'anthropic' | 'ollama' | 'custom' */
    provider: string;

    /** Model identifier, e.g. 'gpt-4o', 'claude-sonnet-4-20250514', 'llama3' */
    model: string;

    /** API key — resolved from: config > env var > error */
    apiKey?: string;

    /** API base URL — for custom/ollama endpoints */
    baseUrl?: string;

    /** Temperature for LLM reasoning (default: 0.0 for determinism) */
    temperature?: number;

    /** Max tokens for the response */
    maxTokens?: number;

    /** Retry count on validation failures (default: 1) */
    retries?: number;

    /** Timeout per request in ms (default: 30000) */
    timeout?: number;

    /** Optional system prompt override */
    systemPrompt?: string;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Partial<LLMConfig> = {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.0,
    maxTokens: 4096,
    retries: 1,
    timeout: 30000,
};

/**
 * Resolves LLM configuration by merging (in priority order):
 * 1. Programmatic config (passed directly)
 * 2. Template package.json `accordproject.llm` section
 * 3. Environment variables
 * 4. Defaults
 *
 * @param {Partial<LLMConfig>} programmaticConfig - config passed directly by the caller
 * @param {Template} template - the Accord Project template (for reading package.json)
 * @returns {LLMConfig} fully resolved configuration
 */
export function resolveConfig(programmaticConfig?: Partial<LLMConfig>, template?: Template): LLMConfig {
    // Extract LLM config from template package.json if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let templateConfig: Partial<LLMConfig> = {};
    if (template) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const metadata = template.getMetadata() as any;
            const packageJson = metadata.getPackageJson ? metadata.getPackageJson() : undefined;
            if (packageJson?.accordproject?.llm) {
                templateConfig = packageJson.accordproject.llm;
            }
        } catch {
            // Template may not have LLM config in package.json — that's fine
        }
    }

    // Environment variable config
    const envConfig: Partial<LLMConfig> = {};
    if (process.env.ACCORD_LLM_PROVIDER) {
        envConfig.provider = process.env.ACCORD_LLM_PROVIDER;
    }
    if (process.env.ACCORD_LLM_MODEL) {
        envConfig.model = process.env.ACCORD_LLM_MODEL;
    }
    if (process.env.ACCORD_LLM_API_KEY) {
        envConfig.apiKey = process.env.ACCORD_LLM_API_KEY;
    }
    if (process.env.ACCORD_LLM_BASE_URL) {
        envConfig.baseUrl = process.env.ACCORD_LLM_BASE_URL;
    }

    // Merge in priority order: programmatic > template > env > defaults
    const merged: LLMConfig = {
        ...DEFAULT_CONFIG,
        ...envConfig,
        ...templateConfig,
        ...programmaticConfig,
    } as LLMConfig;

    return merged;
}
