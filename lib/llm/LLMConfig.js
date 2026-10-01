"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_CAPABILITIES = exports.ANTHROPIC_EFFORT_LEVELS = exports.OPENAI_EFFORT_LEVELS = exports.GROQ_EFFORT_LEVELS = void 0;
exports.getProviderCapabilities = getProviderCapabilities;
exports.isLLMConfigured = isLLMConfigured;
/** Effort levels the Groq API accepts. */
exports.GROQ_EFFORT_LEVELS = ['none', 'low', 'medium', 'high'];
/**
 * Effort levels the OpenAI Chat Completions API accepts. Only reasoning models
 * take the parameter at all — a non-reasoning model (e.g. `gpt-4o`) rejects it.
 */
exports.OPENAI_EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high'];
/**
 * Effort levels the Anthropic Messages API accepts (GA, no beta header).
 * Supported on Opus 4.5+ and Sonnet 5; `xhigh` arrived with Opus 4.7, and
 * Sonnet 4.5 / Haiku 4.5 reject the parameter entirely.
 */
exports.ANTHROPIC_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
/**
 * Capability matrix, keyed by provider id. Kept next to the reasoners it
 * describes so a change to what a reasoner reads off its config can't drift
 * from what this table promises.
 */
exports.PROVIDER_CAPABILITIES = {
    groq: {
        effort: exports.GROQ_EFFORT_LEVELS,
        temperature: true,
        thinking: false,
        structuredOutput: true,
    },
    openai: {
        effort: exports.OPENAI_EFFORT_LEVELS,
        temperature: false,
        thinking: false,
        structuredOutput: true,
    },
    anthropic: {
        effort: exports.ANTHROPIC_EFFORT_LEVELS,
        temperature: false,
        thinking: true,
        structuredOutput: true,
    },
    google: { effort: null, temperature: false, thinking: false, structuredOutput: true },
    mistral: { effort: null, temperature: false, thinking: false, structuredOutput: true },
    openrouter: { effort: null, temperature: false, thinking: false, structuredOutput: true },
    // Local models vary wildly in how well they honour a schema, so the executor
    // falls back to describing the Concerto types in the prompt for these two.
    ollama: { effort: null, temperature: false, thinking: false, structuredOutput: false },
    'openai-compatible': { effort: null, temperature: false, thinking: false, structuredOutput: false },
};
/**
 * Reads the capabilities of a provider, defaulting to "no tuning knobs" for
 * an id this table doesn't recognise.
 * @param provider - a provider id, e.g. from a saved or in-progress config
 * @returns the provider's capabilities
 */
function getProviderCapabilities(provider) {
    return (exports.PROVIDER_CAPABILITIES[provider] ?? {
        effort: null,
        temperature: false,
        thinking: false,
        structuredOutput: false,
    });
}
/**
 * Whether a provider configuration — complete, or still being filled in on a
 * settings form — has everything its reasoner needs to run: a provider, a
 * model, and (for the providers that require one) an API key or custom
 * endpoint. Takes a loosely-typed draft rather than {@link LLMProviderConfig}
 * itself, since a form in progress won't yet satisfy that union.
 * @param config - the draft configuration to check
 * @returns true once a provider, model and (where required) credentials are set
 */
function isLLMConfigured(config) {
    if (!config?.provider || !config.model)
        return false;
    if (config.provider === 'openai-compatible' && !config.customEndpoint)
        return false;
    // Ollama runs locally and takes no key.
    if (config.provider !== 'ollama' && !config.apiKey)
        return false;
    return true;
}
//# sourceMappingURL=LLMConfig.js.map