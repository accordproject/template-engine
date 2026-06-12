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

interface BaseProviderConfig {
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  retries?: number;
  timeoutMs?: number;
}

export interface GroqProviderConfig extends BaseProviderConfig {
  provider: 'groq';
  /** @default 'https://api.groq.com/openai/v1' */
  baseUrl?: string;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

export interface OpenAIProviderConfig extends BaseProviderConfig {
  provider: 'openai';
}

export interface AnthropicProviderConfig extends BaseProviderConfig {
  provider: 'anthropic';
}

export type LLMProviderConfig =
  | GroqProviderConfig
  | OpenAIProviderConfig
  | AnthropicProviderConfig;

export interface LLMExecutorConfig {
  mode: LLMMode;
  provider: LLMProviderConfig;
  verbose?: boolean;
}