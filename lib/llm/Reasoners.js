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
/* eslint-disable @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MistralReasoner = exports.GoogleReasoner = exports.OpenAICompatibleCustomReasoner = exports.OllamaReasoner = exports.OpenRouterReasoner = exports.OpenAICompatibleReasoner = exports.AnthropicReasoner = exports.OpenAIReasoner = exports.GroqReasoner = exports.BaseReasoner = void 0;
exports.createReasoner = createReasoner;
const LLMConfig_1 = require("./LLMConfig");
/**
 * Base interface for provider-specific reasoners.
 */
class BaseReasoner {
}
exports.BaseReasoner = BaseReasoner;
/**
 * Loads an optional dependency at runtime.
 * @param specifier - module specifier
 * @returns imported module
 */
function loadOptionalModule(specifier) {
    return Promise.resolve(`${specifier}`).then(s => __importStar(require(s)));
}
/**
 * Narrows a configured effort level to the ones a provider's API accepts,
 * throwing rather than silently falling back to the provider default.
 * @param effort - the configured effort level, if any
 * @param supported - the levels this provider accepts
 * @param providerLabel - provider name, used in the error message
 * @returns the effort level, or undefined when none was configured
 * @throws {Error} if the level is not one the provider supports
 */
function resolveEffort(effort, supported, providerLabel) {
    if (!effort)
        return undefined;
    if (!supported.includes(effort)) {
        throw new Error(`The ${providerLabel} provider does not support effort '${effort}'. ` +
            `Supported levels: ${supported.join(', ')}`);
    }
    return effort;
}
/**
 * Groq-backed reasoner.
 */
class GroqReasoner extends BaseReasoner {
    constructor(config) {
        super();
        const apiKey = config.apiKey ||
            (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : '') ||
            '';
        if (!apiKey)
            throw new Error('Missing apiKey for Groq provider');
        this.config = {
            apiKey,
            model: config.model,
            baseUrl: config.baseUrl ?? 'https://api.groq.com/openai/v1',
            temperature: config.temperature ?? 0,
            maxTokens: config.maxTokens ?? 4096,
            topP: config.topP ?? 1,
            effort: resolveEffort(config.effort, LLMConfig_1.GROQ_EFFORT_LEVELS, 'groq'),
            timeoutMs: config.timeoutMs ?? 60000,
            clientOptions: config.clientOptions ?? {},
        };
    }
    /**
     * Loads the Groq client on first use.
     */
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                let mod;
                try {
                    mod = await loadOptionalModule('groq-sdk');
                }
                catch {
                    throw new Error("The 'groq-sdk' package is required to use the Groq provider. Install it with: npm install groq-sdk");
                }
                const Groq = mod.default ?? mod.Groq;
                if (!Groq) {
                    throw new Error("Unable to load the Groq SDK constructor from 'groq-sdk'");
                }
                return new Groq({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseUrl,
                    ...this.config.clientOptions,
                });
            })();
        }
        return this.clientPromise;
    }
    async complete(messages, schema) {
        const options = {
            model: this.config.model,
            messages,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            top_p: this.config.topP,
        };
        if (this.config.effort) {
            options.reasoning_effort = this.config.effort;
        }
        if (schema) {
            options.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: 'structured_output',
                    strict: true,
                    schema,
                },
            };
        }
        const client = await this.getClient();
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Groq request timed out after ${this.config.timeoutMs}ms`)), this.config.timeoutMs);
        });
        try {
            const response = await Promise.race([
                client.chat.completions.create(options),
                timeoutPromise,
            ]);
            const content = response?.choices?.[0]?.message?.content;
            if (!content || typeof content !== 'string') {
                throw new Error('Groq API returned no assistant content');
            }
            return { content };
        }
        catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Groq API error: ${String(error)}`);
        }
        finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
}
exports.GroqReasoner = GroqReasoner;
/**
 * Formats messages for OpenAI-style chat APIs.
 * @param messages - chat messages to convert
 * @returns provider-ready messages
 */
