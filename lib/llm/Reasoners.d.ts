import { LLMProviderConfig, GroqProviderConfig, OpenAIProviderConfig, AnthropicProviderConfig, GoogleProviderConfig, MistralProviderConfig, OpenRouterProviderConfig, OllamaProviderConfig, OpenAICompatibleProviderConfig, BaseProviderConfig, OpenAIEffort } from './LLMConfig';
/**
 * A single chat turn sent to a provider.
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
/**
 * Raw content returned by a provider.
 */
export interface ReasonerResult {
    content: string;
}
export type JsonSchema = Record<string, unknown>;
/**
 * Base interface for provider-specific reasoners.
 */
export declare abstract class BaseReasoner {
    /**
     * Completes a chat request.
     * @param messages - conversation turns
     * @param schema - optional JSON Schema for structured output
     */
    abstract complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
/**
 * Groq-backed reasoner.
 */
export declare class GroqReasoner extends BaseReasoner {
    private clientPromise?;
    private readonly config;
    constructor(config: GroqProviderConfig);
    /**
     * Loads the Groq client on first use.
     */
    private getClient;
    complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
interface OpenAIChatMessageParam {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
interface OpenAIResponseFormat {
    type: 'json_schema';
    json_schema: {
        name: string;
        strict: boolean;
        schema: JsonSchema;
    };
}
interface OpenAIChatCompletionCreateParams {
    model: string;
    messages: OpenAIChatMessageParam[];
    stream: false;
    response_format?: OpenAIResponseFormat;
    /** Reasoning depth; reasoning models only. */
    reasoning_effort?: OpenAIEffort;
    /** OpenAI-native token limit field. */
    max_completion_tokens?: number;
    /** Legacy token limit field used by OpenAI-compatible APIs. */
    max_tokens?: number;
}
interface OpenAIChatCompletionResponse {
    choices?: Array<{
        message?: {
            content?: string | null;
        };
    }>;
}
interface OpenAIClient {
    chat: {
        completions: {
            create: (args: OpenAIChatCompletionCreateParams) => Promise<OpenAIChatCompletionResponse>;
        };
    };
}
/**
 * OpenAI-backed reasoner.
 */
export declare class OpenAIReasoner extends BaseReasoner {
    private clientPromise?;
    private readonly apiKey;
    private readonly model;
    private readonly maxTokens;
    private readonly effort?;
    private readonly clientOptions;
    constructor(config: OpenAIProviderConfig);
    /**
     * Loads the OpenAI client on first use.
     */
    private getClient;
    complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
/**
 * Anthropic-backed reasoner.
 */
export declare class AnthropicReasoner extends BaseReasoner {
    private clientPromise?;
    private readonly apiKey;
    private readonly model;
    private readonly maxTokens;
    private readonly effort?;
    private readonly thinking;
    private readonly clientOptions;
    constructor(config: AnthropicProviderConfig);
    /**
     * Loads the Anthropic client on first use.
     */
    private getClient;
    complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
/**
 * Base reasoner for providers that expose an OpenAI-compatible chat API.
 */
export declare class OpenAICompatibleReasoner extends BaseReasoner {
    protected clientPromise?: Promise<OpenAIClient>;
    protected readonly apiKey: string;
    protected readonly model: string;
    protected readonly maxTokens: number;
    protected readonly baseUrl: string;
    protected readonly clientOptions: Record<string, unknown>;
    constructor(config: BaseProviderConfig, baseUrl: string, defaultApiKey?: string);
    /**
     * Loads the OpenAI-compatible client on first use.
     */
    private getClient;
    complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
/**
 * OpenRouter-backed reasoner.
 */
export declare class OpenRouterReasoner extends BaseReasoner {
    private clientPromise?;
    private readonly apiKey;
    private readonly model;
    private readonly maxTokens;
    private readonly clientOptions;
    constructor(config: OpenRouterProviderConfig);
    /**
     * Loads the OpenRouter client on first use.
     */
    private getClient;
    complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
/**
 * Ollama-backed reasoner.
 */
export declare class OllamaReasoner extends OpenAICompatibleReasoner {
    constructor(config: OllamaProviderConfig);
}
/**
 * Reasoner for arbitrary OpenAI-compatible endpoints.
 */
export declare class OpenAICompatibleCustomReasoner extends OpenAICompatibleReasoner {
    constructor(config: OpenAICompatibleProviderConfig);
}
/**
 * Google-backed reasoner.
 */
export declare class GoogleReasoner extends BaseReasoner {
    private clientPromise?;
    private readonly apiKey;
    private readonly model;
    private readonly maxTokens;
    private readonly clientOptions;
    constructor(config: GoogleProviderConfig);
    /**
     * Loads the Google client on first use.
     */
    private getClient;
    complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
/**
 * Mistral-backed reasoner.
 */
export declare class MistralReasoner extends BaseReasoner {
    private clientPromise?;
    private readonly apiKey;
    private readonly model;
    private readonly maxTokens;
    private readonly clientOptions;
    constructor(config: MistralProviderConfig);
    /**
     * Loads the Mistral client on first use.
     */
    private getClient;
    complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult>;
}
/**
 * Creates a provider-specific reasoner.
 * @param config - provider configuration
 * @returns a reasoner for the selected provider
 */
export declare function createReasoner(config: LLMProviderConfig): BaseReasoner;
export {};
