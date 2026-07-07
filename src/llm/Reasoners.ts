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

import {
  LLMProviderConfig,
  GroqProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  GoogleProviderConfig,
  MistralProviderConfig,
  OpenRouterProviderConfig,
  OllamaProviderConfig,
  OpenAICompatibleProviderConfig,
  BaseProviderConfig,
} from './LLMConfig';

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
export abstract class BaseReasoner {
  /**
   * Completes a chat request.
   * @param messages - conversation turns
   * @param schema - optional JSON Schema for structured output
   */
  abstract complete(
    messages: ChatMessage[],
    schema?: JsonSchema
  ): Promise<ReasonerResult>;
}

/**
 * Loads an optional dependency at runtime.
 * @param specifier - module specifier
 * @returns imported module
 */
function loadOptionalModule(specifier: string): Promise<any> {
  return import(specifier);
}

interface GroqResponseFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: boolean;
    schema: JsonSchema;
  };
}

interface GroqChatCompletionCreateParams {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  top_p: number;
  response_format?: GroqResponseFormat;
  reasoning_effort?: GroqProviderConfig['reasoningEffort'];
}

interface GroqChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

interface GroqClient {
  chat: {
    completions: {
      create: (args: GroqChatCompletionCreateParams) => Promise<GroqChatCompletionResponse>;
    };
  };
}

/**
 * Groq-backed reasoner.
 */
export class GroqReasoner extends BaseReasoner {
  private clientPromise?: Promise<GroqClient>;
  private readonly config: Required<
    Pick<
      GroqProviderConfig,
      'apiKey' | 'model' | 'baseUrl' | 'temperature' | 'maxTokens' | 'topP' | 'timeoutMs'
    >
  > &
    Pick<GroqProviderConfig, 'reasoningEffort'>;

  constructor(config: GroqProviderConfig) {
    super();
    const apiKey =
      config.apiKey ||
      (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : '') ||
      '';
    if (!apiKey) throw new Error('Missing apiKey for Groq provider');

    this.config = {
      apiKey,
      model: config.model,
      baseUrl: config.baseUrl ?? 'https://api.groq.com/openai/v1',
      temperature: config.temperature ?? 0,
      maxTokens: config.maxTokens ?? 4096,
      topP: config.topP ?? 1,
      reasoningEffort: config.reasoningEffort,
      timeoutMs: config.timeoutMs ?? 60000,
    };
  }