function formatOpenAIMessages(messages) {
    const systemMessages = messages.filter(message => message.role === 'system');
    const conversationMessages = messages.filter(message => message.role !== 'system');
    return [
        ...(systemMessages.length > 0
            ? [
                {
                    role: 'system',
                    content: systemMessages.map(message => message.content).join('\n\n'),
                },
            ]
            : []),
        ...conversationMessages.map(message => ({
            role: message.role,
            content: message.content,
        })),
    ];
}
/**
 * Builds a structured-output payload for OpenAI-style providers.
 * @param schema - JSON Schema to attach
 * @param strict - whether the provider should enforce strict output
 * @returns response format payload
 */
function createOpenAIResponseFormat(schema, strict) {
    return {
        type: 'json_schema',
        json_schema: {
            name: 'structured_output',
            strict,
            schema,
        },
    };
}
/**
 * OpenAI-backed reasoner.
 */
class OpenAIReasoner extends BaseReasoner {
    constructor(config) {
        super();
        if (!config.apiKey)
            throw new Error('Missing apiKey for OpenAI provider');
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.maxTokens = config.maxTokens ?? 4096;
        this.effort = resolveEffort(config.effort, LLMConfig_1.OPENAI_EFFORT_LEVELS, 'openai');
        this.clientOptions = config.clientOptions ?? {};
    }
    /**
     * Loads the OpenAI client on first use.
     */
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                let mod;
                try {
                    mod = await loadOptionalModule('openai');
                }
                catch {
                    throw new Error("The 'openai' package is required to use the OpenAI provider. Install it with: npm install openai");
                }
                return new mod.default({
                    apiKey: this.apiKey,
                    baseURL: 'https://api.openai.com/v1',
                    ...this.clientOptions,
                });
            })();
        }
        return this.clientPromise;
    }
    async complete(messages, schema) {
        const options = {
            model: this.model,
            messages: formatOpenAIMessages(messages),
            max_completion_tokens: this.maxTokens,
            stream: false,
        };
        if (this.effort) {
            options.reasoning_effort = this.effort;
        }
        if (schema) {
            options.response_format = createOpenAIResponseFormat(schema, false);
        }
        const client = await this.getClient();
        const response = await client.chat.completions.create(options);
        const content = response.choices?.[0]?.message?.content;
        if (!content)
            throw new Error('OpenAIReasoner: no content in response');
        return { content };
    }
}
exports.OpenAIReasoner = OpenAIReasoner;
/**
 * Anthropic-backed reasoner.
 */
class AnthropicReasoner extends BaseReasoner {
    constructor(config) {
        super();
        if (!config.apiKey)
            throw new Error('Missing apiKey for Anthropic provider');
        this.apiKey = config.apiKey;
        this.model = config.model;
        // Thinking tokens share this budget with the answer, so leave room for both.
        this.maxTokens = config.maxTokens ?? 16000;
        this.effort = resolveEffort(config.effort, LLMConfig_1.ANTHROPIC_EFFORT_LEVELS, 'anthropic');
        this.thinking = config.thinking ?? true;
        this.clientOptions = config.clientOptions ?? {};
    }
    /**
     * Loads the Anthropic client on first use.
     */
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                let mod;
                try {
                    mod = await loadOptionalModule('@anthropic-ai/sdk');
                }
                catch {
                    throw new Error("The '@anthropic-ai/sdk' package is required to use the Anthropic provider. Install it with: npm install @anthropic-ai/sdk");
                }
                return new mod.default({
                    apiKey: this.apiKey,
                    ...this.clientOptions,
                });
            })();
        }
        return this.clientPromise;
    }
    async complete(messages, schema) {
        const systemContent = messages
            .filter(m => m.role === 'system')
            .map(m => m.content)
            .join('\n\n');
        const formattedMessages = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content }));
        const params = {
            model: this.model,
            max_tokens: this.maxTokens,
            ...(systemContent ? { system: systemContent } : {}),
            messages: formattedMessages,
        };
        // Extended thinking is opt-in; without it `effort` has nothing to deepen.
        if (this.thinking) {
            params.thinking = { type: 'adaptive' };
        }
        const outputConfig = {};
        if (schema) {
            outputConfig.format = {
                type: 'json_schema',
                schema,
            };
        }
        if (this.effort) {
            outputConfig.effort = this.effort;
        }
        if (Object.keys(outputConfig).length > 0) {
            params.output_config = outputConfig;
        }
        const client = await this.getClient();
        const response = await client.messages.create(params);
        if (response.stop_reason === 'refusal') {
            throw new Error('Anthropic refused to produce structured output for this request');
        }
        // An exhausted budget surfaces as truncated JSON; report it as such rather
        // than leaving the caller with a JSON.parse syntax error.
        if (response.stop_reason === 'max_tokens') {
            throw new Error(`Anthropic response hit the ${this.maxTokens}-token limit before completing. ` +
                'Raise maxTokens, lower effort, or set thinking: false.');
        }
        const block = response.content.find(b => b.type === 'text');
        if (!block || !block.text) {
            throw new Error('Anthropic: no text block in response');
        }
        return { content: block.text };
    }
}
exports.AnthropicReasoner = AnthropicReasoner;
/**
 * Base reasoner for providers that expose an OpenAI-compatible chat API.
 */
