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
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, GenerateContentConfig } from '@google/genai';
import { Mistral } from '@mistralai/mistralai';

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
} from './LLMConfig';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ReasonerResult {
  content: string;
}


export type JsonSchema = Record<string, unknown>;

export abstract class BaseReasoner {
  /**
   * @param messages  Conversation turns (system / user / assistant).
   * @param schema    Optional JSON Schema. When supplied the reasoner will
   *                  attempt to use the provider's native structured-output
   *                  API so the response is guaranteed to be valid JSON that
   *                  matches the schema.
   */
  abstract complete(
    messages: ChatMessage[],
    schema?: JsonSchema
  ): Promise<ReasonerResult>;
}

export class GroqReasoner extends BaseReasoner {
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

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: this.config.topP,
      };

      if (this.config.reasoningEffort) {
        body.reasoning_effort = this.config.reasoningEffort;
      }

      // Native structured output: Groq supports the OpenAI json_schema format
      if (schema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            strict: true,
            schema,
          },
        };
      }

      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Groq API error ${res.status}: ${text}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Groq API returned no assistant content');
      }

      return { content };
    } finally {
      clearTimeout(timer);
    }
  }
}

abstract class OpenAICompatibleBase extends BaseReasoner {
  protected readonly client: OpenAI;
  protected readonly model: string;
  protected readonly temperature: number;
  protected readonly maxTokens: number;
  protected readonly topP: number;

  constructor(
    config: Pick<
      LLMProviderConfig,
      'model' | 'temperature' | 'maxTokens' | 'topP'
    > & { apiKey?: string },
    baseURL: string,
    defaultApiKey = 'placeholder'
  ) {
    super();
    this.client = new OpenAI({
      apiKey: config.apiKey || defaultApiKey,
      baseURL
    });
    this.model = config.model;
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens ?? 4096;
    this.topP = config.topP ?? 1;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const formatted: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...(systemMessages.length > 0
        ? [
            {
              role: 'system' as const,
              content: systemMessages.map(m => m.content).join('\n\n'),
            },
          ]
        : []),
      ...conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const options: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: formatted,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      top_p: this.topP,
      stream: false,
    };

    // Native structured output via json_schema response_format
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

    const response = await this.client.chat.completions.create(options);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error(`${this.constructor.name}: no content in response`);
    return { content };
  }
}

export class OpenAIReasoner extends OpenAICompatibleBase {
  constructor(config: OpenAIProviderConfig) {
    if (!config.apiKey) throw new Error('Missing apiKey for OpenAI provider');
    super(config, 'https://api.openai.com/v1');
  }
}

export class OpenRouterReasoner extends OpenAICompatibleBase {
  constructor(config: OpenRouterProviderConfig) {
    if (!config.apiKey) throw new Error('Missing apiKey for OpenRouter provider');
    super(config, 'https://openrouter.ai/api/v1');
  }
}

export class OllamaReasoner extends OpenAICompatibleBase {
  constructor(config: OllamaProviderConfig) {
    // Ollama doesn't need a real key
    super(config, config.baseUrl ?? 'http://localhost:11434/v1', 'ollama');
  }
}

export class OpenAICompatibleReasoner extends OpenAICompatibleBase {
  constructor(config: OpenAICompatibleProviderConfig) {
    super(config, config.baseUrl);
  }
}

export class AnthropicReasoner extends BaseReasoner {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for Anthropic provider');
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const systemContent = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n');

    const formattedMessages: Anthropic.MessageParam[] = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const params: Anthropic.MessageCreateParamsNonStreaming & {
      output_config?: { format: { type: string; schema: JsonSchema } };
    } = {
      model: this.model,
      max_tokens: this.maxTokens,
      ...(systemContent ? { system: systemContent } : {}),
      messages: formattedMessages,
    };

    // Native structured output: output_config.format (GA as of 2025)
    if (schema) {
      (params as any).output_config = {
        format: {
          type: 'json_schema',
          schema,
        },
      };
    }

    const response = await this.client.messages.create(params);

    // When structured output is used the model may return a refusal
    if (response.stop_reason === 'refusal') {
      throw new Error('Anthropic refused to produce structured output for this request');
    }

    const block = response.content.find(b => b.type === 'text');
    if (!block || block.type !== 'text') {
      throw new Error('Anthropic: no text block in response');
    }
    return { content: block.text };
  }
}

export class GoogleReasoner extends BaseReasoner {
  private readonly config: GoogleProviderConfig;

  constructor(config: GoogleProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for Google provider');
    this.config = config;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const genAI = new GoogleGenAI({ apiKey: this.config.apiKey! });

    const systemContent = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n');

    const geminiMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const lastMessage = geminiMessages.at(-1);
    if (!lastMessage) throw new Error('Google: no user message to send');

    const generationConfig: GenerateContentConfig = {
      ...(this.config.maxTokens ? { maxOutputTokens: this.config.maxTokens } : {}),
      ...(systemContent ? { systemInstruction: systemContent } : {}),
    };

    // Native structured output: responseMimeType + responseSchema
    if (schema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = schema as any;
    }

    const chat = genAI.chats.create({
      model: this.config.model,
      history: geminiMessages.slice(0, -1),
      config: generationConfig,
    });

    const response = await chat.sendMessage({ message: lastMessage.parts[0].text });
    const text = response.text;
    if (!text) throw new Error('Google: no text in response');
    return { content: text };
  }
}

/* Mistral supports response_format: { type: "json_object" } — this guarantees
valid JSON but does NOT enforce a specific schema. When a schema is passed
we inject it as a prompt instruction alongside the json_object mode so the
model understands the expected shape.*/

export class MistralReasoner extends BaseReasoner {
  private readonly config: MistralProviderConfig;

  constructor(config: MistralProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for Mistral provider');
    this.config = config;
  }

  async complete(messages: ChatMessage[], schema?: JsonSchema): Promise<ReasonerResult> {
    const mistral = new Mistral({ apiKey: this.config.apiKey });

    let formatted = messages.map(m => ({ role: m.role, content: m.content }));
    if (schema) {
      const schemaInstruction = `You must respond with valid JSON that strictly follows this schema:\n${JSON.stringify(schema, null, 2)}\nReturn only the JSON object, no markdown, no explanation.`;

      const systemIdx = formatted.findIndex(m => m.role === 'system');
      if (systemIdx >= 0) {
        formatted[systemIdx] = {
          ...formatted[systemIdx],
          content: `${formatted[systemIdx].content}\n\n${schemaInstruction}`,
        };
      } else {
        formatted = [{ role: 'system', content: schemaInstruction }, ...formatted];
      }
    }

    const response = await mistral.chat.complete({
      model: this.config.model,
      messages: formatted,
      // json_object guarantees valid JSON even without schema enforcement
      ...(schema ? { responseFormat: { type: 'json_object' } } : {}),
      ...(this.config.maxTokens ? { maxTokens: this.config.maxTokens } : {}),
      ...(this.config.temperature !== undefined ? { temperature: this.config.temperature } : {}),
      ...(this.config.topP !== undefined ? { topP: this.config.topP } : {}),
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Mistral: no content in response');
    }
    return { content };
  }
}

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
      return new OpenAICompatibleReasoner(config);
    default: {
      // Exhaustiveness check — TS errors here if a provider case is missing
      const _exhaustive: never = config;
      throw new Error(`Unsupported provider: ${(_exhaustive as any).provider}`);
    }
  }
}