  /**
   * Loads the Groq client on first use.
   */
  private getClient(): Promise<GroqClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: any;
        try {
          mod = await loadOptionalModule('groq-sdk');
        } catch {
          throw new Error(
            "The 'groq-sdk' package is required to use the Groq provider. Install it with: npm install groq-sdk"
          );
        }
        const Groq = mod.default ?? mod.Groq;
        if (!Groq) {
          throw new Error("Unable to load the Groq SDK constructor from 'groq-sdk'");
        }
        return new Groq({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseUrl,
        }) as GroqClient;
      })();
    }
    return this.clientPromise;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const options: GroqChatCompletionCreateParams = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      top_p: this.config.topP,
    };

    if (this.config.reasoningEffort) {
      options.reasoning_effort = this.config.reasoningEffort;
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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Groq request timed out after ${this.config.timeoutMs}ms`)),
        this.config.timeoutMs
      );
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
    } catch (error: any) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Groq API error: ${String(error)}`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
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
  /** OpenAI-native token limit field. */
  max_completion_tokens?: number;
  /** Legacy token limit field used by OpenAI-compatible APIs. */
  max_tokens?: number;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

interface OpenAIClient {
  chat: {
    completions: {
      create: (args: OpenAIChatCompletionCreateParams) => Promise<OpenAIChatCompletionResponse>;
    };
  };
}

/**
 * Formats messages for OpenAI-style chat APIs.
 * @param messages - chat messages to convert
 * @returns provider-ready messages
 */
function formatOpenAIMessages(messages: ChatMessage[]): OpenAIChatMessageParam[] {
  const systemMessages = messages.filter(message => message.role === 'system');
  const conversationMessages = messages.filter(message => message.role !== 'system');

  return [
    ...(systemMessages.length > 0
      ? [
          {
            role: 'system' as const,
            content: systemMessages.map(message => message.content).join('\n\n'),
          },
        ]
      : []),
    ...conversationMessages.map(message => ({
      role: message.role as 'user' | 'assistant',
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
function createOpenAIResponseFormat(
  schema: JsonSchema,
  strict: boolean
): OpenAIResponseFormat {
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
export class OpenAIReasoner extends BaseReasoner {
  private clientPromise?: Promise<OpenAIClient>;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: OpenAIProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for OpenAI provider');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * Loads the OpenAI client on first use.
   */
  private getClient(): Promise<OpenAIClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: any;
        try {
          mod = await loadOptionalModule('openai');
        } catch {
          throw new Error(
            "The 'openai' package is required to use the OpenAI provider. Install it with: npm install openai"
          );
        }
        return new mod.default({
          apiKey: this.apiKey,
          baseURL: 'https://api.openai.com/v1',
        }) as OpenAIClient;
      })();
    }
    return this.clientPromise;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const options: OpenAIChatCompletionCreateParams = {
      model: this.model,
      messages: formatOpenAIMessages(messages),
      max_completion_tokens: this.maxTokens,
      stream: false,
    };

    if (schema) {
      options.response_format = createOpenAIResponseFormat(schema, false);
    }

    const client = await this.getClient();
    const response = await client.chat.completions.create(options);

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAIReasoner: no content in response');
    return { content };
  }
}

interface AnthropicMessageParam {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicOutputConfig {
  format: {
    type: string;
    schema: JsonSchema;
  };
}

interface AnthropicMessageCreateParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessageParam[];
  output_config?: AnthropicOutputConfig;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  stop_reason?: string | null;
  content: AnthropicContentBlock[];
}

interface AnthropicClient {
  messages: {
    create: (args: AnthropicMessageCreateParams) => Promise<AnthropicMessageResponse>;
  };
}

/**
 * Anthropic-backed reasoner.
 */
export class AnthropicReasoner extends BaseReasoner {
  private clientPromise?: Promise<AnthropicClient>;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for Anthropic provider');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * Loads the Anthropic client on first use.
   */
  private getClient(): Promise<AnthropicClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: any;
        try {
          mod = await loadOptionalModule('@anthropic-ai/sdk');
        } catch {
          throw new Error(
            "The '@anthropic-ai/sdk' package is required to use the Anthropic provider. Install it with: npm install @anthropic-ai/sdk"
          );
        }
        return new mod.default({ apiKey: this.apiKey }) as AnthropicClient;
      })();
    }
    return this.clientPromise;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const systemContent = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n');

    const formattedMessages: AnthropicMessageParam[] = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const params: AnthropicMessageCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      ...(systemContent ? { system: systemContent } : {}),
      messages: formattedMessages,
    };

    if (schema) {
      params.output_config = {
        format: {
          type: 'json_schema',
          schema,
        },
      };
    }

    const client = await this.getClient();
    const response = await client.messages.create(params);

    if (response.stop_reason === 'refusal') {
      throw new Error('Anthropic refused to produce structured output for this request');
    }

    const block = response.content.find(b => b.type === 'text');
    if (!block || !block.text) {
      throw new Error('Anthropic: no text block in response');
    }
    return { content: block.text };
  }
}

/**
 * Base reasoner for providers that expose an OpenAI-compatible chat API.
 */
export class OpenAICompatibleReasoner extends BaseReasoner {
  protected clientPromise?: Promise<OpenAIClient>;
  protected readonly apiKey: string;
  protected readonly model: string;
  protected readonly maxTokens: number;
  protected readonly baseUrl: string;

  constructor(config: BaseProviderConfig, baseUrl: string, defaultApiKey = '') {
    super();
    const apiKey = config.apiKey || defaultApiKey;
    if (!apiKey) throw new Error('Missing apiKey for OpenAI-compatible provider');
    this.apiKey = apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.baseUrl = baseUrl;
  }

  /**
   * Loads the OpenAI-compatible client on first use.
   */
  private getClient(): Promise<OpenAIClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: any;
        try {
          mod = await loadOptionalModule('openai');
        } catch {
          throw new Error(
            "The 'openai' package is required to use this provider. Install it with: npm install openai"
          );
        }
        return new mod.default({
          apiKey: this.apiKey,
          baseURL: this.baseUrl,
        }) as OpenAIClient;
      })();
    }
    return this.clientPromise;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const options: OpenAIChatCompletionCreateParams = {
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
    if (!content) throw new Error(`${this.constructor.name}: no content in response`);
    return { content };
  }
}