class OpenAICompatibleReasoner extends BaseReasoner {
    constructor(config, baseUrl, defaultApiKey = '') {
        super();
        const apiKey = config.apiKey || defaultApiKey;
        if (!apiKey)
            throw new Error('Missing apiKey for OpenAI-compatible provider');
        this.apiKey = apiKey;
        this.model = config.model;
        this.maxTokens = config.maxTokens ?? 4096;
        this.baseUrl = baseUrl;
        this.clientOptions = config.clientOptions ?? {};
    }
    /**
     * Loads the OpenAI-compatible client on first use.
     */
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                let mod;
                try {
                    mod = await loadOptionalModule('openai');
                }
                catch {
                    throw new Error("The 'openai' package is required to use this provider. Install it with: npm install openai");
                }
                return new mod.default({
                    apiKey: this.apiKey,
                    baseURL: this.baseUrl,
                    ...this.clientOptions,
                });
            })();
        }
        return this.clientPromise;
    }
    async complete(messages, schema) {
        const options = {
            model: this.model,
            messages: formatOpenAIMessages(messages),
            max_tokens: this.maxTokens,
            stream: false,
        };
        if (schema) {
            options.response_format = createOpenAIResponseFormat(schema, false);
        }
        const client = await this.getClient();
        const response = await client.chat.completions.create(options);
        const content = response.choices?.[0]?.message?.content;
        if (!content)
            throw new Error(`${this.constructor.name}: no content in response`);
        return { content };
    }
}
exports.OpenAICompatibleReasoner = OpenAICompatibleReasoner;
/**
 * OpenRouter-backed reasoner.
 */
class OpenRouterReasoner extends BaseReasoner {
    constructor(config) {
        super();
        if (!config.apiKey)
            throw new Error('Missing apiKey for OpenRouter provider');
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.maxTokens = config.maxTokens ?? 4096;
        this.clientOptions = config.clientOptions ?? {};
    }
    /**
     * Loads the OpenRouter client on first use.
     */
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                let mod;
                try {
                    mod = await loadOptionalModule('@openrouter/sdk');
                }
                catch {
                    throw new Error("The '@openrouter/sdk' package is required to use the OpenRouter provider. Install it with: npm install @openrouter/sdk");
                }
                return new mod.OpenRouter({
                    apiKey: this.apiKey,
                    ...this.clientOptions,
                });
            })();
        }
        return this.clientPromise;
    }
    async complete(messages, schema) {
        const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));
        const chatRequest = {
            model: this.model,
            messages: formattedMessages,
            maxTokens: this.maxTokens,
        };
        if (schema) {
            chatRequest.responseFormat = {
                type: 'json_schema',
                jsonSchema: {
                    name: 'structured_output',
                    strict: true,
                    schema,
                },
            };
        }
        const client = await this.getClient();
        const response = await client.chat.send({ chatRequest });
        const content = response.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
            throw new Error('OpenRouterReasoner: no content in response');
        }
        return { content };
    }
}
exports.OpenRouterReasoner = OpenRouterReasoner;
/**
 * Ollama-backed reasoner.
 */
class OllamaReasoner extends OpenAICompatibleReasoner {
    constructor(config) {
        super(config, config.baseUrl ?? 'http://localhost:11434/v1', 'ollama');
    }
}
exports.OllamaReasoner = OllamaReasoner;
/**
 * Reasoner for arbitrary OpenAI-compatible endpoints.
 */
