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

export type LLMMode = 'disabled' | 'fallback' | 'force';

/** Effort levels the Groq API accepts. */
export const GROQ_EFFORT_LEVELS = ['none', 'low', 'medium', 'high'] as const;

export type GroqEffort = (typeof GROQ_EFFORT_LEVELS)[number];

/**
 * Effort levels the OpenAI Chat Completions API accepts. Only reasoning models
 * take the parameter at all — a non-reasoning model (e.g. `gpt-4o`) rejects it.
 */
export const OPENAI_EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;

export type OpenAIEffort = (typeof OPENAI_EFFORT_LEVELS)[number];

/**
 * Effort levels the Anthropic Messages API accepts (GA, no beta header).
 * Supported on Opus 4.5+ and Sonnet 5; `xhigh` arrived with Opus 4.7, and
 * Sonnet 4.5 / Haiku 4.5 reject the parameter entirely.
 */
export const ANTHROPIC_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type AnthropicEffort = (typeof ANTHROPIC_EFFORT_LEVELS)[number];

/** Union of every effort level any supported provider accepts. */
export type ReasoningEffort = GroqEffort | OpenAIEffort | AnthropicEffort;

/**
 * Shared provider settings.
 */
export interface BaseProviderConfig {
  apiKey?: string;
  model: string;
  /**
   * Whether the provider supports native structured output.
   */
  isStructuredOutputSupported?: boolean;
  /**
   * Sampling temperature. Only honoured by the `groq` provider — reasoning
   * models reject sampling parameters, so use `effort` instead where available.
   */
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  retries?: number;
  timeoutMs?: number;
}

/**
 * Configuration for Groq models.
 */
export interface GroqProviderConfig extends BaseProviderConfig {
  provider: 'groq';

  /** @default 'https://api.groq.com/openai/v1' */
  baseUrl?: string;
  /** How much reasoning the model should spend on a request. */
  effort?: GroqEffort;
}

/**
 * Configuration for OpenAI models.
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
  provider: 'openai';
  /**
   * How much reasoning the model should spend on a request. Reasoning models
   * only — a non-reasoning model such as `gpt-4o` rejects the parameter.
   */
  effort?: OpenAIEffort;
}

/**
 * Configuration for Anthropic models.
 */
export interface AnthropicProviderConfig extends BaseProviderConfig {
  provider: 'anthropic';
  /**
   * How much reasoning the model should spend on a request. Only has an effect
   * when {@link AnthropicProviderConfig.thinking} is left on.
   */
  effort?: AnthropicEffort;
  /**
   * Whether to run with adaptive extended thinking, which improves accuracy on
   * the arithmetic these templates do. Defaults to `true`. Opus 4.6+ /
   * Sonnet 4.6+ only; older models reject it with an HTTP 400. Thinking tokens
   * count against {@link BaseProviderConfig.maxTokens}, so keep that generous.
   */
  thinking?: boolean;
}

/**
 * Configuration for Google models.
 */
export interface GoogleProviderConfig extends BaseProviderConfig {
  provider: 'google';
}

/**
 * Configuration for Mistral models.
 */
export interface MistralProviderConfig extends BaseProviderConfig {
  provider: 'mistral';
}

/**
 * Configuration for OpenRouter models.
 */
export interface OpenRouterProviderConfig extends BaseProviderConfig {
  provider: 'openrouter';
}

/**
 * Configuration for Ollama models.
 */
export interface OllamaProviderConfig extends BaseProviderConfig {
  provider: 'ollama';
  /** @default 'http://localhost:11434/v1' */
  baseUrl?: string;
}

/**
 * Configuration for OpenAI-compatible providers.
 */
export interface OpenAICompatibleProviderConfig extends BaseProviderConfig {
  provider: 'openai-compatible';
  /** Base URL of the OpenAI-compatible API. */
  customEndpoint: string;
}

export type LLMProviderConfig =
  | GroqProviderConfig
  | OpenAIProviderConfig
  | AnthropicProviderConfig
  | GoogleProviderConfig
  | MistralProviderConfig
  | OpenRouterProviderConfig
  | OllamaProviderConfig
  | OpenAICompatibleProviderConfig;

/**
 * Runtime configuration for the LLM executor.
 */
export interface LLMExecutorConfig {
  mode: LLMMode;
  provider: LLMProviderConfig;
  verbose?: boolean;
}