interface OpenRouterChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  responseFormat?: Record<string, unknown>;
}

interface OpenRouterClient {
  chat: {
    send: (args: {
      chatRequest: OpenRouterChatRequest;
    }) => Promise<{ choices?: Array<{ message?: { content?: unknown } }> }>;
  };
}

/**
 * OpenRouter-backed reasoner.
 */
export class OpenRouterReasoner extends BaseReasoner {
  private clientPromise?: Promise<OpenRouterClient>;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: OpenRouterProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for OpenRouter provider');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * Loads the OpenRouter client on first use.
   */
  private getClient(): Promise<OpenRouterClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: any;
        try {
          mod = await loadOptionalModule('@openrouter/sdk');
        } catch {
          throw new Error(
            "The '@openrouter/sdk' package is required to use the OpenRouter provider. Install it with: npm install @openrouter/sdk"
          );
        }
        return new mod.OpenRouter({ apiKey: this.apiKey }) as OpenRouterClient;
      })();
    }
    return this.clientPromise;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));

    const chatRequest: OpenRouterChatRequest = {
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

/**
 * Ollama-backed reasoner.
 */
export class OllamaReasoner extends OpenAICompatibleReasoner {
  constructor(config: OllamaProviderConfig) {
    super(config, config.baseUrl ?? 'http://localhost:11434/v1', 'ollama');
  }
}

/**
 * Reasoner for arbitrary OpenAI-compatible endpoints.
 */
export class OpenAICompatibleCustomReasoner extends OpenAICompatibleReasoner {
  constructor(config: OpenAICompatibleProviderConfig) {
    if (!config.customEndpoint) {
      throw new Error('customEndpoint is required for the openai-compatible provider');
    }
    super(config, config.customEndpoint);
  }
}

interface GoogleGenAIClient {
  models: {
    generateContent: (args: {
      model: string;
      contents: unknown;
      config?: Record<string, unknown>;
    }) => Promise<{ text?: string }>;
  };
}

/**
 * Google-backed reasoner.
 */
export class GoogleReasoner extends BaseReasoner {
  private clientPromise?: Promise<GoogleGenAIClient>;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: GoogleProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for Google provider');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * Loads the Google client on first use.
   */
  private getClient(): Promise<GoogleGenAIClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: any;
        try {
          mod = await loadOptionalModule('@google/genai');
        } catch {
          throw new Error(
            "The '@google/genai' package is required to use the Google provider. Install it with: npm install @google/genai"
          );
        }
        return new mod.GoogleGenAI({ apiKey: this.apiKey }) as GoogleGenAIClient;
      })();
    }
    return this.clientPromise;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
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

    const generationConfig: Record<string, unknown> = {
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
    if (!content) throw new Error('GoogleReasoner: no content in response');
    return { content };
  }
}

interface MistralClient {
  chat: {
    complete: (
      args: Record<string, unknown>
    ) => Promise<{ choices?: Array<{ message?: { content?: unknown } }> }>;
  };
}

/**
 * Mistral-backed reasoner.
 */
export class MistralReasoner extends BaseReasoner {
  private clientPromise?: Promise<MistralClient>;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: MistralProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for Mistral provider');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * Loads the Mistral client on first use.
   */
  private getClient(): Promise<MistralClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: any;
        try {
          mod = await loadOptionalModule('@mistralai/mistralai');
        } catch {
          throw new Error(
            "The '@mistralai/mistralai' package is required to use the Mistral provider. Install it with: npm install @mistralai/mistralai"
          );
        }
        return new mod.Mistral({ apiKey: this.apiKey }) as MistralClient;
      })();
    }
    return this.clientPromise;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));

    const options: Record<string, unknown> = {
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

/**
 * Creates a provider-specific reasoner.
 * @param config - provider configuration
 * @returns a reasoner for the selected provider
 */
export function createReasoner(config: LLMProviderConfig): BaseReasoner {
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
      const _exhaustive: never = config;
      throw new Error(`Unsupported provider: ${(_exhaustive as any).provider}`);
    }
  }
}