class OpenAICompatibleCustomReasoner extends OpenAICompatibleReasoner {
    constructor(config) {
        if (!config.customEndpoint) {
            throw new Error('customEndpoint is required for the openai-compatible provider');
        }
        super(config, config.customEndpoint);
    }
}
exports.OpenAICompatibleCustomReasoner = OpenAICompatibleCustomReasoner;
/**
 * Google-backed reasoner.
 */
class GoogleReasoner extends BaseReasoner {
    constructor(config) {
        super();
        if (!config.apiKey)
            throw new Error('Missing apiKey for Google provider');
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.maxTokens = config.maxTokens ?? 4096;
        this.clientOptions = config.clientOptions ?? {};
    }
    /**
     * Loads the Google client on first use.
     */
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                let mod;
                try {
                    mod = await loadOptionalModule('@google/genai');
                }
                catch {
                    throw new Error("The '@google/genai' package is required to use the Google provider. Install it with: npm install @google/genai");
                }
                return new mod.GoogleGenAI({
                    apiKey: this.apiKey,
                    ...this.clientOptions,
                });
            })();
        }
        return this.clientPromise;
    }
    async complete(messages, schema) {
        const systemInstruction = messages
            .filter(m => m.role === 'system')
            .map(m => m.content)
            .join('\n\n');
        const contents = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        const generationConfig = {
            maxOutputTokens: this.maxTokens,
        };
        if (systemInstruction) {
            generationConfig.systemInstruction = systemInstruction;
        }
        if (schema) {
            generationConfig.responseMimeType = 'application/json';
            generationConfig.responseJsonSchema = schema;
        }
        const client = await this.getClient();
        const response = await client.models.generateContent({
            model: this.model,
            contents,
            config: generationConfig,
        });
        const content = response.text;
        if (!content)
            throw new Error('GoogleReasoner: no content in response');
        return { content };
    }
}
exports.GoogleReasoner = GoogleReasoner;
/**
 * Mistral-backed reasoner.
 */
class MistralReasoner extends BaseReasoner {
    constructor(config) {
        super();
        if (!config.apiKey)
            throw new Error('Missing apiKey for Mistral provider');
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.maxTokens = config.maxTokens ?? 4096;
        this.clientOptions = config.clientOptions ?? {};
    }
    /**
     * Loads the Mistral client on first use.
     */
    getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                let mod;
                try {
                    mod = await loadOptionalModule('@mistralai/mistralai');
                }
                catch {
                    throw new Error("The '@mistralai/mistralai' package is required to use the Mistral provider. Install it with: npm install @mistralai/mistralai");
                }
                return new mod.Mistral({
                    apiKey: this.apiKey,
                    ...this.clientOptions,
                });
            })();
        }
        return this.clientPromise;
    }
    async complete(messages, schema) {
        const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));
        const options = {
            model: this.model,
            messages: formattedMessages,
            maxTokens: this.maxTokens,
        };
        if (schema) {
            options.responseFormat = {
                type: 'json_schema',
                jsonSchema: {
                    name: 'structured_output',
                    strict: true,
                    schemaDefinition: schema,
                },
            };
        }
        const client = await this.getClient();
        const response = await client.chat.complete(options);
        const content = response.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
            throw new Error('MistralReasoner: no content in response');
        }
        return { content };
    }
}
exports.MistralReasoner = MistralReasoner;
/**
 * Creates a provider-specific reasoner.
 * @param config - provider configuration
 * @returns a reasoner for the selected provider
 */
function createReasoner(config) {
    switch (config.provider) {
        case 'groq':
            return new GroqReasoner(config);
        case 'openai':
            return new OpenAIReasoner(config);
        case 'anthropic':
            return new AnthropicReasoner(config);
        case 'google':
            return new GoogleReasoner(config);
        case 'mistral':
            return new MistralReasoner(config);
        case 'openrouter':
            return new OpenRouterReasoner(config);
        case 'ollama':
            return new OllamaReasoner(config);
        case 'openai-compatible':
            return new OpenAICompatibleCustomReasoner(config);
        default: {
            const _exhaustive = config;
            throw new Error(`Unsupported provider: ${_exhaustive.provider}`);
        }
    }
}
//# sourceMappingURL=Reasoners.js.map