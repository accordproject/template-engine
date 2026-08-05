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
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Configuration for OpenAI models.
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
  provider: 'openai';
}

/**
 * Configuration for Anthropic models.
 */
export interface AnthropicProviderConfig extends BaseProviderConfig {
  provider: 'anthropic';
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
