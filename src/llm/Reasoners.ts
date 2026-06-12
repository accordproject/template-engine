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

import {
  LLMProviderConfig,
  GroqProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
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

export class OpenAIReasoner extends BaseReasoner {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly topP: number;

  constructor(config: OpenAIProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for OpenAI provider');
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.openai.com/v1'
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
    if (!content) throw new Error('OpenAIReasoner: no content in response');
    return { content };
  }
}

export class AnthropicReasoner extends BaseReasoner {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicProviderConfig) {
    super();
    if (!config.apiKey) throw new Error('Missing apiKey for Anthropic provider');
    this.client = new Anthropic({ apiKey: config.apiKey});
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

    if (schema) {
      (params as any).output_config = {
        format: {
          type: 'json_schema',
          schema,
        },
      };
    }

    const response = await this.client.messages.create(params);

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

export function createReasoner(config: LLMProviderConfig): BaseReasoner {
  switch (config.provider) {
    case 'groq':
      return new GroqReasoner(config);
    case 'openai':
      return new OpenAIReasoner(config);
    case 'anthropic':
      return new AnthropicReasoner(config);
    default: {
      // Exhaustiveness check — TS errors here if a provider case is missing
      const _exhaustive: never = config;
      throw new Error(`Unsupported provider: ${(_exhaustive as any).provider}`);
    }
  }
}